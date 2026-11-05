import { Card } from '../../shared/models/card.model';
import { createStandardDeck, seededRng, shuffle } from '../core/deck';
import { value } from '../solitaire/solitaire.engine';

/**
 * Tri Peaks solitaire. 28 cards form three overlapping peaks (rows of 3, 6, 9 and 10); the
 * bottom row starts face up and every other card turns up once both cards covering it are gone.
 * Play any uncovered card one rank above or below the top waste card (King and Ace connect),
 * or turn the next stock card onto the waste. Clear all three peaks to win.
 *
 * Scoring: each card in a run scores its place in the run (1, 2, 3 …); turning a stock card
 * ends the run. Clearing a peak's top card +15, the last peak +30 more, and each stock card
 * left at the end +5.
 */

export const ROWS = [3, 6, 9, 10] as const;
export const PEAK_CARDS = 28;

export interface Slot {
  card: Card;
  row: number;
  /** Left edge, in card widths. */
  x: number;
  up: boolean;
  gone: boolean;
}

export interface TriPeaksState {
  slots: Slot[];
  stock: Card[];
  waste: Card[];
  score: number;
  streak: number;
  bestStreak: number;
  moves: number;
}

/** Where slot `i` sits, and which slots cover it. Fixed for every deal. */
export const LAYOUT: { row: number; x: number; coveredBy: number[] }[] = (() => {
  const starts = [0, 3, 9, 18];
  const out: { row: number; x: number; coveredBy: number[] }[] = [];
  for (let i = 0; i < 3; i++) out.push({ row: 0, x: 3 * i + 1.5, coveredBy: [starts[1] + 2 * i, starts[1] + 2 * i + 1] });
  for (let j = 0; j < 6; j++) {
    const k = 3 * Math.floor(j / 2) + (j % 2);
    out.push({ row: 1, x: k + 1, coveredBy: [starts[2] + k, starts[2] + k + 1] });
  }
  for (let m = 0; m < 9; m++) out.push({ row: 2, x: m + 0.5, coveredBy: [starts[3] + m, starts[3] + m + 1] });
  for (let n = 0; n < 10; n++) out.push({ row: 3, x: n, coveredBy: [] });
  return out;
})();

/** Ranks one apart, with King and Ace connecting. */
export const adjacent = (a: Card, b: Card) => {
  const d = Math.abs(value(a) - value(b));
  return d === 1 || d === 12;
};

export class TriPeaksEngine {
  private state: TriPeaksState;
  private history: TriPeaksState[] = [];

  constructor(readonly seed: number) {
    const deck = shuffle(createStandardDeck(), seededRng(seed));
    const slots = LAYOUT.map((l, i) => ({ card: deck[i], row: l.row, x: l.x, up: l.row === 3, gone: false }));
    const rest = deck.slice(PEAK_CARDS);
    // One stock card starts the waste.
    this.state = { slots, stock: rest.slice(0, -1), waste: rest.slice(-1), score: 0, streak: 0, bestStreak: 0, moves: 0 };
  }

  get view(): TriPeaksState {
    return structuredClone(this.state);
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  isWon(): boolean {
    return this.state.slots.every((s) => s.gone);
  }

  /** Lost: the stock is empty and nothing can be played. */
  isStuck(): boolean {
    return !this.isWon() && !this.state.stock.length && this.playable().length === 0;
  }

  /** Slots that are face up and uncovered. */
  free(): number[] {
    return this.state.slots.flatMap((s, i) => (!s.gone && LAYOUT[i].coveredBy.every((c) => this.state.slots[c].gone) ? [i] : []));
  }

  /** Free slots that can go on the waste now. */
  playable(): number[] {
    const top = this.state.waste[this.state.waste.length - 1];
    return this.free().filter((i) => !!top && adjacent(this.state.slots[i].card, top));
  }

  // ----------------------------------------------------------------- moves

  play(i: number): boolean {
    if (!this.playable().includes(i)) return false;
    this.checkpoint();
    const s = this.state;
    const slot = s.slots[i];
    slot.gone = true;
    s.waste.push(slot.card);
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.score += s.streak;
    if (slot.row === 0) s.score += 15;
    for (const j of this.free()) s.slots[j].up = true;
    if (this.isWon()) s.score += 30 + 5 * s.stock.length;
    s.moves += 1;
    return true;
  }

  draw(): boolean {
    const s = this.state;
    if (!s.stock.length) return false;
    this.checkpoint();
    s.waste.push(s.stock.pop()!);
    s.streak = 0;
    s.moves += 1;
    return true;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.state = prev;
    this.state.moves += 1;
    return true;
  }

  /**
   * A slot worth playing, or 'draw', or null when stuck. Prefers the card that keeps the run
   * going longest (a short look-ahead), then cards that uncover others.
   */
  hint(): number | 'draw' | null {
    const options = this.playable();
    if (!options.length) return this.state.stock.length ? 'draw' : null;
    let best = options[0];
    let bestLen = -1;
    for (const i of options) {
      const len = this.runLength(i, new Set());
      const score = len * 10 + (3 - this.state.slots[i].row);
      if (score > bestLen) {
        best = i;
        bestLen = score;
      }
    }
    return best;
  }

  /** Longest run starting with slot `i`, ignoring cards turned up along the way (they're unknown). */
  private runLength(i: number, used: Set<number>, depth = 0): number {
    if (depth > 8) return 0;
    used.add(i);
    const card = this.state.slots[i].card;
    let best = 0;
    this.state.slots.forEach((s, j) => {
      if (used.has(j) || s.gone || !s.up) return;
      if (!LAYOUT[j].coveredBy.every((c) => this.state.slots[c].gone || used.has(c))) return;
      if (adjacent(s.card, card)) best = Math.max(best, this.runLength(j, used, depth + 1));
    });
    used.delete(i);
    return 1 + best;
  }

  private checkpoint(): void {
    this.history.push(structuredClone(this.state));
    if (this.history.length > 300) this.history.shift();
  }
}
