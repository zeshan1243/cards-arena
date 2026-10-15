import { Card, Suit } from '../../shared/models/card.model';
import { Difficulty } from '../../shared/models/game.model';
import { Rng } from './deck';
import { TrickPlay } from './table-game';
import { RankOrder, STANDARD_ORDER, trickWinner } from './tricks';

/**
 * Generic trick-taking card choice, shared by the partnership/trump games.
 * Games pass in what a real player at that seat could know.
 */
export interface TrickContext {
  myId: string;
  hand: readonly Card[];
  /** Cards legal to play right now. */
  valid: readonly Card[];
  trick: readonly TrickPlay[];
  trump: Suit | null;
  order?: RankOrder;
  /** Partner seat id, or null in individual games. */
  partnerId: string | null;
  /** Players still to act after me in this trick. */
  toAct: readonly string[];
  /** Every card already played in earlier tricks of this hand (for card counting). */
  played: readonly Card[];
  difficulty: Difficulty;
  /** true → try to win tricks; false → try to lose them (e.g. Hearts, nil bids). */
  wantTricks?: boolean;
}

export function chooseTrickCard(ctx: TrickContext, rng: Rng): Card {
  const { valid } = ctx;
  if (valid.length === 1) return valid[0];
  if (ctx.difficulty === 'easy' && rng() < 0.4) return valid[Math.floor(rng() * valid.length)];

  const order = ctx.order ?? STANDARD_ORDER;
  const strength = (c: Card) => order.indexOf(c.rank) + (c.suit === ctx.trump ? 100 : 0);
  const asc = [...valid].sort((a, b) => strength(a) - strength(b));
  const lowest = asc[0];
  const highest = asc[asc.length - 1];
  const wantTricks = ctx.wantTricks ?? true;

  if (!wantTricks) return chooseToLose(ctx, asc, order);

  // ----- leading
  if (ctx.trick.length === 0) {
    const counting = ctx.difficulty !== 'easy';
    // Lead a "boss" card (highest outstanding in its suit) from a side suit.
    const boss = asc.filter((c) => c.suit !== ctx.trump && counting && isBoss(c, ctx, order));
    if (boss.length) return boss[boss.length - 1];
    // Otherwise lead low from the longest side suit.
    const side = asc.filter((c) => c.suit !== ctx.trump);
    const pool = side.length ? side : asc;
    const bySuit = new Map<Suit, Card[]>();
    for (const c of pool) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
    let bestSuit: Card[] = [];
    for (const cards of bySuit.values()) if (cards.length > bestSuit.length) bestSuit = cards;
    return bestSuit[0] ?? lowest;
  }

  const current = trickWinner(ctx.trick, ctx.trump, order);
  const partnerWinning = ctx.partnerId !== null && current.playerId === ctx.partnerId;
  const winners = asc.filter((c) => trickWinner([...ctx.trick, { playerId: ctx.myId, card: c }], ctx.trump, order).playerId === ctx.myId);

  // Partner already has it: don't waste a winner unless we're forced.
  if (partnerWinning) {
    const partnerSafe = ctx.toAct.length === 0 || (ctx.difficulty !== 'easy' && isBoss(current.card, ctx, order));
    if (partnerSafe || ctx.difficulty === 'normal') return dumpLow(asc, ctx);
  }

  if (winners.length) {
    // Last to act: win as cheaply as possible. Otherwise win with something that will hold.
    if (ctx.toAct.length === 0) return winners[0];
    const solid = winners.filter((c) => isBoss(c, ctx, order) || c.suit === ctx.trump);
    return (solid.length ? solid : winners)[0];
  }
  return dumpLow(asc, ctx);

  function dumpLow(cards: Card[], c: TrickContext): Card {
    // Prefer discarding a low side-suit card over a trump.
    const side = cards.filter((x) => x.suit !== c.trump);
    return side[0] ?? cards[0] ?? highest;
  }
}

/** Avoid winning: play the highest card that still loses, else the lowest card. */
function chooseToLose(ctx: TrickContext, asc: Card[], order: RankOrder): Card {
  if (ctx.trick.length === 0) return asc[0];
  const losers = asc.filter((c) => trickWinner([...ctx.trick, { playerId: ctx.myId, card: c }], ctx.trump, order).playerId !== ctx.myId);
  if (losers.length) return losers[losers.length - 1];
  return ctx.toAct.length === 0 ? asc[asc.length - 1] : asc[0];
}

/** True if no unplayed card of the same suit outranks `card` (from this seat's knowledge). */
export function isBoss(card: Card, ctx: Pick<TrickContext, 'played' | 'hand' | 'trick'>, order: RankOrder): boolean {
  const seen = new Set([...ctx.played, ...ctx.hand, ...ctx.trick.map((p) => p.card)].map((c) => c.id));
  const higher = order.slice(order.indexOf(card.rank) + 1);
  return higher.every((r) => seen.has(`${card.suit}-${r}`));
}
