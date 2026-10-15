import { Card, SUITS, Suit, rankValue } from '../../shared/models/card.model';
import { BotFn } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { HokmView } from './hokm.engine';

/**
 * Choose trumps from the Hakem's first five cards: the longest suit,
 * ties broken by high-card strength (an Ace or King counts extra).
 */
export function chooseHokm(hand: readonly Card[]): Suit {
  let best: Suit = SUITS[0];
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const score = cards.length * 100 + cards.reduce((n, c) => n + rankValue(c.rank) + (rankValue(c.rank) >= 13 ? 10 : 0), 0);
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return best;
}

export const hokmBot: BotFn<HokmView> = (view, legal, _selection, profile, rng) => {
  if (view.phase === 'trump') {
    const suit = profile.difficulty === 'easy' && rng() < 0.3 ? SUITS[Math.floor(rng() * 4)] : chooseHokm(view.hand);
    return { type: 'trump', suit };
  }
  const validIds = new Set(legal.map((a) => a.cardId));
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid: view.hand.filter((c) => validIds.has(c.id)),
      trick: view.trick,
      trump: view.trump?.suit ?? null,
      partnerId: seatIds[(me + 2) % 4],
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
    },
    rng,
  );
  return { type: 'play', cardId: card.id };
};
