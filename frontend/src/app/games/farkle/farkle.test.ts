import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/deck';
import { FarkleEngine, FarkleState, Level, isFarkle, keeps, scoreOf } from './farkle.engine';

const at = (e: FarkleEngine, patch: Partial<FarkleState>) => Object.assign(e.view, patch);

function playGame(levels: Level[], seed: number, target = 10000): FarkleEngine {
  const e = new FarkleEngine(levels.length, target);
  const rng = seededRng(seed);
  for (let n = 0; n < 20000 && !e.isOver(); n++) {
    const s = e.view;
    if (s.phase === 'start') e.roll(rng);
    else if (s.phase === 'farkle') e.pass();
    else {
      const d = e.decide(levels[s.turn], rng);
      expect(d.bank ? e.bank(d.pick) : e.roll(rng, d.pick)).toBe(true);
    }
  }
  return e;
}

describe('Farkle', () => {
  it('scores singles, sets and the six-dice combinations', () => {
    expect(scoreOf([1])).toBe(100);
    expect(scoreOf([5, 5])).toBe(100);
    expect(scoreOf([1, 5])).toBe(150);
    expect(scoreOf([2])).toBe(0);
    expect(scoreOf([2, 2, 2])).toBe(200);
    expect(scoreOf([6, 6, 6])).toBe(600);
    expect(scoreOf([1, 1, 1])).toBe(1000);
    expect(scoreOf([1, 1, 1, 1])).toBe(1100); // three 1s + a 1 beats four of a kind
    expect(scoreOf([3, 3, 3, 3])).toBe(1000);
    expect(scoreOf([4, 4, 4, 4, 4])).toBe(2000);
    expect(scoreOf([2, 2, 2, 2, 2, 2])).toBe(3000);
    expect(scoreOf([1, 2, 3, 4, 5, 6])).toBe(1500);
    expect(scoreOf([2, 2, 3, 3, 6, 6])).toBe(1500);
    expect(scoreOf([2, 2, 2, 6, 6, 6])).toBe(2500);
    expect(scoreOf([4, 4, 4, 4, 3, 3])).toBe(1500);
    expect(scoreOf([2, 2, 2, 3])).toBe(0); // the 3 doesn't score
    expect(scoreOf([5, 5, 5, 1])).toBe(600);
  });

  it('spots a Farkle and lists the ways to score', () => {
    expect(isFarkle([2, 3, 4, 6, 6, 2])).toBe(true);
    expect(isFarkle([2, 3, 4, 6, 6, 5])).toBe(false);
    expect(keeps([1, 5, 3])[0]).toEqual({ dice: [1, 5], points: 150 });
  });

  it('sets aside scoring dice, rolls the rest, and banks', () => {
    const e = new FarkleEngine(2);
    at(e, { phase: 'choose', dice: [1, 5, 2, 3, 4, 6] });
    expect(e.pickPoints([2])).toBe(0);
    expect(e.roll(seededRng(3), [0])).toBe(true);
    expect(e.view.kept).toEqual([1]);
    if (e.view.phase === 'choose') {
      expect(e.view.dice).toHaveLength(5);
      expect(e.view.turnPoints).toBe(100);
    }
    const b = new FarkleEngine(2);
    at(b, { phase: 'choose', dice: [5, 2, 3], turnPoints: 400 });
    expect(b.bank([0])).toBe(true);
    expect(b.view.players[0].score).toBe(450);
    expect(b.view.turn).toBe(1);
    expect(b.view.phase).toBe('start');
  });

  it('a Farkle loses the turn points', () => {
    const e = new FarkleEngine(2);
    // Dice 2,3,4,6,6,2: whatever is rolled next with 1 die, set up a guaranteed Farkle instead.
    at(e, { phase: 'choose', dice: [1, 2], turnPoints: 700 });
    const rng = () => 2 / 6; // every die rolls a 3
    e.roll(rng, [0]);
    expect(e.view.phase).toBe('farkle');
    expect(e.view.turnPoints).toBe(0);
    e.pass();
    expect(e.view.players[0].score).toBe(0);
    expect(e.view.turn).toBe(1);
  });

  it('hot dice: scoring all six rolls six again', () => {
    const e = new FarkleEngine(1);
    at(e, { phase: 'choose', dice: [1, 1, 1, 5, 5, 5], turnPoints: 0 });
    e.roll(seededRng(1), [0, 1, 2, 3, 4, 5]);
    expect(e.view.kept).toEqual([]);
    if (e.view.phase === 'choose') expect(e.view.dice).toHaveLength(6);
  });

  it('everyone else gets one last turn after the target is reached', () => {
    const e = new FarkleEngine(3, 1000);
    at(e, { turn: 1, phase: 'choose', dice: [1, 1, 1] });
    e.bank([0, 1, 2]);
    expect(e.view.finalFrom).toBe(1);
    expect(e.isOver()).toBe(false);
    for (const seat of [2, 0]) {
      expect(e.view.turn).toBe(seat);
      at(e, { phase: 'choose', dice: [5] });
      e.bank([0]);
    }
    expect(e.isOver()).toBe(true);
    expect(e.winner()).toBe(1);
  });

  it('computers finish games at every level, and Hard beats Easy over many games', () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const e = playGame(seed % 2 ? ['hard', 'easy'] : ['easy', 'hard'], seed);
      expect(e.isOver()).toBe(true);
      const hard = seed % 2 ? 0 : 1;
      if (e.winner() === hard) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(20);
    const solo = playGame(['normal'], 5, 5000);
    expect(solo.view.players[0].score).toBeGreaterThanOrEqual(5000);
  });
});
