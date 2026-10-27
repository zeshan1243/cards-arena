import { Card } from '../../shared/models/card.model';
import { BotFn, GameAction } from '../core/table-game';
import { RummyView } from './rummy.engine';
import { Meld, bestMelds, cardPoints, layOff, rankValue } from './rummy.rules';

/** Cards that could become a meld with this one: same rank, or same suit within two ranks. */
const partners = (c: Card, hand: readonly Card[]) =>
  hand.filter((o) => o.id !== c.id && (o.rank === c.rank || (o.suit === c.suit && Math.abs(rankValue(o) - rankValue(c)) <= 2))).length;

const tableMelds = (view: RummyView): Meld[] => view.melds.map((m) => ({ type: m.type, cards: m.cards }));
const fitsTable = (card: Card, melds: Meld[]) => melds.some((m) => layOff(m, [card]) !== null);

export const rummyBot: BotFn<RummyView> = (view, legal, _selection, profile, rng) => {
  const hand = view.hand;
  const melds = tableMelds(view);
  const careless = profile.difficulty === 'easy' && rng() < 0.35;

  if (view.phase === 'draw') {
    const top = view.discardTop;
    const canStock = legal.some((a) => a.value === 'stock');
    // Take the discard when it completes a meld or fits one on the table.
    const useful = top && !careless && (bestMelds([...hand, top]).some((m) => m.includes(top)) || fitsTable(top, melds));
    return { type: 'draw', value: useful || !canStock ? 'discard' : 'stock' };
  }

  // Lay down the best melds, then lay off whatever fits, then discard.
  const own = bestMelds(hand);
  if (own.length && !careless) return { type: 'meld', cardIds: own[0].map((c) => c.id) };
  const layable = hand.find((c) => fitsTable(c, melds));
  if (layable && !careless) return { type: 'lay-off', cardIds: [layable.id] };

  const options = hand.filter((c) => c.id !== view.takenFromDiscard || hand.length === 1);
  if (profile.difficulty === 'easy' && rng() < 0.3) return discard(options[Math.floor(rng() * options.length)]);
  // Throw the card that is worth most and least likely to join a meld; experts also avoid
  // feeding the table (cards opponents could lay off).
  const keep = (c: Card) =>
    partners(c, hand) * 7 - cardPoints(c) + (profile.difficulty === 'expert' && fitsTable(c, melds) ? 12 : 0);
  return discard([...options].sort((a, b) => keep(a) - keep(b) || rankValue(b) - rankValue(a))[0]);
};

const discard = (c: Card): GameAction => ({ type: 'discard', cardId: c.id });
