import { Card, Rank, SUITS, Suit } from '../../shared/models/card.model';
import { Difficulty } from '../../shared/models/game.model';
import { BotFn, GameAction, TrickPlay } from '../core/table-game';
import { chooseTrickCard } from '../core/trick-bot';
import { PLAIN_ORDER, TRUMP_ORDER, BalootView, balootTrickWinner, cardPoints, rankIndex } from './baloot.engine';

// ------------------------------------------------------------------ bidding

/** Sun strength: aces and tens win the points when there are no trumps. */
export function sunStrength(cards: readonly Card[]): number {
  let score = 0;
  for (const c of cards) {
    if (c.rank === 'A') score += 3;
    else if (c.rank === '10') score += cards.some((x) => x.suit === c.suit && x.rank === 'A') ? 2 : 1;
    else if (c.rank === 'K' && cards.some((x) => x.suit === c.suit && (x.rank === 'A' || x.rank === '10'))) score += 1;
  }
  return score;
}

/** Hokm strength with `suit` as trumps: J/9 of trumps, length, and side aces. */
export function hokmStrength(cards: readonly Card[], suit: Suit): number {
  let score = 0;
  for (const c of cards) {
    if (c.suit === suit) {
      score += 1 + (({ J: 4, '9': 3, A: 2, '10': 1 } as Partial<Record<Rank, number>>)[c.rank] ?? 0);
    } else if (c.rank === 'A') score += 1;
  }
  return score;
}

function bid(view: BalootView, legal: GameAction[], difficulty: Difficulty, rng: () => number): GameAction {
  const pass: GameAction = { type: 'pass' };
  const hand = view.hand;
  const buyer = view.buyerCard;
  // The buyer card would join our hand if we buy.
  const withBuyer = buyer ? [...hand, buyer] : [...hand];
  const noise = difficulty === 'easy' ? Math.floor(rng() * 5) - 2 : 0;
  const relax = view.bidRound === 2 ? 1 : 0;
  const me = view.players.findIndex((p) => p.id === view.viewerId);
  const partnerId = view.players[(me + 2) % 4].id;

  const sun = sunStrength(withBuyer) + noise;
  const sunNeeded = (view.hokmBidderId === partnerId ? 11 : 8) - relax;
  if (legal.some((a) => a.value === 'sun') && sun >= sunNeeded) return { type: 'choose', value: 'sun' };

  if (view.hokmBidderId === null) {
    if (view.bidRound === 1 && buyer && legal.some((a) => a.value === 'hokm')) {
      if (hokmStrength(withBuyer, buyer.suit) + noise >= 8) return { type: 'choose', value: 'hokm' };
    } else {
      let best: Suit | null = null;
      let bestScore = -1;
      for (const s of SUITS) {
        if (!legal.some((a) => a.type === 'trump' && a.suit === s)) continue;
        const sc = hokmStrength(hand, s);
        if (sc > bestScore) {
          best = s;
          bestScore = sc;
        }
      }
      if (best && bestScore + noise >= 8 - relax) return { type: 'trump', suit: best };
    }
  }
  return pass;
}

// --------------------------------------------------------------------- play

/**
 * The shared `chooseTrickCard` uses one rank order for every suit. Baloot's trump order
 * differs, so trump cards are mapped to "virtual" ranks (trump position i → PLAIN_ORDER[i])
 * with matching ids; the plain order then ranks every suit correctly.
 */
function virtualize(trump: Suit | null) {
  const back = new Map<string, Card>();
  const v = (c: Card): Card => {
    if (c.suit !== trump) {
      back.set(c.id, c);
      return c;
    }
    const rank = PLAIN_ORDER[TRUMP_ORDER.indexOf(c.rank)];
    const vc = { id: `${c.suit}-${rank}`, suit: c.suit, rank };
    back.set(vc.id, c);
    return vc;
  };
  return { v, back };
}

export const balootBot: BotFn<BalootView> = (view, legal, _selection, profile, rng) => {
  if (view.phase === 'bid') return bid(view, legal, profile.difficulty, rng);

  const trump = view.trumpSuit;
  const validIds = new Set(legal.map((a) => a.cardId));
  const valid = view.hand.filter((c) => validIds.has(c.id));
  if (valid.length === 1) return { type: 'play', cardId: valid[0].id };
  const seatIds = view.players.map((p) => p.id);
  const me = seatIds.indexOf(view.viewerId);
  const partnerId = seatIds[(me + 2) % 4];
  const toAct = Array.from({ length: 3 - view.trick.length }, (_, i) => seatIds[(me + 1 + i) % 4]);
  const smart = profile.difficulty !== 'easy';

  if (smart && view.trick.length) {
    const current = balootTrickWinner(view.trick, trump);
    const winsWith = (c: Card) => balootTrickWinner([...view.trick, { playerId: view.viewerId, card: c }] as TrickPlay[], trump).playerId === view.viewerId;
    // Partner is winning and nobody can overtake (we're last): feed points, keep trumps.
    if (current.playerId === partnerId && toAct.length === 0) {
      const side = valid.filter((c) => c.suit !== trump);
      const pool = side.length ? side : valid;
      const best = [...pool].sort((a, b) => cardPoints(b, trump) - cardPoints(a, trump) || rankIndex(a, trump) - rankIndex(b, trump))[0];
      return { type: 'play', cardId: best.id };
    }
    // Cannot win at all: throw the card worth the least.
    if (current.playerId !== partnerId && !valid.some(winsWith)) {
      const cheapest = [...valid].sort(
        (a, b) => cardPoints(a, trump) - cardPoints(b, trump) || (a.suit === trump ? 1 : 0) - (b.suit === trump ? 1 : 0) || rankIndex(a, trump) - rankIndex(b, trump),
      )[0];
      return { type: 'play', cardId: cheapest.id };
    }
  }

  const { v, back } = virtualize(trump);
  const card = chooseTrickCard(
    {
      myId: view.viewerId,
      hand: view.hand.map(v),
      valid: valid.map(v),
      trick: view.trick.map((p) => ({ playerId: p.playerId, card: v(p.card) })),
      trump,
      order: PLAIN_ORDER,
      partnerId,
      toAct,
      played: view.played.map(v),
      difficulty: profile.difficulty,
    },
    rng,
  );
  return { type: 'play', cardId: back.get(card.id)!.id };
};
