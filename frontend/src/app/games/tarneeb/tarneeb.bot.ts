import { Card, RANKS, SUITS, Suit } from '../../shared/models/card.model';
import { BotFn } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { MAX_BID, MIN_BID, TarneebView } from './tarneeb.engine';

const rankIdx = (c: Card) => RANKS.indexOf(c.rank);

/** Longest suit, ties broken by high-card strength. */
export function chooseTrump(hand: readonly Card[]): Suit {
  let best: Suit = 'spades';
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const score = cards.length * 100 + cards.reduce((n, c) => n + rankIdx(c) + 2, 0);
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Estimated tricks for this player's team, in quarter-tricks.
 * High cards (A = 1, guarded K = ¾, guarded Q = ½), trump length beyond three,
 * short side suits when holding long trumps, plus an allowance for partner.
 */
export function estimateQuarters(hand: readonly Card[], partnerAllowance = 10): number {
  const trump = chooseTrump(hand);
  const trumpLen = hand.filter((c) => c.suit === trump).length;
  let q = 0;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const len = cards.length;
    const has = (r: Card['rank']) => cards.some((c) => c.rank === r);
    if (has('A')) q += 4;
    if (has('K')) q += len >= 2 ? 3 : 1;
    if (has('Q')) q += len >= 3 ? 2 : 0;
    if (suit === trump) {
      if (has('J') && len >= 4) q += 1;
      q += Math.max(0, len - 3) * 4;
    } else if (trumpLen >= 5) {
      if (len === 0) q += 4;
      else if (len === 1) q += 2;
    }
  }
  return q + partnerAllowance;
}

export const tarneebBot: BotFn<TarneebView> = (view, legal, _selection, profile, rng) => {
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const partnerId = seatIds[(me + 2) % 4];

  if (view.phase === 'bid') {
    let q = estimateQuarters(view.hand);
    if (profile.difficulty === 'easy') q += Math.floor(rng() * 9) - 4;
    if (profile.personality === 'aggressive') q += 2;
    if (profile.difficulty === 'expert' || profile.difficulty === 'hard') q += 1;
    const estimate = Math.min(MAX_BID, Math.floor(q / 4));
    const minLegal = Math.max(MIN_BID, view.bid + 1);
    // Don't outbid partner unless clearly stronger.
    const partnerHigh = view.bidderId === partnerId;
    const want = partnerHigh ? estimate - 1 : estimate;
    if (minLegal <= MAX_BID && want >= minLegal && legal.some((a) => a.type === 'bid' && a.value === minLegal)) {
      return { type: 'bid', value: minLegal };
    }
    return { type: 'pass' };
  }

  if (view.phase === 'trump') {
    const suit = profile.difficulty === 'easy' && rng() < 0.25 ? SUITS[Math.floor(rng() * 4)] : chooseTrump(view.hand);
    return { type: 'trump', suit };
  }

  const validIds = new Set(legal.map((a) => a.cardId));
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid: view.hand.filter((c) => validIds.has(c.id)),
      trick: view.trick,
      trump: view.trump?.suit ?? null,
      partnerId,
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
    },
    rng,
  );
  return { type: 'play', cardId: card.id };
};
