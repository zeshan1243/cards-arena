import { Card, RANKS, SUITS } from '../../shared/models/card.model';
import { Rng } from '../core/deck';
import { BotFn } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { trickWinner } from '../core/tricks';
import { HeartsView, QUEEN_ID } from './hearts.engine';

const rankIdx = (c: Card) => RANKS.indexOf(c.rank); // 0 (two) … 12 (ace)

/** How badly we want to get rid of a card when passing (higher = pass first). */
export function passDanger(card: Card, hand: readonly Card[]): number {
  const suitLen = hand.filter((c) => c.suit === card.suit).length;
  const r = rankIdx(card);
  if (card.suit === 'spades') {
    if (card.rank === 'Q') return 200;
    if (card.rank === 'A' || card.rank === 'K') {
      // Long spades protect the high ones; short spades make them dangerous.
      const lowSpades = hand.filter((c) => c.suit === 'spades' && rankIdx(c) < 10).length;
      return lowSpades >= 4 ? 40 + r : 150 + r;
    }
    return r - 20; // low spades guard against the queen — keep them
  }
  if (card.suit === 'hearts') return 30 + r * 6;
  // Clubs / diamonds: high cards are risky, short suits are worth voiding.
  return r * 4 + (suitLen <= 3 ? 30 - suitLen * 5 : 0);
}

export function choosePass(hand: readonly Card[], difficulty: string, rng: Rng): string[] {
  if (difficulty === 'easy' && rng() < 0.5) {
    const pool = [...hand];
    const out: string[] = [];
    for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
    return out;
  }
  return [...hand]
    .sort((a, b) => passDanger(b, hand) - passDanger(a, hand) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || rankIdx(b) - rankIdx(a))
    .slice(0, 3)
    .map((c) => c.id);
}

export const heartsBot: BotFn<HeartsView> = (view, legal, selection, profile, rng) => {
  if (selection) return { type: selection.actionType, cardIds: choosePass(view.hand, profile.difficulty, rng) };

  const validIds = new Set(legal.map((a) => a.cardId));
  const valid = view.hand.filter((c) => validIds.has(c.id));
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const play = (c: Card): { type: 'play'; cardId: string } => ({ type: 'play', cardId: c.id });

  if (valid.length > 1 && profile.difficulty !== 'easy') {
    const smart = heartsSense(view, valid, toAct.length);
    if (smart) return play(smart);
  }
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand,
      valid,
      trick: view.trick,
      trump: null,
      partnerId: null,
      toAct,
      played: view.played,
      difficulty: profile.difficulty,
      wantTricks: false,
    },
    rng,
  );
  return play(card);
};

/** Hearts-specific choices layered on top of the generic "lose tricks" logic. Null = no opinion. */
function heartsSense(view: HeartsView, valid: Card[], toAct: number): Card | null {
  const queenOut = !view.played.some((c) => c.id === QUEEN_ID) && !view.trick.some((p) => p.card.id === QUEEN_ID);
  const holdQueen = view.hand.some((c) => c.id === QUEEN_ID);
  const desc = [...valid].sort((a, b) => rankIdx(b) - rankIdx(a));

  // Leading.
  if (view.trick.length === 0) {
    // Flush out the queen with low spades when we hold no high spade.
    if (queenOut && !holdQueen && !view.hand.some((c) => c.suit === 'spades' && rankIdx(c) >= 11)) {
      const lowSpade = [...valid].filter((c) => c.suit === 'spades').sort((a, b) => rankIdx(a) - rankIdx(b))[0];
      if (lowSpade) return lowSpade;
    }
    // Avoid leading high spades while the queen is out.
    if (queenOut) {
      const safe = valid.filter((c) => !(c.suit === 'spades' && rankIdx(c) >= 10));
      if (safe.length && safe.length < valid.length) return [...safe].sort((a, b) => rankIdx(a) - rankIdx(b))[0];
    }
    return null;
  }

  const lead = view.trick[0].card.suit;
  const following = valid.some((c) => c.suit === lead);
  if (!following) {
    // Void: dump the queen, then high spades while she is out, then the highest heart, then the highest card.
    const queen = valid.find((c) => c.id === QUEEN_ID);
    if (queen) return queen;
    if (queenOut && !holdQueen) {
      const bigSpade = desc.find((c) => c.suit === 'spades' && rankIdx(c) >= 11);
      if (bigSpade) return bigSpade;
    }
    const heart = desc.find((c) => c.suit === 'hearts');
    if (heart) return heart;
    return desc[0];
  }

  // Following spades while holding the queen: drop her under a higher spade.
  if (lead === 'spades' && holdQueen) {
    const highOnTable = view.trick.some((p) => p.card.suit === 'spades' && rankIdx(p.card) > 10);
    const queen = valid.find((c) => c.id === QUEEN_ID);
    if (highOnTable && queen) return queen;
    if (queen) {
      const others = valid.filter((c) => c.id !== QUEEN_ID);
      const losers = others.filter((c) => trickWinner([...view.trick, { playerId: view.viewerId, card: c }], null).playerId !== view.viewerId);
      if (losers.length) return losers.sort((a, b) => rankIdx(b) - rankIdx(a))[0];
      if (others.length) return others.sort((a, b) => rankIdx(a) - rankIdx(b))[0];
    }
  }
  // Last to play a clean trick that we must win anyway: win with the highest (shed danger).
  const points = view.trick.some((p) => p.card.suit === 'hearts' || p.card.id === QUEEN_ID);
  if (toAct === 0 && !points) {
    const losers = valid.filter((c) => trickWinner([...view.trick, { playerId: view.viewerId, card: c }], null).playerId !== view.viewerId);
    if (!losers.length) {
      const safe = desc.filter((c) => c.id !== QUEEN_ID);
      return safe[0] ?? null;
    }
  }
  return null;
}
