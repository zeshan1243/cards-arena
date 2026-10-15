import { Card, SUITS, Suit } from '../../shared/models/card.model';
import { BotFn, GameAction } from '../core/table-game';
import { chooseTrickCard, isBoss } from '../core/trick-bot';
import { trickWinner } from '../core/tricks';
import { MAX_BID, MIN_BID, TWENTY_NINE_ORDER, TwentyNineView, cardPoints } from './twenty-nine.engine';

const strength = (c: Card) => TWENTY_NINE_ORDER.indexOf(c.rank);

/** Strongest suit: most cards, then most rank strength (ties → first in SUITS order). */
export function chooseTrump(hand: readonly Card[]): Suit {
  let best: Suit = 'spades';
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const score = cards.length * 100 + cards.reduce((n, c) => n + strength(c) + cardPoints(c) * 4, 0);
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return best;
}

/** Highest bid this 4-card hand is worth. */
export function bidLimit(hand: readonly Card[]): number {
  const jacks = hand.filter((c) => c.rank === 'J').length;
  const nines = hand.filter((c) => c.rank === '9').length;
  const aces = hand.filter((c) => c.rank === 'A' || c.rank === '10').length;
  const trump = chooseTrump(hand);
  const len = hand.filter((c) => c.suit === trump).length;
  const trumpTop = hand.some((c) => c.suit === trump && (c.rank === 'J' || c.rank === '9')) ? 1 : 0;
  return 14 + jacks * 2 + nines + (aces > 1 ? 1 : 0) + (len >= 3 ? 2 : len === 2 ? 1 : 0) + trumpTop;
}

export const twentyNineBot: BotFn<TwentyNineView> = (view, legal, _selection, profile, rng) => {
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const partnerId = seatIds[(me + 2) % 4];

  if (view.phase === 'bid') {
    const bids = legal.filter((a) => a.type === 'bid');
    const canPass = legal.some((a) => a.type === 'pass');
    if (!canPass) return { type: 'bid', value: bids[0].value };
    let limit = bidLimit(view.hand);
    if (profile.difficulty === 'easy') limit += Math.floor(rng() * 3) - 1;
    if (profile.personality === 'aggressive' || profile.difficulty === 'expert') limit += 1;
    limit = Math.min(MAX_BID - 4, limit);
    const next = Number(bids[0]?.value ?? MAX_BID + 1);
    // Don't overcall the partner unless clearly stronger.
    const partnerHigh = view.bids[(me + 2) % 4] === view.highBid && view.highBid !== null;
    if (partnerHigh && next + 1 > limit) return { type: 'pass' };
    if (next >= MIN_BID && next <= limit) return { type: 'bid', value: next };
    return { type: 'pass' };
  }

  if (view.phase === 'trump') {
    const suit = profile.difficulty === 'easy' && rng() < 0.25 ? SUITS[Math.floor(rng() * 4)] : chooseTrump(view.hand);
    return { type: 'trump', suit };
  }

  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const trump = view.trumpRevealed ? view.trump?.suit ?? null : null;
  const current = view.trick.length ? trickWinner(view.trick, trump, TWENTY_NINE_ORDER) : null;
  const partnerWinning = current?.playerId === partnerId;

  if (legal.some((a) => a.type === 'reveal-trump')) {
    const trickPts = view.trick.reduce((n, p) => n + cardPoints(p.card), 0);
    const knownTrump = view.trump?.suit ?? null; // only the bidder knows it
    const iHoldTrump = knownTrump === null || view.hand.some((c) => c.suit === knownTrump);
    const wantReveal = !partnerWinning && iHoldTrump && (trickPts >= 1 || toAct.length === 0);
    if (profile.difficulty === 'easy' ? rng() < 0.5 : wantReveal) return { type: 'reveal-trump' };
  }

  const validIds = new Set(legal.filter((a) => a.type === 'play').map((a) => a.cardId));
  const valid = view.hand.filter((c) => validIds.has(c.id));
  const ctx = { hand: view.hand, played: view.played, trick: view.trick };
  const play = (c: Card): GameAction => ({ type: 'play', cardId: c.id });
  const byLowValue = (a: Card, b: Card) => cardPoints(a) - cardPoints(b) || strength(a) - strength(b);

  if (profile.difficulty !== 'easy' && current && valid.length > 1) {
    const partnerSafe = partnerWinning && (toAct.length === 0 || isBoss(current.card, ctx, TWENTY_NINE_ORDER));
    if (partnerSafe) {
      // Feed points to the partner, but keep our own boss cards (and trumps) for later.
      const feed = valid.filter((c) => c.suit !== trump && !isBoss(c, ctx, TWENTY_NINE_ORDER));
      const pool = feed.length ? feed : valid;
      return play([...pool].sort((a, b) => cardPoints(b) - cardPoints(a) || strength(a) - strength(b))[0]);
    }
    const winners = valid.filter((c) => trickWinner([...view.trick, { playerId: view.viewerId, card: c }], trump, TWENTY_NINE_ORDER).playerId === view.viewerId);
    if (!winners.length && !partnerWinning) {
      // Can't win: never throw J/9 to the opponents if avoidable.
      return play([...valid].sort(byLowValue)[0]);
    }
  }

  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid,
      trick: view.trick,
      trump,
      order: TWENTY_NINE_ORDER,
      partnerId,
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
    },
    rng,
  );
  return play(card);
};
