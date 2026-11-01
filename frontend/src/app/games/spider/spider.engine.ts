import { Card, RANKS, Suit } from '../../shared/models/card.model';
import { seededRng, shuffle } from '../core/deck';
import { value } from '../solitaire/solitaire.engine';

/**
 * Spider solitaire. Two decks (104 cards) in ten tableau columns: 6 cards in the first four,
 * 5 in the rest, top card face up; the other 50 stay in the stock for five deals of ten.
 * Any card goes on a card one rank higher, whatever its suit, but only a run in one suit moves
 * as a unit. A full King-to-Ace run in one suit is removed to the foundations; clear all eight
 * to win. Any card or run may fill an empty column, but every column needs a card before a deal.
 * 1, 2 or 4 suits set how many suits the 104 cards are spread over.
 *
 * Scoring (Windows standard): start at 500, −1 per move, +100 per completed run.
 */

export type SuitCount = 1 | 2 | 4;
export type PileId = 'stock' | `f${number}` | `t${number}`;

export const COLUMNS = 10;
const RUNS = 8;

export interface TableauCard {
  card: Card;
  up: boolean;
}

export interface SpiderState {
  stock: Card[];
  tableau: TableauCard[][];
  /** Completed King-to-Ace runs, in the order they were cleared. */
  completed: Card[][];
  score: number;
  moves: number;
}

export interface Move {
  from: number;
  /** Index of the first card moved within the source column. */
  index: number;
  to: number;
}

const SUITS_FOR: Record<SuitCount, Suit[]> = {
  1: ['spades'],
  2: ['spades', 'hearts'],
  4: ['spades', 'hearts', 'clubs', 'diamonds'],
};

/** 104 cards: eight full suits spread evenly over the chosen suits. Ids stay unique across copies. */
export function spiderDeck(suits: SuitCount): Card[] {
  const pool = SUITS_FOR[suits];
  return Array.from({ length: RUNS }, (_, n) => pool[n % pool.length]).flatMap((suit, n) =>
    RANKS.map((rank) => ({ id: `${suit}-${rank}-${n}`, suit, rank })),
  );
}

export class SpiderEngine {
  private state: SpiderState;
  private history: SpiderState[] = [];

  constructor(
    readonly seed: number,
    readonly suits: SuitCount = 1,
  ) {
    const deck = shuffle(spiderDeck(suits), seededRng(seed));
    const tableau: TableauCard[][] = [];
    let i = 0;
    for (let col = 0; col < COLUMNS; col++) {
      const n = col < 4 ? 6 : 5;
      tableau.push(deck.slice(i, i + n).map((card, k) => ({ card, up: k === n - 1 })));
      i += n;
    }
    this.state = { stock: deck.slice(i), tableau, completed: [], score: 500, moves: 0 };
  }

  get view(): SpiderState {
    return structuredClone(this.state);
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  isWon(): boolean {
    return this.state.completed.length === RUNS;
  }

  /** Deals left in the stock. */
  dealsLeft(): number {
    return this.state.stock.length / COLUMNS;
  }

  canDeal(): boolean {
    return this.state.stock.length > 0 && this.state.tableau.every((col) => col.length > 0);
  }

  // ----------------------------------------------------------------- moves

  /** One face-up card from the stock onto every column. */
  deal(): boolean {
    if (!this.canDeal()) return false;
    this.checkpoint();
    const s = this.state;
    const cards = s.stock.splice(s.stock.length - COLUMNS, COLUMNS).reverse();
    s.tableau.forEach((col, t) => col.push({ card: cards[t], up: true }));
    s.tableau.forEach((_, t) => this.collect(t));
    this.addMove();
    return true;
  }

  /** The cards a move would pick up: a face-up run in one suit, or null. */
  pickUp(from: number, index: number): Card[] | null {
    const col = this.state.tableau[from];
    if (!col || index < 0 || index >= col.length || !col[index].up) return null;
    const cards = col.slice(index).map((t) => t.card);
    return cards.every((c, i) => i === 0 || (c.suit === cards[0].suit && value(c) === value(cards[i - 1]) - 1)) ? cards : null;
  }

  canMove(m: Move): boolean {
    const cards = this.pickUp(m.from, m.index);
    if (!cards || m.from === m.to) return false;
    const col = this.state.tableau[m.to];
    if (!col) return false;
    const top = col[col.length - 1];
    return !top || (top.up && value(top.card) === value(cards[0]) + 1);
  }

  move(m: Move): boolean {
    if (!this.canMove(m)) return false;
    this.checkpoint();
    const s = this.state;
    s.tableau[m.to].push(...s.tableau[m.from].splice(m.index));
    this.turnUp(m.from);
    this.collect(m.to);
    this.addMove();
    return true;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.state = prev;
    this.addMove(); // undo still costs a move, as in Windows Spider
    return true;
  }

  // ---------------------------------------------------------------- helpers

  /** Best destination for a tap: a card of the same suit, then any card, then an empty column. */
  bestTarget(from: number, index: number): number | null {
    const cards = this.pickUp(from, index);
    if (!cards) return null;
    let any: number | null = null;
    let empty: number | null = null;
    for (let t = 0; t < COLUMNS; t++) {
      if (!this.canMove({ from, index, to: t })) continue;
      const top = this.state.tableau[t][this.state.tableau[t].length - 1];
      if (top?.card.suit === cards[0].suit) return t;
      if (top) any ??= t;
      else empty ??= t;
    }
    // A run already at the bottom of a column gains nothing from moving to another empty one.
    return any ?? (index > 0 ? empty : null);
  }

  /** The most useful move, or 'deal' when only the stock is left, or null when stuck. */
  hint(): Move | 'deal' | null {
    let best: Move | null = null;
    let bestScore = 0;
    this.state.tableau.forEach((col, from) => {
      for (let index = col.length - 1; index >= 0 && this.pickUp(from, index); index--) {
        for (let to = 0; to < COLUMNS; to++) {
          const m = { from, index, to };
          const score = this.canMove(m) ? this.moveScore(m) : 0;
          if (score > bestScore) {
            best = m;
            bestScore = score;
          }
        }
      }
    });
    if (best) return best;
    return this.canDeal() ? 'deal' : null;
  }

  /** 0 for a pointless move; higher is better. */
  private moveScore({ from, index, to }: Move): number {
    const src = this.state.tableau[from];
    const dst = this.state.tableau[to];
    const card = src[index].card;
    const below = src[index - 1];
    const top = dst[dst.length - 1];
    const sameSuit = top?.card.suit === card.suit;
    const reveals = !!below && !below.up;
    const empties = index === 0;
    // Sitting on its natural next card already: only worth moving onto the same suit.
    const settled = !!below && below.up && value(below.card) === value(card) + 1;
    if (settled && (below.card.suit === card.suit || !sameSuit)) return 0;
    if (!top) return reveals ? 1 : 0;
    return 2 + (sameSuit ? 4 : 0) + (reveals ? 3 : 0) + (empties ? 2 : 0);
  }

  /** Remove a finished King-to-Ace run from the bottom of a column. */
  private collect(t: number): void {
    const col = this.state.tableau[t];
    if (col.length < 13) return;
    const run = col.slice(-13);
    const suit = run[0].card.suit;
    if (!run.every((x, i) => x.up && x.card.suit === suit && value(x.card) === 13 - i)) return;
    this.state.completed.push(col.splice(-13).map((x) => x.card));
    this.state.score += 100;
    this.turnUp(t);
  }

  private turnUp(t: number): void {
    const col = this.state.tableau[t];
    const top = col[col.length - 1];
    if (top) top.up = true;
  }

  private addMove(): void {
    this.state.moves += 1;
    this.state.score = Math.max(0, this.state.score - 1);
  }

  private checkpoint(): void {
    this.history.push(structuredClone(this.state));
    if (this.history.length > 500) this.history.shift();
  }
}
