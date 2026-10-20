import { Card, isRed } from '../../shared/models/card.model';
import { createStandardDeck, seededRng, shuffle } from '../core/deck';

/**
 * Klondike solitaire. Seven tableau columns (1…7 cards, top card face up), the rest in the stock.
 * Build foundations up by suit from Ace to King; build tableau columns down in alternating
 * colours, and only a King (or a stack headed by one) may fill an empty column.
 * Draw 1 or 3 cards from the stock; when it runs out, turn the waste back over.
 *
 * Scoring (Windows standard): waste→tableau +5, to a foundation +10, turning a tableau card
 * face up +5, foundation→tableau −15, recycling the waste −100 (draw 1) / −20 (draw 3).
 * The score never drops below 0.
 */

export type DrawCount = 1 | 3;
export type PileId = 'stock' | 'waste' | `f${number}` | `t${number}`;

export interface TableauCard {
  card: Card;
  up: boolean;
}

export interface SolitaireState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: TableauCard[][];
  score: number;
  moves: number;
  recycles: number;
}

export interface Move {
  from: PileId;
  /** Index of the first card moved within the source pile. */
  index: number;
  to: PileId;
}

/** Ace 1 … King 13. */
export const value = (c: Card) => (c.rank === 'A' ? 1 : c.rank === 'J' ? 11 : c.rank === 'Q' ? 12 : c.rank === 'K' ? 13 : Number(c.rank));

export class SolitaireEngine {
  private state: SolitaireState;
  private history: SolitaireState[] = [];

  constructor(
    readonly seed: number,
    readonly drawCount: DrawCount = 1,
  ) {
    const deck = shuffle(createStandardDeck(), seededRng(seed));
    const tableau: TableauCard[][] = [];
    let i = 0;
    for (let col = 0; col < 7; col++) {
      tableau.push(deck.slice(i, i + col + 1).map((card, k) => ({ card, up: k === col })));
      i += col + 1;
    }
    this.state = { stock: deck.slice(i), waste: [], foundations: [[], [], [], []], tableau, score: 0, moves: 0, recycles: 0 };
  }

  get view(): SolitaireState {
    return structuredClone(this.state);
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  isWon(): boolean {
    return this.state.foundations.every((f) => f.length === 13);
  }

  // ----------------------------------------------------------------- moves

  /** Turn cards from the stock, or recycle the waste when the stock is empty. */
  draw(): boolean {
    const s = this.state;
    if (!s.stock.length && !s.waste.length) return false;
    this.checkpoint();
    if (s.stock.length) {
      const n = Math.min(this.drawCount, s.stock.length);
      s.waste.push(...s.stock.splice(s.stock.length - n, n).reverse());
    } else {
      s.stock = s.waste.reverse();
      s.waste = [];
      s.recycles += 1;
      this.addScore(this.drawCount === 1 ? -100 : -20);
    }
    s.moves += 1;
    return true;
  }

  /** The cards a move would pick up, or null if nothing can be picked up there. */
  pickUp(from: PileId, index: number): Card[] | null {
    const s = this.state;
    if (from === 'waste') return index === s.waste.length - 1 && s.waste.length ? [s.waste[index]] : null;
    if (from.startsWith('f')) {
      const f = s.foundations[Number(from.slice(1))];
      return index === f.length - 1 && f.length ? [f[index]] : null;
    }
    if (from.startsWith('t')) {
      const col = s.tableau[Number(from.slice(1))];
      if (index < 0 || index >= col.length || !col[index].up) return null;
      return col.slice(index).map((t) => t.card);
    }
    return null;
  }

  canMove(m: Move): boolean {
    const cards = this.pickUp(m.from, m.index);
    if (!cards || m.from === m.to) return false;
    const first = cards[0];
    if (m.to.startsWith('f')) {
      if (cards.length !== 1 || m.from.startsWith('f')) return false;
      const f = this.state.foundations[Number(m.to.slice(1))];
      const top = f[f.length - 1];
      return top ? top.suit === first.suit && value(first) === value(top) + 1 : value(first) === 1;
    }
    if (m.to.startsWith('t')) {
      const col = this.state.tableau[Number(m.to.slice(1))];
      const top = col[col.length - 1];
      if (!top) return value(first) === 13;
      return top.up && isRed(top.card.suit) !== isRed(first.suit) && value(first) === value(top.card) - 1;
    }
    return false;
  }

  move(m: Move): boolean {
    if (!this.canMove(m)) return false;
    this.checkpoint();
    const s = this.state;
    const cards = this.take(m.from, m.index);
    if (m.to.startsWith('f')) s.foundations[Number(m.to.slice(1))].push(...cards);
    else s.tableau[Number(m.to.slice(1))].push(...cards.map((card) => ({ card, up: true })));

    const toFoundation = m.to.startsWith('f');
    if (toFoundation && !m.from.startsWith('f')) this.addScore(10);
    else if (m.from === 'waste') this.addScore(5);
    else if (m.from.startsWith('f')) this.addScore(-15);

    if (m.from.startsWith('t')) {
      const col = s.tableau[Number(m.from.slice(1))];
      const top = col[col.length - 1];
      if (top && !top.up) {
        top.up = true;
        this.addScore(5);
      }
    }
    s.moves += 1;
    return true;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.state = prev;
    this.state.moves += 1; // undo still counts as a move, like most solitaire apps
    return true;
  }

  // ---------------------------------------------------------------- helpers

  /** Best destination for a tap: a foundation if possible, otherwise a tableau column. */
  bestTarget(from: PileId, index: number): PileId | null {
    const cards = this.pickUp(from, index);
    if (!cards) return null;
    if (cards.length === 1) {
      for (let f = 0; f < 4; f++) if (this.canMove({ from, index, to: `f${f}` })) return `f${f}`;
    }
    const empties: PileId[] = [];
    for (let t = 0; t < 7; t++) {
      const to: PileId = `t${t}`;
      if (!this.canMove({ from, index, to })) continue;
      if (this.state.tableau[t].length) return to;
      empties.push(to);
    }
    // A King already at the bottom of a column gains nothing from moving to another empty one.
    if (empties.length && !(from.startsWith('t') && index === 0)) return empties[0];
    return null;
  }

  /** A helpful move, or 'draw' when only the stock is left, or null when stuck. */
  hint(): Move | 'draw' | null {
    const s = this.state;
    const sources: { from: PileId; index: number }[] = [];
    if (s.waste.length) sources.push({ from: 'waste', index: s.waste.length - 1 });
    s.tableau.forEach((col, t) => {
      const firstUp = col.findIndex((c) => c.up);
      if (firstUp >= 0) for (let i = firstUp; i < col.length; i++) sources.push({ from: `t${t}`, index: i });
    });
    // 1. Anything onto a foundation.
    for (const src of sources) {
      for (let f = 0; f < 4; f++) if (this.canMove({ ...src, to: `f${f}` })) return { ...src, to: `f${f}` };
    }
    // 2. Tableau moves that turn over a card or empty a column; then waste → tableau.
    for (const src of sources) {
      const reveals = src.from.startsWith('t') && src.index === s.tableau[Number(src.from.slice(1))].findIndex((c) => c.up) && src.index > 0;
      const empties = src.from.startsWith('t') && src.index === 0;
      if (src.from === 'waste' || reveals || (empties && this.anyKeyNeedsSpace())) {
        const to = this.bestTarget(src.from, src.index);
        if (to && to.startsWith('t')) return { ...src, to };
      }
    }
    if (s.stock.length || s.waste.length) return 'draw';
    return null;
  }

  private anyKeyNeedsSpace(): boolean {
    const s = this.state;
    const wasteKing = s.waste.length && value(s.waste[s.waste.length - 1]) === 13;
    return !!wasteKing || s.tableau.some((col) => col.findIndex((c) => c.up) > 0 && value(col.find((c) => c.up)!.card) === 13);
  }

  /** Stock and waste empty and every tableau card face up: the rest is mechanical. */
  canAutoFinish(): boolean {
    const s = this.state;
    return !this.isWon() && !s.stock.length && !s.waste.length && s.tableau.every((col) => col.every((c) => c.up));
  }

  /** One auto-finish step: the lowest card that can go up goes up. */
  autoFinishStep(): Move | null {
    let best: Move | null = null;
    let bestValue = 99;
    this.state.tableau.forEach((col, t) => {
      if (!col.length) return;
      const card = col[col.length - 1].card;
      for (let f = 0; f < 4; f++) {
        const m: Move = { from: `t${t}`, index: col.length - 1, to: `f${f}` };
        if (this.canMove(m) && value(card) < bestValue) {
          best = m;
          bestValue = value(card);
        }
      }
    });
    if (best) this.move(best);
    return best;
  }

  private take(from: PileId, index: number): Card[] {
    const s = this.state;
    if (from === 'waste') return s.waste.splice(index);
    if (from.startsWith('f')) return s.foundations[Number(from.slice(1))].splice(index);
    return s.tableau[Number(from.slice(1))].splice(index).map((t) => t.card);
  }

  private checkpoint(): void {
    this.history.push(structuredClone(this.state));
    if (this.history.length > 500) this.history.shift();
  }

  private addScore(n: number): void {
    this.state.score = Math.max(0, this.state.score + n);
  }
}
