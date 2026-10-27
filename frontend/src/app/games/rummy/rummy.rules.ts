import { Card, Rank, Suit } from '../../shared/models/card.model';

/**
 * Classic Rummy melds. Pure functions, ported to backend/app/games/rummy/engine.py.
 * Aces are low: A-2-3 is a run, Q-K-A is not.
 */

export const RANK_ORDER: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_ORDER: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export type MeldType = 'set' | 'run';

export interface Meld {
  type: MeldType;
  cards: Card[];
}

/** Ace 1 … King 13. */
export const rankValue = (c: Card) => RANK_ORDER.indexOf(c.rank) + 1;
/** Penalty points left in a hand: Ace 1, number cards face value, J/Q/K 10. */
export const cardPoints = (c: Card) => Math.min(10, rankValue(c));
export const handPoints = (cards: readonly Card[]) => cards.reduce((sum, c) => sum + cardPoints(c), 0);

/** Display / meld order: by suit, then rank (Ace low). */
export const bySuitRank = (a: Card, b: Card) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || rankValue(a) - rankValue(b);
const byRank = (a: Card, b: Card) => rankValue(a) - rankValue(b) || SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);

/** The meld these cards form (3–4 of a rank, or a 3+ run in one suit), or null. */
export function classifyMeld(cards: readonly Card[]): Meld | null {
  if (cards.length < 3) return null;
  if (cards.length <= 4 && cards.every((c) => c.rank === cards[0].rank)) return { type: 'set', cards: [...cards].sort(byRank) };
  if (!cards.every((c) => c.suit === cards[0].suit)) return null;
  const sorted = [...cards].sort(byRank);
  return sorted.every((c, i) => rankValue(c) === rankValue(sorted[0]) + i) ? { type: 'run', cards: sorted } : null;
}

/** The meld after adding `cards` to it, or null if they don't fit. */
export function layOff(meld: Meld, cards: readonly Card[]): Meld | null {
  const combined = classifyMeld([...meld.cards, ...cards]);
  return combined && combined.type === meld.type ? combined : null;
}

export function meldLabel(m: Meld): string {
  if (m.type === 'set') return `Set of ${m.cards[0].rank}`;
  return `${m.cards[0].rank}–${m.cards[m.cards.length - 1].rank}${{ spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' }[m.cards[0].suit]}`;
}

/** Every set and run that can be made from `hand` (all sub-runs and all set subsets of size 3–4). */
export function possibleMelds(hand: readonly Card[]): Card[][] {
  const out: Card[][] = [];
  for (const rank of RANK_ORDER) {
    const group = hand.filter((c) => c.rank === rank);
    if (group.length >= 3) out.push([...group]);
    if (group.length === 4) for (let skip = 0; skip < 4; skip++) out.push(group.filter((_, i) => i !== skip));
  }
  for (const suit of SUIT_ORDER) {
    const cards = hand.filter((c) => c.suit === suit).sort(byRank);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 2; j < cards.length; j++) {
        const run = cards.slice(i, j + 1);
        if (classifyMeld(run)?.type === 'run') out.push(run);
      }
    }
  }
  return out;
}

/** Disjoint melds covering the most cards (ties: most points), for bots and hints. */
export function bestMelds(hand: readonly Card[]): Card[][] {
  const options = possibleMelds(hand);
  let best: Card[][] = [];
  let bestScore = 0;
  const score = (ms: Card[][]) => ms.reduce((s, m) => s + m.length * 100 + handPoints(m), 0);
  const search = (start: number, used: Set<string>, chosen: Card[][]) => {
    const sc = score(chosen);
    if (sc > bestScore) {
      bestScore = sc;
      best = [...chosen];
    }
    for (let i = start; i < options.length; i++) {
      const m = options[i];
      if (m.some((c) => used.has(c.id))) continue;
      m.forEach((c) => used.add(c.id));
      chosen.push(m);
      search(i + 1, used, chosen);
      chosen.pop();
      m.forEach((c) => used.delete(c.id));
    }
  };
  search(0, new Set(), []);
  return best;
}
