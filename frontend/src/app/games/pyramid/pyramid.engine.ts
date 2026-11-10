import { Card } from '../../shared/models/card.model';
import { createStandardDeck, seededRng, shuffle } from '../core/deck';
import { value } from '../solitaire/solitaire.engine';

/**
 * Pyramid solitaire. 28 cards are dealt face up in a pyramid of seven rows; each card is covered
 * by the two cards below it. Remove pairs of uncovered cards whose values add up to 13
 * (Ace 1, Jack 11, Queen 12) and Kings on their own. The top card of the waste can pair too, and a
 * card may pair with the one card still covering it. Turn stock cards onto the waste one at a time;
 * the waste can be turned back into the stock for a limited number of passes. Clear the pyramid to win.
 *
 * Scoring: 5 points per pair (or King) removed, 25 for each pyramid row cleared, and 250 for
 * clearing the whole pyramid plus 10 for every stock and waste card left over.
 */

export const ROWS = 7;
export const PYRAMID_CARDS = 28;
export type Passes = 1 | 3 | 0; // 0 = unlimited

export interface Slot {
  card: Card;
  row: number;
  /** Position in its row, 0-based. */
  col: number;
  gone: boolean;
}

export interface PyramidState {
  slots: Slot[];
  stock: Card[];
  waste: Card[];
  /** Passes through the stock started so far (1 at the start). */
  pass: number;
  score: number;
  moves: number;
  pairs: number;
}

export const indexOf = (row: number, col: number) => (row * (row + 1)) / 2 + col;
/** The two slots covering slot `i` (none on the bottom row). */
export const coveredBy = (i: number, slots: Slot[]) => {
  const { row, col } = slots[i];
  return row === ROWS - 1 ? [] : [indexOf(row + 1, col), indexOf(row + 1, col + 1)];
};

export class PyramidEngine {
  private state: PyramidState;
  private history: PyramidState[] = [];

  constructor(readonly seed: number, readonly passes: Passes = 3) {
    const deck = shuffle(createStandardDeck(), seededRng(seed));
    const slots: Slot[] = [];
    for (let row = 0; row < ROWS; row++) for (let col = 0; col <= row; col++) slots.push({ card: deck[slots.length], row, col, gone: false });
    this.state = { slots, stock: deck.slice(PYRAMID_CARDS), waste: [], pass: 1, score: 0, moves: 0, pairs: 0 };
  }

  get view(): PyramidState {
    return structuredClone(this.state);
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  isWon(): boolean {
    return this.state.slots.every((s) => s.gone);
  }

  /** Can the waste be turned back into the stock? */
  canRecycle(): boolean {
    const s = this.state;
    return !s.stock.length && s.waste.length > 0 && (this.passes === 0 || s.pass < this.passes);
  }

  /** Lost: no pairs, no Kings, and no stock or passes left. */
  isStuck(): boolean {
    return !this.isWon() && !this.state.stock.length && !this.canRecycle() && this.moves().length === 0;
  }

  /** Uncovered pyramid slots. */
  free(): number[] {
    const s = this.state.slots;
    return s.flatMap((slot, i) => (!slot.gone && coveredBy(i, s).every((c) => s[c].gone) ? [i] : []));
  }

  /** Card ids that can be picked right now: uncovered pyramid cards and the waste top. */
  available(): string[] {
    const ids = this.free().map((i) => this.state.slots[i].card.id);
    const top = this.wasteTop();
    return top ? [...ids, top.id] : ids;
  }

  wasteTop(): Card | undefined {
    return this.state.waste[this.state.waste.length - 1];
  }

  /** Is removing `ids` (a King, or two cards adding to 13) legal now? */
  canRemove(ids: string[]): boolean {
    const cards = ids.map((id) => this.find(id));
    if (cards.some((c) => !c)) return false;
    if (ids.length === 1) return value(cards[0]!.card) === 13 && this.reachable(ids[0], []);
    if (ids.length !== 2 || ids[0] === ids[1]) return false;
    if (value(cards[0]!.card) + value(cards[1]!.card) !== 13) return false;
    return this.reachable(ids[0], [ids[1]]) && this.reachable(ids[1], [ids[0]]);
  }

  /** Every legal removal, as card-id lists. */
  moves(): string[][] {
    const out: string[][] = [];
    const ids = this.selectable();
    for (const a of ids) if (this.canRemove([a])) out.push([a]);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (this.canRemove([ids[i], ids[j]])) out.push([ids[i], ids[j]]);
    return out;
  }

  // ----------------------------------------------------------------- moves

  remove(ids: string[]): boolean {
    if (!this.canRemove(ids)) return false;
    this.checkpoint();
    const s = this.state;
    const rowsBefore = this.clearedRows();
    for (const id of ids) {
      const slot = s.slots.find((x) => !x.gone && x.card.id === id);
      if (slot) slot.gone = true;
      else s.waste.pop();
    }
    s.pairs += 1;
    s.score += 5 + 25 * (this.clearedRows() - rowsBefore);
    if (this.isWon()) s.score += 250 + 10 * (s.stock.length + s.waste.length);
    s.moves += 1;
    return true;
  }

  /** Turn the next stock card onto the waste, or turn the waste back over when the stock is empty. */
  draw(): boolean {
    const s = this.state;
    if (s.stock.length) {
      this.checkpoint();
      s.waste.push(s.stock.pop()!);
    } else if (this.canRecycle()) {
      this.checkpoint();
      s.stock = s.waste.reverse();
      s.waste = [];
      s.pass += 1;
    } else {
      return false;
    }
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
   * A move worth making: removals that clear pyramid cards first (deeper rows first, then ones that
   * uncover the most), then waste pairs; otherwise 'draw', or null when stuck.
   */
  hint(): string[] | 'draw' | null {
    const moves = this.moves();
    if (moves.length) {
      const worth = (m: string[]) => {
        const slots = m.map((id) => this.state.slots.find((x) => !x.gone && x.card.id === id));
        // Pyramid cards count most, higher up (lower row number) counts more: they block nothing below.
        return slots.reduce((t, sl) => t + (sl ? 10 + (ROWS - sl.row) : 1), 0);
      };
      return [...moves].sort((a, b) => worth(b) - worth(a))[0];
    }
    return this.state.stock.length || this.canRecycle() ? 'draw' : null;
  }

  // -------------------------------------------------------------- internals

  private find(id: string): { card: Card; slot?: number } | null {
    const i = this.state.slots.findIndex((x) => !x.gone && x.card.id === id);
    if (i >= 0) return { card: this.state.slots[i].card, slot: i };
    const top = this.wasteTop();
    return top?.id === id ? { card: top } : null;
  }

  /** Cards that may take part in a removal: the waste top, free pyramid cards, and cards with one cover left (to pair with it). */
  selectable(): string[] {
    const s = this.state.slots;
    const ids = s.flatMap((slot, i) => (!slot.gone && coveredBy(i, s).filter((c) => !s[c].gone).length <= 1 ? [slot.card.id] : []));
    const top = this.wasteTop();
    return top ? [...ids, top.id] : ids;
  }

  /** `id` is the waste top, or a pyramid card whose live covers are all in `others`. */
  private reachable(id: string, others: string[]): boolean {
    const f = this.find(id);
    if (!f) return false;
    if (f.slot === undefined) return true;
    const s = this.state.slots;
    return coveredBy(f.slot, s).every((c) => s[c].gone || others.includes(s[c].card.id));
  }

  private clearedRows(): number {
    let n = 0;
    for (let row = 0; row < ROWS; row++) if (this.state.slots.filter((x) => x.row === row).every((x) => x.gone)) n++;
    return n;
  }

  private checkpoint(): void {
    this.history.push(structuredClone(this.state));
    if (this.history.length > 400) this.history.shift();
  }
}
