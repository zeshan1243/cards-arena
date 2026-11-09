import { Card } from '../../shared/models/card.model';
import { BotFn, GameAction } from '../core/table-game';
import { DonkeyView, cardValue } from './donkey.engine';

/**
 * Captures: always take, and prefer robbing the leading opponent's pile.
 * Throws: give away as little as possible — a thrown card is worth twice its value to whoever
 * draws its pair. Hard and Expert bots weigh that by how many of the rank are still unseen
 * (a rank with all four out is a free throw); Experts also hold Aces for the end game.
 */
export const donkeyBot: BotFn<DonkeyView> = (view, legal, _selection, profile, rng) => {
  if (legal.length === 1) return legal[0];
  const random = () => legal[Math.floor(rng() * legal.length)];
  const careless = profile.difficulty === 'easy' && rng() < 0.4;

  if (view.phase === 'match') {
    if (careless) return random();
    const score = (value: string | number | undefined) => {
      if (typeof value !== 'string' || !value.startsWith('pile:')) return 0;
      const seat = Number(value.slice(5));
      return 1 + view.totals[seat] + view.roundPoints[seat];
    };
    return [...legal].sort((a, b) => score(b.value) - score(a.value))[0];
  }

  if (view.phase === 'throw' || view.phase === 'play') {
    if (careless) return random();
    const known = [...view.seen, ...view.hand, ...view.piles.flat(), ...(view.active ? [view.active] : [])];
    const unseen = (c: Card) => 4 - new Set(known.filter((k) => k.rank === c.rank).map((k) => k.id)).size;
    const smart = profile.difficulty === 'hard' || profile.difficulty === 'expert';
    // Expected points handed to opponents by throwing `c` (lower is better).
    const risk = (c: Card) => cardValue(c) * (smart ? unseen(c) + 0.5 : 2) + (profile.difficulty === 'expert' && c.rank === 'A' ? 15 : 0);
    const cardOf = (a: GameAction) => [...view.hand, ...(view.active ? [view.active] : [])].find((c) => c.id === a.cardId)!;
    return [...legal].sort((a, b) => risk(cardOf(a)) - risk(cardOf(b)))[0];
  }

  return legal[0];
};
