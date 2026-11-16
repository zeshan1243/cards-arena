import { describe, expect, it } from 'vitest';
import { UNITS, conflicts, countSolutions, daySeed, generate, grade, randomSolution, seededRng, solve } from './sudoku.engine';

const parse = (s: string) => [...s.replace(/\s/g, '')].map((c) => (c === '.' ? 0 : Number(c)));
const valid = (g: number[]) => UNITS.every((u) => new Set(u.map((i) => g[i])).size === 9 && u.every((i) => g[i] >= 1 && g[i] <= 9));

describe('Sudoku', () => {
  it('builds valid random solutions', () => {
    const rng = seededRng(1);
    for (let k = 0; k < 5; k++) expect(valid(randomSolution(rng))).toBe(true);
  });

  it('solves a classic puzzle and spots multiple solutions', () => {
    const p = parse('53..7.... 6..195... .98....6. 8...6...3 4..8.3..1 7...2...6 .6....28. ...419..5 ....8..79');
    const s = solve(p)!;
    expect(valid(s)).toBe(true);
    expect(s.slice(0, 9).join('')).toBe('534678912');
    expect(countSolutions(p)).toBe(1);
    expect(countSolutions(Array(81).fill(0))).toBe(2);
    expect(grade(p)).toBe(1);
  });

  it('grades a puzzle needing advanced techniques as hard', () => {
    // "Platinum Blonde" — famously beyond basic techniques.
    expect(grade(parse('.......12........3..23..4....1....5..4..6..7....8..9..5.......7..6........8.....'.replace(/(.{9})/g, '$1')))).toBe(4);
  });

  it('generates unique puzzles at every level, quickly', () => {
    const rng = seededRng(42);
    for (const level of ['easy', 'medium', 'hard', 'expert'] as const) {
      const t = Date.now();
      const p = generate(level, rng);
      const ms = Date.now() - t;
      const clues = p.puzzle.filter(Boolean).length;
      console.log(level, 'clues', clues, 'grade', p.grade, ms + 'ms');
      expect(countSolutions(p.puzzle)).toBe(1);
      expect(solve(p.puzzle)).toEqual(p.solution);
      p.puzzle.forEach((v, i) => v && expect(v).toBe(p.solution[i]));
      expect(ms).toBeLessThan(3000);
    }
  }, 20000);

  it('the daily puzzle is the same for everyone on a day', () => {
    const a = generate('medium', seededRng(daySeed('2026-11-16')));
    const b = generate('medium', seededRng(daySeed('2026-11-16')));
    const c = generate('medium', seededRng(daySeed('2026-11-17')));
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.puzzle).not.toEqual(c.puzzle);
  });

  it('finds clashing digits', () => {
    const g = Array(81).fill(0);
    g[0] = 5;
    g[8] = 5;
    g[40] = 3;
    expect([...conflicts(g)].sort()).toEqual([0, 8]);
  });
});
