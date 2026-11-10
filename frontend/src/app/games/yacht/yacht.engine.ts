import { Rng } from '../core/deck';

/** Yacht Dice: the classic five-dice category game (13 boxes, upper bonus, extra-Yacht bonuses). */
export const CATEGORIES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht', 'chance',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const UPPER: Category[] = CATEGORIES.slice(0, 6);
export const LOWER: Category[] = CATEGORIES.slice(6);

export const LABELS: Record<Category, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: 'Three of a kind', fourKind: 'Four of a kind', fullHouse: 'Full house',
  smallStraight: 'Small straight', largeStraight: 'Large straight', yacht: 'Yacht', chance: 'Chance',
};
export const HINTS: Record<Category, string> = {
  ones: 'Total of 1s', twos: 'Total of 2s', threes: 'Total of 3s', fours: 'Total of 4s', fives: 'Total of 5s', sixes: 'Total of 6s',
  threeKind: '3 alike: all dice', fourKind: '4 alike: all dice', fullHouse: '3 + 2 alike: 25',
  smallStraight: '4 in a row: 30', largeStraight: '5 in a row: 40', yacht: '5 alike: 50', chance: 'All dice',
};

export const UPPER_BONUS_AT = 63;
export const UPPER_BONUS = 35;
export const YACHT_BONUS = 100;
export const ROLLS = 3;

export type Level = 'easy' | 'normal' | 'hard';
export type Card = Partial<Record<Category, number>>;

export interface PlayerState {
  card: Card;
  /** Extra Yachts scored after the Yacht box holds 50. */
  bonusYachts: number;
}

export interface YachtState {
  players: PlayerState[];
  turn: number;
  /** 13 rounds, numbered from 1. */
  round: number;
  dice: number[];
  held: boolean[];
  rollsLeft: number;
}

const counts = (dice: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
};
const sum = (dice: number[]) => dice.reduce((a, b) => a + b, 0);
const run = (dice: number[]) => {
  const has = new Set(dice);
  let best = 0;
  let cur = 0;
  for (let v = 1; v <= 6; v++) {
    cur = has.has(v) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
};

export const isYacht = (dice: number[]) => dice.length === 5 && dice.every((d) => d === dice[0]);

/** Points `dice` are worth in `cat`, ignoring the joker rule. */
export function rawScore(cat: Category, dice: number[]): number {
  const c = counts(dice);
  const most = Math.max(...c);
  const up = UPPER.indexOf(cat);
  if (up >= 0) return c[up + 1] * (up + 1);
  switch (cat) {
    case 'threeKind': return most >= 3 ? sum(dice) : 0;
    case 'fourKind': return most >= 4 ? sum(dice) : 0;
    case 'fullHouse': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'smallStraight': return run(dice) >= 4 ? 30 : 0;
    case 'largeStraight': return run(dice) === 5 ? 40 : 0;
    case 'yacht': return most === 5 ? 50 : 0;
    default: return sum(dice);
  }
}

/**
 * The boxes `card` may fill with `dice`, and what each would score. A Yacht rolled after the
 * Yacht box is filled is a joker: it must go in its matching upper box if that is open, otherwise
 * it scores full points in any open lower box (25 / 30 / 40 included), otherwise 0 in an upper box.
 */
export function options(card: Card, dice: number[]): Map<Category, number> {
  const open = CATEGORIES.filter((c) => card[c] === undefined);
  const out = new Map<Category, number>();
  if (isYacht(dice) && card.yacht !== undefined) {
    const matching = UPPER[dice[0] - 1];
    if (card[matching] === undefined) return out.set(matching, rawScore(matching, dice));
    const lower = open.filter((c) => LOWER.includes(c));
    if (lower.length) {
      const full: Partial<Record<Category, number>> = { fullHouse: 25, smallStraight: 30, largeStraight: 40 };
      for (const c of lower) out.set(c, full[c] ?? rawScore(c, dice));
      return out;
    }
    for (const c of open) out.set(c, 0);
    return out;
  }
  for (const c of open) out.set(c, rawScore(c, dice));
  return out;
}

export function upperTotal(card: Card): number {
  return UPPER.reduce((t, c) => t + (card[c] ?? 0), 0);
}
export function upperBonus(card: Card): number {
  return upperTotal(card) >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
}
export function total(p: PlayerState): number {
  return CATEGORIES.reduce((t, c) => t + (p.card[c] ?? 0), 0) + upperBonus(p.card) + p.bonusYachts * YACHT_BONUS;
}

export class YachtEngine {
  private state: YachtState;

  constructor(players = 1) {
    this.state = {
      players: Array.from({ length: players }, () => ({ card: {}, bonusYachts: 0 })),
      turn: 0,
      round: 1,
      dice: [1, 2, 3, 4, 5],
      held: [false, false, false, false, false],
      rollsLeft: ROLLS,
    };
  }

  get view(): YachtState {
    return this.state;
  }

  get rolled(): boolean {
    return this.state.rollsLeft < ROLLS;
  }

  isOver(): boolean {
    return this.state.round > CATEGORIES.length;
  }

  /** Re-roll every die that isn't held. */
  roll(rng: Rng): boolean {
    const s = this.state;
    if (s.rollsLeft <= 0 || this.isOver()) return false;
    const held = this.rolled ? s.held : s.held.map(() => false);
    this.state = { ...s, held, rollsLeft: s.rollsLeft - 1, dice: s.dice.map((d, i) => (held[i] ? d : 1 + Math.floor(rng() * 6))) };
    return true;
  }

  toggleHold(i: number): boolean {
    const s = this.state;
    if (!this.rolled || s.rollsLeft === 0) return false;
    this.setHeld(s.held.map((h, k) => (k === i ? !h : h)));
    return true;
  }

  setHeld(held: boolean[]): void {
    this.state = { ...this.state, held };
  }

  options(): Map<Category, number> {
    return this.rolled ? options(this.state.players[this.state.turn].card, this.state.dice) : new Map();
  }

  /** Fill `cat` for the current player and pass the dice on. */
  score(cat: Category): boolean {
    const s = this.state;
    const opts = this.options();
    if (!opts.has(cat)) return false;
    const me = s.players[s.turn];
    const bonus = isYacht(s.dice) && me.card.yacht === 50 ? 1 : 0;
    const players = s.players.map((p, i) => (i === s.turn ? { card: { ...p.card, [cat]: opts.get(cat)! }, bonusYachts: p.bonusYachts + bonus } : p));
    const next = (s.turn + 1) % s.players.length;
    this.state = {
      players,
      turn: next,
      round: s.round + (next === 0 ? 1 : 0),
      dice: s.dice,
      held: s.held.map(() => false),
      rollsLeft: ROLLS,
    };
    return true;
  }

  totals(): number[] {
    return this.state.players.map(total);
  }

  /** Winning seat, -1 for a tie, null while the game is on. */
  winner(): number | null {
    if (!this.isOver()) return null;
    const t = this.totals();
    const best = Math.max(...t);
    return t.filter((x) => x === best).length > 1 ? -1 : t.indexOf(best);
  }

  // ------------------------------------------------------------------ computer

  /**
   * Which dice to keep for the next roll; keeping all five means "stop and score".
   * Easy keeps its most common face; Normal looks one roll ahead; Hard plans every remaining roll,
   * using exact odds over all 252 possible sets of dice.
   */
  chooseHolds(level: Level): boolean[] {
    const s = this.state;
    if (level === 'easy') return easyHolds(s.players[s.turn].card, s.dice);
    const plan = new Planner(s.players[s.turn].card);
    const ahead = level === 'hard' ? s.rollsLeft - 1 : 0;
    let best = s.dice.map(() => true);
    let bestValue = plan.value(s.dice, 0);
    for (let mask = 0; mask < 31; mask++) {
      const held = s.dice.map((_, i) => !!(mask & (1 << i)));
      const v = plan.expect(s.dice.filter((_, i) => held[i]), ahead);
      if (v > bestValue + 1e-9) {
        bestValue = v;
        best = held;
      }
    }
    return best;
  }

  /** Should the computer stop rolling and score now? */
  shouldStop(level: Level): boolean {
    const s = this.state;
    if (s.rollsLeft === 0) return true;
    if (level === 'easy') {
      const card = s.players[s.turn].card;
      return (isYacht(s.dice) && card.yacht === undefined) || options(card, s.dice).get('largeStraight') === 40;
    }
    return this.chooseHolds(level).every(Boolean);
  }

  chooseCategory(level: Level, rng: Rng): Category {
    const s = this.state;
    const card = s.players[s.turn].card;
    const opts = [...options(card, s.dice)];
    if (level === 'easy' && rng() < 0.6) return opts.sort((a, b) => b[1] - a[1])[0][0];
    return opts.sort((a, b) => boxValue(card, b[0], b[1]) - boxValue(card, a[0], a[1]))[0][0];
  }
}

/** Typical score of each box for a decent player: points above par are a good use of the box. */
const PAR: Record<Category, number> = {
  ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17,
  threeKind: 20, fourKind: 12, fullHouse: 21, smallStraight: 26, largeStraight: 28, yacht: 14, chance: 22,
};

/** How good it is to write `points` in `cat` right now. */
function boxValue(card: Card, cat: Category, points: number): number {
  let v = points - PAR[cat];
  const up = UPPER.indexOf(cat);
  if (up >= 0) {
    // Three of a number keeps the upper bonus on track.
    const face = up + 1;
    v += (points - 3 * face) * 0.6;
    const before = upperTotal(card);
    if (before < UPPER_BONUS_AT && before + points >= UPPER_BONUS_AT) v += UPPER_BONUS;
  }
  // Keep Chance as a late safety net.
  if (cat === 'chance') v -= 4;
  return v;
}

/** Easy holds: a straight draw when one is open, otherwise the most common face. */
function easyHolds(card: Card, dice: number[]): boolean[] {
  if (run(dice) >= 4 && (card.smallStraight === undefined || card.largeStraight === undefined)) {
    const seen = new Set<number>();
    return dice.map((d) => (seen.has(d) ? false : (seen.add(d), true)));
  }
  const c = counts(dice);
  const face = c.lastIndexOf(Math.max(...c.slice(1)));
  return dice.map((d) => d === face);
}

const key = (dice: number[]) => [...dice].sort().join('');

/** Every way to roll `n` dice, as sorted faces with their probability. */
const OUTCOMES: { faces: number[]; p: number }[][] = [];
for (let n = 0; n <= 5; n++) {
  const m = new Map<string, { faces: number[]; p: number }>();
  for (let i = 0; i < 6 ** n; i++) {
    const faces: number[] = [];
    for (let k = 0, x = i; k < n; k++, x = Math.floor(x / 6)) faces.push(1 + (x % 6));
    const id = key(faces);
    const o = m.get(id) ?? { faces: faces.sort(), p: 0 };
    o.p += 1 / 6 ** n;
    m.set(id, o);
  }
  OUTCOMES.push([...m.values()]);
}

/** Exact expected box values for one scorecard, memoised by dice. */
class Planner {
  private readonly values = new Map<string, number>();
  private readonly expects = new Map<string, number>();
  constructor(private readonly card: Card) {}

  /** Value of `dice` with `rolls` re-rolls still available, playing on perfectly. */
  value(dice: number[], rolls: number): number {
    const id = `${key(dice)}/${rolls}`;
    let v = this.values.get(id);
    if (v !== undefined) return v;
    v = turnValue(this.card, dice);
    if (rolls > 0) {
      const tried = new Set<string>();
      for (let mask = 0; mask < 31; mask++) {
        const kept = dice.filter((_, i) => mask & (1 << i));
        if (tried.has(key(kept))) continue;
        tried.add(key(kept));
        v = Math.max(v, this.expect(kept, rolls - 1));
      }
    }
    this.values.set(id, v);
    return v;
  }

  /** Expected value of re-rolling all but `kept`, with `rolls` more re-rolls after that one. */
  expect(kept: number[], rolls: number): number {
    const id = `${key(kept)}/${rolls}`;
    let e = this.expects.get(id);
    if (e !== undefined) return e;
    e = 0;
    for (const o of OUTCOMES[5 - kept.length]) e += o.p * this.value([...kept, ...o.faces], rolls);
    this.expects.set(id, e);
    return e;
  }
}

/** Best box value available for `dice`. */
function turnValue(card: Card, dice: number[]): number {
  let best = -Infinity;
  for (const [cat, pts] of options(card, dice)) best = Math.max(best, boxValue(card, cat, pts));
  return best;
}
