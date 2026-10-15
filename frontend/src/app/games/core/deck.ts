import { Card, RANKS, SUITS, cardId } from '../../shared/models/card.model';

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so games can be replayed from a seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStandardDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: cardId(suit, rank), suit, rank })));
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deal round-robin starting at seat 0. Returns one hand per seat. */
export function dealRoundRobin(deck: readonly Card[], seats: number): Card[][] {
  const hands: Card[][] = Array.from({ length: seats }, () => []);
  deck.forEach((card, i) => hands[i % seats].push(card));
  return hands;
}
