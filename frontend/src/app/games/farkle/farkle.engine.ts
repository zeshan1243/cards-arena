import { Rng } from '../core/deck';

/**
 * Farkle: roll six dice, set aside scoring dice, then roll the rest or bank your turn points.
 * A roll with nothing to score is a Farkle and the turn's points are lost. Scoring all six dice
 * ("hot dice") lets you roll all six again. When someone banks the target score, everyone else
 * gets one last turn and the highest total wins.
 *
 * Scoring: single 1 = 100, single 5 = 50; three of a kind = face × 100 (three 1s = 1000);
 * four of a kind 1000, five 2000, six 3000; 1-2-3-4-5-6 straight 1500; three pairs 1500;
 * four of a kind with a pair 1500; two triplets 2500.
 */

export const DICE = 6;
export type Level = 'easy' | 'normal' | 'hard';
export type Phase = 'start' | 'choose' | 'farkle' | 'over';

export interface FarklePlayer {
  score: number;
  /** Turns taken (for solo games). */
  turns: number;
}

export interface FarkleState {
  players: FarklePlayer[];
  turn: number;
  phase: Phase;
  /** The dice on the table from the last roll. */
  dice: number[];
  /** Dice set aside earlier this turn, for show. */
  kept: number[];
  turnPoints: number;
  target: number;
  /** Seat that first reached the target; everyone else then gets one last turn. */
  finalFrom: number | null;
}

const counts = (dice: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
};

const ofAKind = (face: number, n: number) => (n === 3 ? (face === 1 ? 1000 : face * 100) : n === 4 ? 1000 : n === 5 ? 2000 : 3000);

/**
 * Points for setting aside exactly `dice`, or 0 if any die in it doesn't score.
 * Takes the best reading (four 1s = three 1s + a 1 = 1100 beats 1000).
 */
export function scoreOf(dice: number[]): number {
  if (!dice.length) return 0;
  const c = counts(dice);
  let best = 0;
  if (dice.length === 6) {
    const shape = c.slice(1).filter(Boolean).sort().join('');
    if (shape === '111111') best = 1500;
    else if (shape === '222') best = 1500;
    else if (shape === '33') best = 2500;
    else if (shape === '24') best = 1500;
  }
  // Each face: either all its dice form one set of three or more, or (1s and 5s only) some are singles.
  let total = 0;
  for (let face = 1; face <= 6; face++) {
    const n = c[face];
    if (!n) continue;
    const single = face === 1 ? 100 : face === 5 ? 50 : 0;
    let faceBest = single ? n * single : -1;
    for (let k = 3; k <= n; k++) {
      if (single || k === n) faceBest = Math.max(faceBest, ofAKind(face, k) + (n - k) * single);
    }
    if (faceBest < 0) {
      total = -1;
      break;
    }
    total += faceBest;
  }
  return Math.max(best, total);
}

/** Every distinct way to set aside scoring dice from `roll`, as dice values, best first. */
export function keeps(roll: number[]): { dice: number[]; points: number }[] {
  const seen = new Map<string, { dice: number[]; points: number }>();
  for (let mask = 1; mask < 1 << roll.length; mask++) {
    const dice = roll.filter((_, i) => mask & (1 << i)).sort();
    const key = dice.join('');
    if (seen.has(key)) continue;
    const points = scoreOf(dice);
    if (points > 0) seen.set(key, { dice, points });
  }
  return [...seen.values()].sort((a, b) => b.points - a.points || a.dice.length - b.dice.length);
}

export const isFarkle = (roll: number[]) => keeps(roll).length === 0;

/** Which dice in `roll` could score at all (for highlighting). */
export function scoringIndexes(roll: number[]): Set<number> {
  const out = new Set<number>();
  const all = keeps(roll);
  roll.forEach((d, i) => {
    if (all.some((k) => k.dice.includes(d))) out.add(i);
  });
  return out;
}

export class FarkleEngine {
  private state: FarkleState;

  constructor(players = 1, target = 10000) {
    this.state = {
      players: Array.from({ length: players }, () => ({ score: 0, turns: 0 })),
      turn: 0,
      phase: 'start',
      dice: [],
      kept: [],
      turnPoints: 0,
      target,
      finalFrom: null,
    };
  }

  get view(): FarkleState {
    return this.state;
  }

  isOver(): boolean {
    return this.state.phase === 'over';
  }

  /** Roll: the opening roll of a turn, or set aside `pick` (indexes into the dice) and roll the rest. */
  roll(rng: Rng, pick: number[] = []): boolean {
    const s = this.state;
    let left = DICE;
    let turnPoints = s.turnPoints;
    let kept = s.kept;
    if (s.phase === 'choose') {
      const pts = this.pickPoints(pick);
      if (!pts) return false;
      turnPoints += pts;
      kept = [...kept, ...pick.map((i) => s.dice[i])];
      left = s.dice.length - pick.length;
      if (left === 0) {
        // Hot dice: all six scored, roll them all again.
        left = DICE;
        kept = [];
      }
    } else if (s.phase !== 'start') {
      return false;
    }
    const dice = Array.from({ length: left }, () => 1 + Math.floor(rng() * 6));
    const farkle = isFarkle(dice);
    this.state = { ...s, dice, kept, turnPoints: farkle ? 0 : turnPoints, phase: farkle ? 'farkle' : 'choose' };
    return true;
  }

  /** Points `pick` would add, or 0 if it isn't a valid set-aside. */
  pickPoints(pick: number[]): number {
    const s = this.state;
    if (s.phase !== 'choose' || !pick.length || new Set(pick).size !== pick.length || pick.some((i) => i < 0 || i >= s.dice.length)) return 0;
    return scoreOf(pick.map((i) => s.dice[i]));
  }

  /** Set aside `pick` and bank the turn. */
  bank(pick: number[]): boolean {
    const s = this.state;
    const pts = this.pickPoints(pick);
    if (!pts) return false;
    const players = s.players.map((p, i) => (i === s.turn ? { score: p.score + s.turnPoints + pts, turns: p.turns + 1 } : p));
    this.state = { ...s, players, kept: [...s.kept, ...pick.map((i) => s.dice[i])], turnPoints: s.turnPoints + pts };
    this.endTurn();
    return true;
  }

  /** After a Farkle has been shown, pass the dice. */
  pass(): boolean {
    const s = this.state;
    if (s.phase !== 'farkle') return false;
    this.state = { ...s, players: s.players.map((p, i) => (i === s.turn ? { ...p, turns: p.turns + 1 } : p)) };
    this.endTurn();
    return true;
  }

  /** Winning seat (highest total), -1 for a tie, null while playing. */
  winner(): number | null {
    if (!this.isOver()) return null;
    const t = this.state.players.map((p) => p.score);
    const best = Math.max(...t);
    return t.filter((x) => x === best).length > 1 ? -1 : t.indexOf(best);
  }

  private endTurn(): void {
    const s = this.state;
    let finalFrom = s.finalFrom;
    if (finalFrom === null && s.players[s.turn].score >= s.target) finalFrom = s.turn;
    const next = (s.turn + 1) % s.players.length;
    const over = finalFrom !== null && (s.players.length === 1 || next === finalFrom);
    this.state = { ...s, finalFrom, turn: over ? s.turn : next, phase: over ? 'over' : 'start', dice: over ? s.dice : [], kept: over ? s.kept : [], turnPoints: over ? s.turnPoints : 0 };
  }

  // ------------------------------------------------------------------ computer

  /**
   * The computer's move once the dice are down: which dice to set aside, and whether to bank.
   * Easy keeps every scoring die and banks at a fixed total; Normal keeps fewer dice to roll more;
   * Hard banks by thresholds that depend on dice left, and chases when an opponent is about to win.
   */
  decide(level: Level, rng: Rng): { pick: number[]; bank: boolean } {
    const s = this.state;
    const options = keeps(s.dice);
    const me = s.players[s.turn];
    const others = s.players.filter((_, i) => i !== s.turn).map((p) => p.score);
    const leader = others.length ? Math.max(...others) : 0;

    const plan = (k: { dice: number[]; points: number }) => {
      const pts = s.turnPoints + k.points;
      let left = s.dice.length - k.dice.length;
      if (left === 0) left = DICE;
      const total = me.score + pts;
      // Must chase in the final round; bank as soon as banking wins.
      if (s.finalFrom !== null) return { pts, left, bank: total > leader };
      if (total >= s.target) return { pts, left, bank: true };
      const bankAt =
        level === 'easy' ? 300 + Math.floor(rng() * 4) * 100
        : level === 'normal' ? [0, 300, 300, 400, 600, 1500, Infinity][left]
        : [0, 300, 300, 400, 1000, 2000, Infinity][left];
      // Hard plays bolder when an opponent is close to the target.
      const urgent = level === 'hard' && leader >= s.target * 0.8 && leader > me.score + pts;
      return { pts, left, bank: left < DICE && pts >= (urgent ? bankAt * 2 : bankAt) };
    };

    const take = (k: { dice: number[] }) => {
      const pick: number[] = [];
      for (const d of k.dice) pick.push(s.dice.findIndex((x, i) => x === d && !pick.includes(i)));
      return pick;
    };

    if (level === 'easy') {
      const all = options[0];
      return { pick: take(all), bank: plan(all).bank };
    }
    // Hot dice or a bank: take the most points.
    const most = options[0];
    const mostPlan = plan(most);
    if (most.dice.length === s.dice.length || mostPlan.bank) return { pick: take(most), bank: mostPlan.bank };
    // Otherwise keep as few dice as is sensible to roll more: value points plus ~100 per extra die rolled.
    const worth = (k: { dice: number[]; points: number }) => k.points + (s.dice.length - k.dice.length) * (level === 'hard' ? 110 : 80);
    const best = [...options].sort((a, b) => worth(b) - worth(a))[0];
    const p = plan(best);
    return { pick: take(best), bank: p.bank };
  }
}
