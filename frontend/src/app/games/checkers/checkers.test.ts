import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/deck';
import { Board, CheckersEngine, CheckersState, Piece, Side, applyMove, legalMoves } from './checkers.engine';

/** Private state, for crafting positions in tests. */
const inner = (e: CheckersEngine) => e as unknown as { state: CheckersState };
const sq = (r: number, c: number) => r * 8 + c;
let id = 100;
const man = (side: Side): Piece => ({ id: id++, side, king: false });
const king = (side: Side): Piece => ({ id: id++, side, king: true });
function board(pieces: [number, Piece][]): Board {
  const b: Board = Array(64).fill(null);
  for (const [s, p] of pieces) b[s] = p;
  return b;
}
function at(e: CheckersEngine, b: Board, turn: Side = 0): void {
  inner(e).state = { board: b, turn, quiet: 0, plies: 0, last: null };
}

describe('Checkers', () => {
  it('starts with 12 pieces each on dark squares and 7 opening moves', () => {
    const e = new CheckersEngine();
    const v = e.view;
    expect(v.board.filter((p) => p?.side === 0)).toHaveLength(12);
    expect(v.board.filter((p) => p?.side === 1)).toHaveLength(12);
    v.board.forEach((p, s) => p && expect((Math.floor(s / 8) + (s % 8)) % 2).toBe(1));
    expect(e.moves()).toHaveLength(7);
    expect(e.moves().every((m) => m.captures.length === 0)).toBe(true);
  });

  it('men move forward only; kings both ways', () => {
    const b = board([[sq(4, 3), man(0)], [sq(2, 5), king(0)]]);
    const targets = legalMoves(b, 0).map((m) => `${m.from}>${m.path}`);
    expect(targets).toContain(`${sq(4, 3)}>${sq(3, 2)}`);
    expect(targets).not.toContain(`${sq(4, 3)}>${sq(5, 2)}`);
    expect(targets).toContain(`${sq(2, 5)}>${sq(3, 6)}`);
    expect(targets).toHaveLength(6);
  });

  it('captures are compulsory and multi-jumps continue', () => {
    const b = board([
      [sq(6, 1), man(0)],
      [sq(5, 2), man(1)],
      [sq(3, 4), man(1)],
      [sq(6, 7), man(0)],
    ]);
    const moves = legalMoves(b, 0);
    expect(moves).toEqual([{ from: sq(6, 1), path: [sq(4, 3), sq(2, 5)], captures: [sq(5, 2), sq(3, 4)] }]);
    const after = applyMove(b, moves[0]);
    expect(after.filter((p) => p?.side === 1)).toHaveLength(0);
    expect(after[sq(2, 5)]?.side).toBe(0);
  });

  it('captures are optional by default: jump or make a quiet move', () => {
    const e = new CheckersEngine();
    expect(e.forced).toBe(false);
    at(e, board([[sq(6, 1), man(0)], [sq(5, 2), man(1)], [sq(6, 7), man(0)]]));
    const moves = e.moves();
    expect(moves[0].captures).toEqual([sq(5, 2)]);
    expect(moves.filter((m) => !m.captures.length).length).toBeGreaterThan(0);
    // Declining the capture is a legal move.
    expect(e.play({ from: sq(6, 7), path: [sq(5, 6)], captures: [] })).toBe(true);
    // With the standard rule on, only the capture is allowed.
    const f = new CheckersEngine(true);
    at(f, board([[sq(6, 1), man(0)], [sq(5, 2), man(1)], [sq(6, 7), man(0)]]));
    expect(f.moves()).toHaveLength(1);
    expect(f.play({ from: sq(6, 7), path: [sq(5, 6)], captures: [] })).toBe(false);
  });

  it('a man crowned by a jump stops there and becomes a king', () => {
    const b = board([
      [sq(2, 1), man(0)],
      [sq(1, 2), man(1)],
      // Would be capturable by a king from (0,3), but the crowning ends the move.
      [sq(1, 4), man(1)],
    ]);
    const moves = legalMoves(b, 0);
    expect(moves).toEqual([{ from: sq(2, 1), path: [sq(0, 3)], captures: [sq(1, 2)] }]);
    expect(applyMove(b, moves[0])[sq(0, 3)]?.king).toBe(true);
  });

  it('a side with no moves loses', () => {
    const e = new CheckersEngine();
    // Black's only man is blocked: the square ahead is taken and the jump lands on our other man.
    at(e, board([[sq(0, 7), man(1)], [sq(1, 6), man(0)], [sq(2, 5), man(0)]]), 1);
    expect(e.moves()).toHaveLength(0);
    expect(e.result()).toBe(0);
  });

  it('play and undo return to your turn', () => {
    const e = new CheckersEngine();
    const start = e.view.board;
    expect(e.play(e.moves()[0])).toBe(true);
    expect(e.view.turn).toBe(1);
    expect(e.play(e.moves()[0])).toBe(true);
    expect(e.undo()).toBe(true);
    expect(e.view.turn).toBe(0);
    expect(e.view.board).toEqual(start);
  });

  it('the AI takes a free piece and avoids hanging its own', () => {
    const e = new CheckersEngine();
    // Black to move in a quiet position: whatever it plays must not hand us a capture.
    at(e, board([[sq(2, 3), man(1)], [sq(5, 4), man(0)], [sq(7, 0), man(0)]]), 1);
    for (const level of ['normal', 'hard'] as const) {
      const m = e.bestMove(level, seededRng(1))!;
      const after = applyMove(e.view.board, m);
      expect(legalMoves(after, 0).some((x) => x.captures.length)).toBe(false);
    }
    at(e, board([[sq(2, 3), man(1)], [sq(3, 4), man(0)], [sq(7, 0), man(0)]]), 1);
    expect(e.bestMove('normal', seededRng(1))!.captures).toEqual([sq(3, 4)]);
  });

  it.each([false, true])('computer vs computer games finish (forced %s)', (forced) => {
    const rng = seededRng(4);
    const e = new CheckersEngine(forced);
    let n = 0;
    while (e.result() === null && n < 400) {
      e.play(e.bestMove(n % 2 ? 'hard' : 'normal', rng)!);
      n++;
    }
    expect(e.result()).not.toBeNull();
  });
});
