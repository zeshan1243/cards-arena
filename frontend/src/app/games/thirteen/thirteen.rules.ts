import { Card, Rank, Suit } from '../../shared/models/card.model';
import { SUIT_GLYPH } from '../core/tricks';

/**
 * Thirteen (Tiến Lên) card order and combinations. Pure functions, ported to
 * backend/app/games/thirteen/engine.py — keep both in step.
 *
 * Ranks run 3 (low) … A, 2 (high). Suits break ties: ♠ < ♣ < ♦ < ♥.
 */

export const RANK_ORDER: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUIT_ORDER: readonly Suit[] = ['spades', 'clubs', 'diamonds', 'hearts'];

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'run' | 'pairs-run';

export interface Combo {
  type: ComboType;
  /** Number of cards. */
  size: number;
  /** Power of the highest card; decides between combos of the same type and size. */
  top: number;
}

export const rankIndex = (c: Card) => RANK_ORDER.indexOf(c.rank);
/** 0 (3♠) … 51 (2♥). */
export const power = (c: Card) => rankIndex(c) * 4 + SUIT_ORDER.indexOf(c.suit);
export const byPower = (a: Card, b: Card) => power(a) - power(b);
const TWO = RANK_ORDER.indexOf('2');

/** The combination these cards form, or null if they don't form one. */
export function classify(cards: readonly Card[]): Combo | null {
  const n = cards.length;
  if (!n) return null;
  const sorted = [...cards].sort(byPower);
  const ranks = sorted.map(rankIndex);
  const top = power(sorted[n - 1]);
  if (ranks.every((r) => r === ranks[0])) {
    const type = (['single', 'pair', 'triple', 'quad'] as const)[n - 1];
    return type ? { type, size: n, top } : null;
  }
  if (ranks[n - 1] === TWO) return null; // 2s never sit in a run
  if (n >= 3 && ranks.every((r, i) => r === ranks[0] + i)) return { type: 'run', size: n, top };
  if (n >= 6 && n % 2 === 0 && ranks.every((r, i) => r === ranks[0] + Math.floor(i / 2))) return { type: 'pairs-run', size: n, top };
  return null;
}

/** Can `play` be laid on top of `table`? Same shape and higher, or a bomb on 2s. */
export function beats(play: Combo, table: Combo): boolean {
  if (play.type === table.type && play.size === table.size) return play.top > table.top;
  const pairs = play.type === 'pairs-run' ? play.size / 2 : 0;
  const twos = Math.floor(table.top / 4) === TWO;
  if (twos && table.type === 'single') return play.type === 'quad' || pairs >= 3;
  if (twos && table.type === 'pair') return pairs >= 4;
  if (twos && table.type === 'triple') return pairs >= 5;
  if (table.type === 'pairs-run' && table.size === 6) return play.type === 'quad';
  if (table.type === 'quad') return pairs >= 4;
  return false;
}

export function comboLabel(cards: readonly Card[]): string {
  const combo = classify(cards);
  if (!combo) return '';
  const sorted = [...cards].sort(byPower);
  const hi = sorted[sorted.length - 1];
  const glyph = `${hi.rank}${SUIT_GLYPH[hi.suit]}`;
  switch (combo.type) {
    case 'single':
      return glyph;
    case 'pair':
      return `Pair of ${hi.rank}s`;
    case 'triple':
      return `Three ${hi.rank}s`;
    case 'quad':
      return `Four ${hi.rank}s — bomb!`;
    case 'run':
      return `Run ${sorted[0].rank}–${hi.rank}`;
    case 'pairs-run':
      return `${combo.size / 2} pairs ${sorted[0].rank}–${hi.rank}`;
  }
}

/**
 * Every distinct play from `hand` that may be laid on `table` (null = leading).
 * For runs only the top card matters, so lower ranks use their lowest cards; the
 * list is complete up to that equivalence. Used by the bot.
 */
export function enumeratePlays(hand: readonly Card[], table: Combo | null, mustInclude: string | null = null): Card[][] {
  const byRank: Card[][] = RANK_ORDER.map(() => []);
  for (const c of [...hand].sort(byPower)) byRank[rankIndex(c)].push(c);
  const out: Card[][] = [];

  for (const group of byRank) {
    for (const size of [1, 2, 3, 4]) out.push(...subsets(group, size));
  }
  // Runs (width 1) and runs of pairs (width 2), at least 3 ranks long, never through 2.
  for (const width of [1, 2]) {
    for (let start = 0; start < TWO; start++) {
      for (let len = 3; start + len <= TWO; len++) {
        const ranks = byRank.slice(start, start + len);
        if (ranks.some((g) => g.length < width)) break;
        const base = ranks.slice(0, -1).flatMap((g) => g.slice(0, width));
        for (const topPick of subsets(ranks[len - 1], width)) out.push([...base, ...topPick]);
      }
    }
  }
  return out.filter((cards) => {
    if (mustInclude && !cards.some((c) => c.id === mustInclude)) return false;
    const combo = classify(cards);
    return combo !== null && (table === null || beats(combo, table));
  });
}

function subsets<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...subsets(rest, k - 1).map((s) => [first, ...s]), ...subsets(rest, k)];
}
