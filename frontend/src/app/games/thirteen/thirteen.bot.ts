import { Card } from '../../shared/models/card.model';
import { BotFn, GameAction } from '../core/table-game';
import { ThirteenView } from './thirteen.engine';
import { RANK_ORDER, classify, enumeratePlays, power, rankIndex } from './thirteen.rules';

const TWO = RANK_ORDER.indexOf('2');
const play = (cards: readonly Card[]): GameAction => ({ type: 'play', cardIds: cards.map((c) => c.id) });
const PASS: GameAction = { type: 'pass' };

const precious = (cards: readonly Card[]) => {
  const type = classify(cards)!.type;
  return type === 'quad' || type === 'pairs-run' || cards.some((x) => rankIndex(x) === TWO);
};

/** How much a play wastes: high cards, 2s, bombs and broken pairs/triples cost more. */
function cost(cards: readonly Card[], hand: readonly Card[], careful: boolean): number {
  const combo = classify(cards)!;
  let c = combo.top;
  if (cards.some((x) => rankIndex(x) === TWO)) c += 20;
  if (combo.type === 'quad' || combo.type === 'pairs-run') c += 40;
  if (careful) {
    const used = new Map<number, number>();
    for (const x of cards) used.set(rankIndex(x), (used.get(rankIndex(x)) ?? 0) + 1);
    for (const [rank, n] of used) if (hand.filter((x) => rankIndex(x) === rank).length > n) c += 8;
  }
  return c;
}

export const thirteenBot: BotFn<ThirteenView> = (view, legal, _selection, profile, rng) => {
  const hand = view.hand;
  const table = view.table?.combo ?? null;
  const options = enumeratePlays(hand, table, view.mustInclude);
  const canPass = legal.some((a) => a.type === 'pass');
  if (!options.length) return PASS;

  const finisher = options.find((o) => o.length === hand.length);
  if (finisher) return play(finisher);

  const { difficulty } = profile;
  if (difficulty === 'easy' && rng() < 0.35) {
    if (canPass && rng() < 0.4) return PASS;
    return play(options[Math.floor(rng() * options.length)]);
  }

  const careful = difficulty !== 'easy';
  const opponents = view.players.filter((p) => p.id !== view.viewerId && p.cardCount > 0);
  const danger = opponents.some((p) => p.cardCount <= 3);

  if (!table) {
    // Lead: shed the lowest card, taking as many cards with it as possible.
    const lowest = hand.reduce((a, b) => (power(a) <= power(b) ? a : b));
    let pool = options.filter((o) => o.includes(lowest) && !precious(o));
    if (!pool.length) pool = options;
    // Expert: someone is down to one card — never lead a single you can avoid.
    if (difficulty === 'expert' && opponents.some((p) => p.cardCount === 1)) {
      const multi = options.filter((o) => o.length > 1);
      if (multi.length) pool = multi;
      else return play([hand[hand.length - 1]]);
    }
    pool.sort((a, b) => b.length - a.length || cost(a, hand, careful) - cost(b, hand, careful));
    return play(pool[0]);
  }

  const ranked = [...options].sort((a, b) => cost(a, hand, careful) - cost(b, hand, careful));
  const best = ranked[0];
  const expensive = precious(best);
  // Hold 2s and bombs back unless someone is about to go out or our hand is nearly empty.
  if (canPass && expensive && !danger && hand.length > 4 && difficulty !== 'normal') return PASS;
  if (canPass && expensive && !danger && difficulty === 'normal' && rng() < 0.6) return PASS;
  return play(best);
};
