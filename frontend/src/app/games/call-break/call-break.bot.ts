import { Card, SUITS } from '../../shared/models/card.model';
import { BotFn } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { CallBreakView, MAX_CALL, MIN_CALL, TRUMP } from './call-break.engine';

/**
 * Estimate tricks a hand should win, in quarters of a trick (to stay in integers).
 * Spades: A/K/Q are winners when guarded; every spade beyond the third is a likely winner.
 * Side suits: Aces win, Kings usually win when the suit is not too long, short side suits
 * let spare spades ruff.
 */
export function estimateCall(hand: readonly Card[]): number {
  const bySuit = (s: string) => hand.filter((c) => c.suit === s);
  const spades = bySuit(TRUMP);
  const has = (cards: Card[], r: string) => cards.some((c) => c.rank === r);
  let q = 0;
  // Trumps.
  if (has(spades, 'A')) q += 4;
  if (has(spades, 'K')) q += spades.length >= 2 ? 4 : 1;
  if (has(spades, 'Q')) q += spades.length >= 3 ? 3 : 1;
  if (has(spades, 'J')) q += spades.length >= 4 ? 2 : 0;
  q += Math.max(0, spades.length - 3) * 3;
  // Side suits.
  let spareTrumps = Math.max(0, spades.length - 2);
  for (const suit of SUITS) {
    if (suit === TRUMP) continue;
    const cards = bySuit(suit);
    if (has(cards, 'A')) q += cards.length <= 5 ? 4 : 3;
    if (has(cards, 'K')) q += cards.length >= 2 && cards.length <= 4 ? 3 : 1;
    if (has(cards, 'Q') && cards.length >= 3 && cards.length <= 4) q += 1;
    // Ruffing potential from short suits.
    const ruffs = cards.length === 0 ? 2 : cards.length === 1 ? 1 : 0;
    const used = Math.min(ruffs, spareTrumps);
    spareTrumps -= used;
    q += used * 3;
  }
  const tricks = Math.floor((q + 2) / 4);
  return Math.min(MAX_CALL, Math.max(MIN_CALL, tricks));
}

export const callBreakBot: BotFn<CallBreakView> = (view, legal, _selection, profile, rng) => {
  const me = view.players.findIndex((p) => p.id === view.viewerId);

  if (view.phase === 'bid') {
    let call = estimateCall(view.hand);
    if (profile.difficulty === 'easy') call += Math.floor(rng() * 3) - 1;
    else if (profile.difficulty === 'normal' && rng() < 0.25) call += rng() < 0.5 ? -1 : 1;
    call = Math.min(MAX_CALL, Math.max(MIN_CALL, call));
    return { type: 'bid', value: call };
  }

  const validIds = new Set(legal.map((a) => a.cardId));
  const seatIds = view.players.map((p) => p.id);
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid: view.hand.filter((c) => validIds.has(c.id)),
      trick: view.trick,
      trump: TRUMP,
      partnerId: null,
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
      // Aim for exactly the call: once it is made, try to shed tricks.
      // Overtricks still score +0.1 each, so keep winning once the call is made.
      wantTricks: true,
    },
    rng,
  );
  return { type: 'play', cardId: card.id };
};
