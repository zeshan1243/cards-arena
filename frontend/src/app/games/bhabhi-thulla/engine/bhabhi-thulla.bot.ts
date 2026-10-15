import { Card, SUITS, Suit, rankValue } from '../../../shared/models/card.model';
import { BotProfile, Difficulty } from '../../../shared/models/game.model';
import { Rng } from '../../core/deck';
import { PlayerView } from './bhabhi-thulla.engine';

/**
 * Bhabhi Thulla bot.
 *
 * Pipeline (spec §18): game state → valid moves → strategy → evaluate → select.
 * Bots only see a `PlayerView`, i.e. exactly what a human in that seat sees.
 */

export interface TableKnowledge {
  /** Suits each player is known to be out of. */
  voids: Map<string, Set<Suit>>;
  /** Cards a player is known to hold (picked up from a thulla and not yet replayed). */
  knownHoldings: Map<string, Set<string>>;
  /** Cards no longer in anyone's hand (discarded tricks). */
  gone: Set<string>;
}

/** Rebuild what any attentive player would know from the public event log. */
export function analyzeTable(view: PlayerView): TableKnowledge {
  const voids = new Map<string, Set<Suit>>();
  const knownHoldings = new Map<string, Set<string>>();
  const gone = new Set<string>();
  for (const p of view.players) {
    voids.set(p.id, new Set());
    knownHoldings.set(p.id, new Set());
  }

  for (const ev of view.events) {
    if (ev.type === 'play') {
      knownHoldings.get(ev.playerId)!.delete(ev.card.id);
      if (!ev.followed) voids.get(ev.playerId)!.add(ev.leadSuit);
    } else if (ev.type === 'trick') {
      const { result } = ev;
      if (result.pickedUpById) {
        const holder = result.pickedUpById;
        for (const play of result.plays) {
          knownHoldings.get(holder)!.add(play.card.id);
          voids.get(holder)!.delete(play.card.suit);
        }
      } else {
        result.plays.forEach((play) => gone.add(play.card.id));
      }
    }
  }
  return { voids, knownHoldings, gone };
}

interface DecisionContext {
  view: PlayerView;
  hand: Card[];
  valid: Card[];
  knowledge: TableKnowledge;
  difficulty: Difficulty;
  /** Opponents still to act in this trick, in order. */
  toAct: string[];
}

export function chooseCard(view: PlayerView, profile: Pick<BotProfile, 'difficulty' | 'personality'>, rng: Rng, valid: Card[]): Card {
  if (valid.length === 0) throw new Error('Bot has no valid moves');
  if (valid.length === 1) return valid[0];

  const randomPick = () => valid[Math.floor(rng() * valid.length)];
  if (profile.personality === 'random') return randomPick();
  if (profile.difficulty === 'easy' && rng() < 0.45) return randomPick();

  const myIndex = view.trickParticipants.indexOf(view.viewerId);
  const ctx: DecisionContext = {
    view,
    hand: view.hand,
    valid,
    knowledge: analyzeTable(view),
    difficulty: profile.difficulty,
    toAct: view.trickParticipants.slice(myIndex + 1),
  };

  if (view.trick.length === 0) return chooseLead(ctx, profile.personality === 'aggressive');
  if (valid[0].suit === view.leadSuit) return chooseFollow(ctx);
  return chooseDiscard(ctx, profile.personality === 'friendly');
}

// ------------------------------------------------------------------- leading

function chooseLead(ctx: DecisionContext, aggressive: boolean): Card {
  const { valid, hand } = ctx;
  const bySuit = groupBySuit(valid);
  let best: { card: Card; score: number } | null = null;

  for (const [suit, cards] of bySuit) {
    const lowest = cards[0];
    const risk = thullaRisk(ctx, suit);
    // Opponents' cards above our lowest card make it likely someone else ends up highest.
    const higherOutside = unseenInSuit(ctx, suit).filter((id) => rankOf(id) > rankValue(lowest.rank)).length;
    const suitLength = hand.filter((c) => c.suit === suit).length;

    let score = higherOutside * 2 - risk * 30 - rankValue(lowest.rank);
    // Shed short suits so we can thulla later.
    score += suitLength <= 2 ? 4 : 0;
    if (aggressive) score += suitLength <= 1 ? 6 : 0;
    if (!best || score > best.score) best = { card: lowest, score };
  }
  return best!.card;
}

// ----------------------------------------------------------------- following

function chooseFollow(ctx: DecisionContext): Card {
  const { view, valid, toAct } = ctx;
  const suit = view.leadSuit!;
  const currentHigh = Math.max(...view.trick.filter((p) => p.card.suit === suit).map((p) => rankValue(p.card.rank)));
  const sorted = [...valid].sort((a, b) => rankValue(a.rank) - rankValue(b.rank));

  // Last to act: trick will be discarded no matter what — dump the biggest card.
  if (toAct.length === 0) return sorted[sorted.length - 1];

  const under = sorted.filter((c) => rankValue(c.rank) < currentHigh);
  if (under.length) return under[under.length - 1];

  // Forced to go over. If a thulla looks likely, play the smallest card that
  // still beats the table so a later player might overtake us.
  const risk = thullaRisk(ctx, suit);
  const threshold = ctx.difficulty === 'normal' ? 0.6 : 0.35;
  return risk >= threshold ? sorted[0] : sorted[sorted.length - 1];
}

// -------------------------------------------------- thulla / free discards

function chooseDiscard(ctx: DecisionContext, friendly: boolean): Card {
  const { valid, hand } = ctx;
  const counts = suitCounts(hand);
  let best: { card: Card; score: number } | null = null;
  for (const card of valid) {
    // High cards are the most dangerous to keep; finishing off a suit creates a void.
    let score = rankValue(card.rank) * (friendly ? 0.6 : 1);
    if (counts.get(card.suit) === 1) score += 6;
    if (!best || score > best.score) best = { card, score };
  }
  return best!.card;
}

// ------------------------------------------------------------------- helpers

/** Probability that someone still to act in this trick cannot follow `suit`. */
function thullaRisk(ctx: DecisionContext, suit: Suit): number {
  const { toAct, knowledge, difficulty, view } = ctx;
  if (view.trickNumber === 1 && !view.rules.firstTrickThulla) return 0;
  const opponents = ctx.view.trick.length === 0 ? ctx.view.trickParticipants.filter((id) => id !== view.viewerId) : toAct;
  const knownVoid = opponents.some((id) => knowledge.voids.get(id)?.has(suit));
  // Easy/normal bots remember voids only loosely.
  if (difficulty === 'easy' || difficulty === 'normal') return knownVoid ? 0.7 : 0.2;
  if (knownVoid) return 1;
  if (difficulty === 'hard') return 0.25;

  // Expert: hypergeometric estimate of each opponent holding none of the suit.
  const unseen = unseenCards(ctx);
  const unseenSuit = unseen.filter((id) => suitOf(id) === suit).length;
  let pNoVoid = 1;
  for (const id of opponents) {
    const known = knowledge.knownHoldings.get(id);
    if (known && [...known].some((cid) => suitOf(cid) === suit)) continue;
    const handSize = view.players.find((p) => p.id === id)?.cardCount ?? 0;
    pNoVoid *= 1 - probNone(unseen.length, unseenSuit, handSize);
  }
  return 1 - pNoVoid;
}

/** P(a random hand of size h drawn from N cards contains none of K specific cards). */
function probNone(N: number, K: number, h: number): number {
  if (h <= 0) return 1;
  if (K <= 0) return 1;
  if (h > N - K) return 0;
  let p = 1;
  for (let i = 0; i < h; i++) p *= (N - K - i) / (N - i);
  return p;
}

function unseenCards(ctx: DecisionContext): string[] {
  const mine = new Set(ctx.hand.map((c) => c.id));
  const onTable = new Set(ctx.view.trick.map((p) => p.card.id));
  const all: string[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) all.push(`${s}-${rankName(r)}`);
  return all.filter((id) => !mine.has(id) && !onTable.has(id) && !ctx.knowledge.gone.has(id));
}

function unseenInSuit(ctx: DecisionContext, suit: Suit): string[] {
  return unseenCards(ctx).filter((id) => suitOf(id) === suit);
}

function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const map = new Map<Suit, Card[]>();
  for (const c of [...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))) {
    map.set(c.suit, [...(map.get(c.suit) ?? []), c]);
  }
  return map;
}

function suitCounts(cards: Card[]): Map<Suit, number> {
  const m = new Map<Suit, number>();
  cards.forEach((c) => m.set(c.suit, (m.get(c.suit) ?? 0) + 1));
  return m;
}

function suitOf(id: string): Suit {
  return id.split('-')[0] as Suit;
}

function rankOf(id: string): number {
  return rankValue(id.split('-')[1] as Card['rank']);
}

function rankName(v: number): string {
  return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[v] ?? String(v);
}

// Bot roster is shared by every game.
export { BOT_ROSTER, botsFor } from '../../core/bots';
