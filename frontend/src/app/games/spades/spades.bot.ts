import { Card, RANKS, Suit } from '../../shared/models/card.model';
import { Difficulty } from '../../shared/models/game.model';
import { BotFn } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { SpadesView } from './spades.engine';

const SIDE_SUITS: Suit[] = ['hearts', 'clubs', 'diamonds'];
const rankIdx = (c: Card) => RANKS.indexOf(c.rank);

/** Estimated tricks for a hand (integer). Aces, protected kings and spade length. */
export function estimateTricks(hand: readonly Card[], difficulty: Difficulty = 'normal'): number {
  const spades = hand.filter((c) => c.suit === 'spades');
  let tricks = 0;
  // Side suits: aces, protected kings (K with one more card, suit not too long).
  for (const suit of SIDE_SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const has = (r: Card['rank']) => cards.some((c) => c.rank === r);
    if (has('A') && cards.length <= 6) tricks += 1;
    if (has('K') && cards.length >= 2 && cards.length <= 5) tricks += 1;
    if (difficulty !== 'easy' && has('Q') && has('K') && has('A') && cards.length >= 3 && cards.length <= 4) tricks += 1;
    // Ruffing value of short side suits when holding spare spades.
    if (difficulty !== 'easy' && spades.length >= 3 && cards.length <= 1) tricks += cards.length === 0 ? 1 : 0;
  }
  // Spades: top honours plus length beyond three.
  const sp = (r: Card['rank']) => spades.some((c) => c.rank === r);
  if (sp('A')) tricks += 1;
  if (sp('K') && spades.length >= 2) tricks += 1;
  if (sp('Q') && spades.length >= 3) tricks += 1;
  if (spades.length > 3) tricks += spades.length - 3;
  return Math.min(13, tricks);
}

/** A hand weak enough to bid nil: no aces or kings, few low spades. */
export function nilCandidate(hand: readonly Card[]): boolean {
  const spades = hand.filter((c) => c.suit === 'spades');
  if (spades.length > 3 || spades.some((c) => rankIdx(c) >= RANKS.indexOf('J'))) return false;
  if (hand.some((c) => c.rank === 'A' || c.rank === 'K')) return false;
  // Every side suit with a queen needs low cards under it.
  for (const suit of SIDE_SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    if (cards.some((c) => c.rank === 'Q') && cards.length < 3) return false;
  }
  return true;
}

export const spadesBot: BotFn<SpadesView> = (view, legal, _selection, profile, rng) => {
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const partner = (me + 2) % 4;

  if (view.phase === 'bid') {
    const partnerBid = view.bids[partner];
    if (profile.difficulty !== 'easy' && partnerBid !== 0 && nilCandidate(view.hand)) {
      const willing = profile.difficulty === 'normal' ? rng() < 0.5 : partnerBid === null || partnerBid >= 3;
      if (willing) return { type: 'bid', value: 0 };
    }
    let bid = estimateTricks(view.hand, profile.difficulty);
    if (profile.difficulty === 'easy') bid += Math.floor(rng() * 3) - 1;
    // Cover a nil partner a little more aggressively.
    if (partnerBid === 0 && profile.difficulty !== 'easy') bid += 1;
    bid = Math.max(1, Math.min(13, bid));
    return { type: 'bid', value: bid };
  }

  const validIds = new Set(legal.map((a) => a.cardId));
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const myNilAlive = view.bids[me] === 0 && view.tricksTaken[me] === 0;
  const partnerNilAlive = view.bids[partner] === 0 && view.tricksTaken[partner] === 0;
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid: view.hand.filter((c) => validIds.has(c.id)),
      trick: view.trick,
      trump: 'spades',
      // Protecting a partner's nil: treat their card as one to beat.
      partnerId: partnerNilAlive && profile.difficulty !== 'easy' ? null : seatIds[partner],
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
      wantTricks: !myNilAlive,
    },
    rng,
  );
  return { type: 'play', cardId: card.id };
};
