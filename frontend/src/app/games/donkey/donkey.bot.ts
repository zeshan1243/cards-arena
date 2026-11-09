import { Card } from '../../shared/models/card.model';
import { BotFn, LegalAction } from '../core/table-game';
import { DonkeyView, cardValue } from './donkey.engine';

/**
 * Captures: always capture when possible — the most valuable card first, robbing the leading
 * opponent before the table, and the table before your own pile.
 * Throws: give away as little as possible — a thrown card is worth twice its value to whoever
 * pairs it. Hard and Expert bots weigh that by how many of the rank are still unseen (a rank
 * with all four out is a free throw); Experts also hold Aces for the end game.
 */
export const donkeyBot: BotFn<DonkeyView> = (view, legal, _selection, profile, rng) => {
  if (legal.length === 1) return legal[0];
  const random = () => legal[Math.floor(rng() * legal.length)];
  const careless = profile.difficulty === 'easy' && rng() < 0.4;
  if (careless) return random();

  const cardOf = (a: LegalAction) => view.hand.find((c) => c.id === a.cardId)!;
  const captures = legal.filter((a) => a.value !== undefined);
  if (captures.length) {
    const me = view.players.findIndex((p) => p.id === view.viewerId);
    const where = (value: string | number | undefined) => {
      if (typeof value !== 'string' || !value.startsWith('pile:')) return 0;
      const seat = Number(value.slice(5));
      return seat === me ? -1 : 1 + (view.totals[seat] + view.roundPoints[seat]) / 1000;
    };
    return [...captures].sort((a, b) => cardValue(cardOf(b)) - cardValue(cardOf(a)) || where(b.value) - where(a.value))[0];
  }

  const known = [...view.seen, ...view.hand, ...view.piles.flat()];
  const unseen = (c: Card) => 4 - new Set(known.filter((k) => k.rank === c.rank).map((k) => k.id)).size;
  const smart = profile.difficulty === 'hard' || profile.difficulty === 'expert';
  // Expected points handed to opponents by throwing `c` (lower is better).
  const risk = (c: Card) => cardValue(c) * (smart ? unseen(c) + 0.5 : 2) + (profile.difficulty === 'expert' && c.rank === 'A' ? 15 : 0);
  return [...legal].sort((a, b) => risk(cardOf(a)) - risk(cardOf(b)))[0];
};
