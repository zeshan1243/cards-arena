import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/deck';
import { CATEGORIES, Category, Level, YachtEngine, options, rawScore, total } from './yacht.engine';

const at = (e: YachtEngine, patch: object) => Object.assign((e as unknown as { state: object }).state, patch);

function playGame(levels: Level[], seed: number): YachtEngine {
  const e = new YachtEngine(levels.length);
  const rng = seededRng(seed);
  while (!e.isOver()) {
    const level = levels[e.view.turn];
    e.roll(rng);
    while (!e.shouldStop(level)) {
      e.setHeld(e.chooseHolds(level));
      e.roll(rng);
    }
    expect(e.score(e.chooseCategory(level, rng))).toBe(true);
  }
  return e;
}

describe('Yacht Dice', () => {
  it('scores every box', () => {
    const s = (cat: Category, dice: number[]) => rawScore(cat, dice);
    expect(s('threes', [3, 3, 1, 3, 6])).toBe(9);
    expect(s('threeKind', [4, 4, 4, 2, 1])).toBe(15);
    expect(s('threeKind', [4, 4, 3, 2, 1])).toBe(0);
    expect(s('fourKind', [6, 6, 6, 6, 1])).toBe(25);
    expect(s('fullHouse', [2, 2, 5, 5, 5])).toBe(25);
    expect(s('fullHouse', [5, 5, 5, 5, 5])).toBe(0);
    expect(s('smallStraight', [1, 2, 3, 4, 4])).toBe(30);
    expect(s('smallStraight', [3, 4, 5, 6, 1])).toBe(30);
    expect(s('smallStraight', [1, 2, 3, 5, 6])).toBe(0);
    expect(s('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
    expect(s('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
    expect(s('yacht', [3, 3, 3, 3, 3])).toBe(50);
    expect(s('chance', [1, 2, 3, 4, 6])).toBe(16);
  });

  it('gives three rolls, holds dice between rolls, then passes the turn', () => {
    const e = new YachtEngine(2);
    const rng = seededRng(4);
    expect(e.toggleHold(0)).toBe(false); // nothing to hold before the first roll
    e.roll(rng);
    const first = e.view.dice[0];
    e.toggleHold(0);
    e.roll(rng);
    e.roll(rng);
    expect(e.view.dice[0]).toBe(first);
    expect(e.roll(rng)).toBe(false);
    expect(e.score('chance')).toBe(true);
    expect(e.view.turn).toBe(1);
    expect(e.view.rollsLeft).toBe(3);
    expect(e.view.held.some(Boolean)).toBe(false);
  });

  it('adds the 35-point bonus once the upper section reaches 63', () => {
    const p = { card: { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }, bonusYachts: 0 };
    expect(total(p)).toBe(63 + 35);
    p.card.ones = 2;
    expect(total(p)).toBe(62);
  });

  it('extra Yachts score 100 and play as jokers', () => {
    const e = new YachtEngine(1);
    at(e, { dice: [4, 4, 4, 4, 4], rollsLeft: 2, players: [{ card: { yacht: 50 }, bonusYachts: 0 }] });
    // The matching upper box is open, so it must be used.
    expect([...e.options().keys()]).toEqual(['fours']);
    e.score('fours');
    expect(e.view.players[0].bonusYachts).toBe(1);
    expect(total(e.view.players[0])).toBe(50 + 20 + 100);
    // With Fours filled, a lower box scores full value.
    const card = { yacht: 50, fours: 20 };
    expect(options(card, [4, 4, 4, 4, 4]).get('largeStraight')).toBe(40);
    expect(options(card, [4, 4, 4, 4, 4]).get('ones')).toBeUndefined();
    // A scratched Yacht box still makes it a joker, but without the bonus.
    const e2 = new YachtEngine(1);
    at(e2, { dice: [2, 2, 2, 2, 2], rollsLeft: 1, players: [{ card: { yacht: 0, twos: 4 }, bonusYachts: 0 }] });
    e2.score('fullHouse');
    expect(e2.view.players[0].card.fullHouse).toBe(25);
    expect(e2.view.players[0].bonusYachts).toBe(0);
  });

  it('a filled box cannot be used again', () => {
    const e = new YachtEngine(1);
    at(e, { dice: [1, 2, 3, 4, 6], rollsLeft: 0, players: [{ card: { chance: 10 }, bonusYachts: 0 }] });
    expect(e.score('chance')).toBe(false);
  });

  it('the computer finishes 13 rounds at every level and plays Hard well', () => {
    for (const level of ['easy', 'normal', 'hard'] as Level[]) {
      let t = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const e = playGame([level], seed);
        expect(e.view.round).toBe(14);
        expect(CATEGORIES.every((c) => e.view.players[0].card[c] !== undefined)).toBe(true);
        t += e.totals()[0];
      }
      // Over many games Easy averages about 205, Normal 220 and Hard 233.
      if (level === 'hard') expect(t / 6).toBeGreaterThan(190);
    }
  });

  it('declares a winner in a two-player game', () => {
    const e = playGame(['normal', 'hard'], 9);
    const t = e.totals();
    expect(e.winner()).toBe(t[0] === t[1] ? -1 : t[0] > t[1] ? 0 : 1);
  });
});
