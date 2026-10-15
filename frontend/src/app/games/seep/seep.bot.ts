import { Card } from '../../shared/models/card.model';
import { BotFn, FloorPile, GameAction, LegalAction } from '../core/table-game';
import { SeepView, cardPoints, cardValue } from './seep.engine';

/** Value of a floor pile: a loose card's value, or the house value. */
function pileValue(view: SeepView, pile: FloorPile): number {
  if (!pile.label) return cardValue(pile.cards[0]);
  return view.houses.find((h) => h.id === pile.id)?.value ?? 0;
}

const pilePoints = (pile: FloorPile) => pile.cards.reduce((s, c) => s + cardPoints(c), 0);

/** Rough danger that the next opponent can sweep a floor made of these piles. */
function seepRisk(view: SeepView, piles: FloorPile[]): number {
  if (!piles.length) return 0;
  const total = piles.reduce((s, p) => s + pileValue(view, p), 0);
  if (total > 13) return 0;
  // A single house can only be taken with its exact value; loose cards sum to something capturable.
  return piles.length === 1 ? 25 : 18;
}

function scoreAction(view: SeepView, a: LegalAction, hand: Card[]): number {
  const card = hand.find((c) => c.id === a.cardId)!;
  const value = String(a.value);
  const [kind, ...rest] = value.split(':');
  const floor = view.floor ?? [];
  const playedPts = cardPoints(card);

  if (kind === 'capture') {
    const ids = new Set(rest[0].split(','));
    const taken = floor.filter((p) => ids.has(p.id));
    const left = floor.filter((p) => !ids.has(p.id));
    let s = 10 + playedPts + taken.reduce((n, p) => n + pilePoints(p) + p.cards.length, 0);
    if (a.label.includes('Seep')) s += 80;
    s -= seepRisk(view, left);
    return s;
  }
  if (kind === 'build' || kind === 'add') {
    const total = Number(kind === 'build' ? rest[0] : rest[1]);
    const ids = new Set((kind === 'build' ? rest[1] : rest[2]).split(',').filter(Boolean));
    const used = floor.filter((p) => ids.has(p.id));
    const house = kind === 'add' ? floor.find((p) => p.id === rest[0]) : undefined;
    const inHouse = used.reduce((n, p) => n + pilePoints(p), playedPts) + (house ? pilePoints(house) : 0);
    // Building secures points for a later capture; cementing (pakka) is safer than kacha.
    const pakka = kind === 'add' && house && total === pileValue(view, house);
    const holders = hand.filter((c) => c.id !== card.id && cardValue(c) === total).length;
    return 6 + inHouse + (pakka ? 4 : 0) + holders * 2 + used.length;
  }
  // throw
  const left = [...floor, { id: card.id, cards: [card], label: null }];
  return -playedPts * 2 - seepRisk(view, left) - (cardValue(card) >= 9 ? 2 : 0) + (13 - cardValue(card)) / 13;
}

export const seepBot: BotFn<SeepView> = (view, legal, _selection, profile, rng): GameAction => {
  const pick = (a: LegalAction): GameAction => {
    const out: GameAction = { type: a.type };
    if (a.cardId !== undefined) out.cardId = a.cardId;
    if (a.value !== undefined) out.value = a.value;
    return out;
  };
  if (view.phase === 'bid') {
    if (profile.difficulty === 'easy' && rng() < 0.4) return pick(legal[Math.floor(rng() * legal.length)]);
    // Bid the value we hold most of, preferring higher values.
    let best = legal[0];
    let bestScore = -1;
    for (const a of legal) {
      const v = Number(a.value);
      const s = view.hand.filter((c) => cardValue(c) === v).length * 20 + v;
      if (s > bestScore) {
        best = a;
        bestScore = s;
      }
    }
    return pick(best);
  }
  const randomness = profile.difficulty === 'easy' ? 0.45 : profile.difficulty === 'normal' ? 0.12 : 0;
  if (rng() < randomness) return pick(legal[Math.floor(rng() * legal.length)]);
  const noise = profile.difficulty === 'normal' ? 4 : profile.difficulty === 'hard' ? 1 : 0;
  let best = legal[0];
  let bestScore = -Infinity;
  for (const a of legal) {
    const s = scoreAction(view, a, view.hand) + (noise ? rng() * noise : 0);
    if (s > bestScore) {
      best = a;
      bestScore = s;
    }
  }
  return pick(best);
};
