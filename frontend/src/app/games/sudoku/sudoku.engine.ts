/**
 * Sudoku: puzzle generation, solving and grading.
 *
 * A grid is 81 numbers, row by row, 0 for an empty cell. Every generated puzzle has exactly one
 * solution. Difficulty is graded by the techniques a person needs to solve it without guessing:
 *   1 singles — naked and hidden singles only
 *   2 intersections — also pointing / claiming (locked candidates)
 *   3 subsets — also naked and hidden pairs and triples
 *   4 beyond — needs harder techniques (or trial and error)
 */

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export type Grid = number[];
export type Rng = () => number;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 27 units: rows, columns, boxes; each a list of 9 cells. */
export const UNITS: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];
/** Every other cell sharing a row, column or box with each cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>();
  for (const u of UNITS) if (u.includes(i)) u.forEach((j) => j !== i && set.add(j));
  return [...set];
});

const ALL = 0x3fe; // bits 1..9
const bit = (d: number) => 1 << d;
const popcount = (m: number) => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};
const digitsOf = (m: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & bit(d));

/** Seeded random numbers (mulberry32), so a date can give everyone the same daily puzzle. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Digits each empty cell could take, given the filled cells. */
export function candidates(grid: Grid): number[] {
  return grid.map((v, i) => {
    if (v) return 0;
    let m = ALL;
    for (const p of PEERS[i]) if (grid[p]) m &= ~bit(grid[p]);
    return m;
  });
}

/**
 * Count solutions up to `limit` by backtracking on the cell with fewest candidates.
 * With `rng`, tries digits in random order and returns the first solution found in `out`.
 */
export function countSolutions(grid: Grid, limit = 2, rng?: Rng, out?: Grid): number {
  const g = [...grid];
  const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const b = bit(v);
    if (rows[rowOf(i)] & b || cols[colOf(i)] & b || boxes[boxOf(i)] & b) return 0;
    rows[rowOf(i)] |= b;
    cols[colOf(i)] |= b;
    boxes[boxOf(i)] |= b;
  }
  let found = 0;
  const go = (): boolean => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = popcount(m);
      if (n < bestCount) {
        best = i;
        bestMask = m;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best < 0) {
      found++;
      if (out && found === 1) out.splice(0, 81, ...g);
      return found >= limit;
    }
    if (!bestCount) return false;
    const r = rowOf(best), c = colOf(best), bx = boxOf(best);
    const ds = rng ? shuffle(digitsOf(bestMask), rng) : digitsOf(bestMask);
    for (const d of ds) {
      const b = bit(d);
      g[best] = d;
      rows[r] |= b;
      cols[c] |= b;
      boxes[bx] |= b;
      if (go()) return true;
      rows[r] &= ~b;
      cols[c] &= ~b;
      boxes[bx] &= ~b;
    }
    g[best] = 0;
    return false;
  };
  go();
  return found;
}

export function solve(grid: Grid): Grid | null {
  const out: Grid = [];
  return countSolutions(grid, 1, undefined, out) ? out : null;
}

/** A random complete grid. */
export function randomSolution(rng: Rng): Grid {
  const out: Grid = [];
  countSolutions(Array(81).fill(0), 1, rng, out);
  return out;
}

// ------------------------------------------------------------------ grading

/**
 * Solve like a person, with the easiest technique that makes progress each step.
 * Returns the hardest technique needed (1–3), or 4 if these techniques get stuck.
 */
export function grade(puzzle: Grid): number {
  const g = [...puzzle];
  const cand = candidates(g);
  let hardest = 1;
  const place = (i: number, d: number) => {
    g[i] = d;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~bit(d);
  };
  const eliminate = (cells: number[], mask: number): boolean => {
    let changed = false;
    for (const i of cells) if (!g[i] && cand[i] & mask) {
      cand[i] &= ~mask;
      changed = true;
    }
    return changed;
  };

  const singles = (): boolean => {
    for (let i = 0; i < 81; i++) {
      if (!g[i] && popcount(cand[i]) === 1) {
        place(i, digitsOf(cand[i])[0]);
        return true;
      }
    }
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const spots = u.filter((i) => !g[i] && cand[i] & bit(d));
        if (spots.length === 1 && !u.some((i) => g[i] === d)) {
          place(spots[0], d);
          return true;
        }
      }
    }
    return false;
  };

  /** Pointing and claiming: a digit confined to a box-line intersection. */
  const intersections = (): boolean => {
    for (let b = 18; b < 27; b++) {
      const box = UNITS[b];
      for (let d = 1; d <= 9; d++) {
        const spots = box.filter((i) => !g[i] && cand[i] & bit(d));
        if (spots.length < 2) continue;
        for (const line of [rowOf, colOf]) {
          if (spots.every((i) => line(i) === line(spots[0]))) {
            const unit = UNITS[(line === rowOf ? 0 : 9) + line(spots[0])];
            if (eliminate(unit.filter((i) => !box.includes(i)), bit(d))) return true;
          }
        }
      }
    }
    for (let u = 0; u < 18; u++) {
      const line = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const spots = line.filter((i) => !g[i] && cand[i] & bit(d));
        if (spots.length < 2 || !spots.every((i) => boxOf(i) === boxOf(spots[0]))) continue;
        if (eliminate(UNITS[18 + boxOf(spots[0])].filter((i) => !line.includes(i)), bit(d))) return true;
      }
    }
    return false;
  };

  /** Naked and hidden pairs and triples. */
  const subsets = (): boolean => {
    for (const u of UNITS) {
      const open = u.filter((i) => !g[i]);
      for (const size of [2, 3]) {
        for (const combo of combos(open, size)) {
          const mask = combo.reduce((m, i) => m | cand[i], 0);
          if (popcount(mask) === size && eliminate(open.filter((i) => !combo.includes(i)), mask)) return true;
        }
        const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !u.some((i) => g[i] === d));
        for (const ds of combos(missing, size)) {
          const mask = ds.reduce((m, d) => m | bit(d), 0);
          const spots = open.filter((i) => cand[i] & mask);
          if (spots.length !== size || !ds.every((d) => spots.some((i) => cand[i] & bit(d)))) continue;
          let changed = false;
          for (const i of spots) if (cand[i] & ~mask) {
            cand[i] &= mask;
            changed = true;
          }
          if (changed) return true;
        }
      }
    }
    return false;
  };

  for (;;) {
    if (g.every((v) => v)) return hardest;
    if (singles()) continue;
    if (intersections()) {
      hardest = Math.max(hardest, 2);
      continue;
    }
    if (subsets()) {
      hardest = Math.max(hardest, 3);
      continue;
    }
    return 4;
  }
}

function combos<T>(list: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  list.forEach((x, i) => combos(list.slice(i + 1), k - 1).forEach((rest) => out.push([x, ...rest])));
  return out;
}

// ------------------------------------------------------------------ generation

/** Clues to aim for, and the grades accepted, per level. */
const SPEC: Record<Level, { clues: number; grades: number[] }> = {
  easy: { clues: 40, grades: [1] },
  medium: { clues: 32, grades: [1] },
  hard: { clues: 27, grades: [2, 3] },
  expert: { clues: 23, grades: [3, 4] },
};

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  level: Level;
  grade: number;
}

/** Remove clues in symmetric pairs while the solution stays unique. */
function carve(solution: Grid, target: number, rng: Rng): Grid {
  const g = [...solution];
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 41 }, (_, k) => k), rng)) {
    if (clues <= target) break;
    const j = 80 - i;
    const keep = [g[i], g[j]];
    g[i] = 0;
    g[j] = 0;
    if (countSolutions(g) === 1) clues -= i === j ? 1 : 2;
    else [g[i], g[j]] = keep;
  }
  return g;
}

/** A new puzzle at `level`, with one solution. */
export function generate(level: Level, rng: Rng): Puzzle {
  const spec = SPEC[level];
  let fallback: Puzzle | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = randomSolution(rng);
    const puzzle = carve(solution, spec.clues, rng);
    const g = grade(puzzle);
    const p = { puzzle, solution, level, grade: g };
    if (spec.grades.includes(g)) return p;
    // Closest miss: for easy levels prefer easier, for hard levels prefer harder.
    if (!fallback || (spec.grades[0] >= 2 ? g > fallback.grade : g < fallback.grade)) fallback = p;
  }
  return fallback!;
}

/** Number for a calendar day (YYYY-MM-DD), used to seed the daily puzzle. */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (const ch of `sudoku-${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Cells clashing with another cell holding the same digit in a row, column or box. */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const p of PEERS[i]) if (grid[p] === grid[i]) out.add(i);
  }
  return out;
}
