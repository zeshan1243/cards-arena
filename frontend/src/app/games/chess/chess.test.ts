import { describe, expect, it } from 'vitest';
import { ChessGame, Position, fromOf, search, sqName, toOf } from './chess.engine';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pos.legal()) {
    pos.make(m);
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

/** Play moves given as "e2e4"-style coordinates (with an optional promotion letter). */
function playAll(g: ChessGame, line: string): void {
  for (const uci of line.split(' ')) {
    const m = g.legal().find((x) => sqName(fromOf(x)) + sqName(toOf(x)) === uci.slice(0, 4) && (uci.length < 5 || '.pnbrqk'.indexOf(uci[4]) === ((x >> 12) & 7)));
    if (m === undefined) throw new Error(`illegal ${uci}`);
    g.play(m);
  }
}

describe('Chess move generation (perft)', () => {
  it('start position', () => {
    const p = Position.start();
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([20, 400, 8902]);
  });

  it('"Kiwipete": castling, en passant, promotions and pins', () => {
    const p = Position.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([48, 2039, 97862]);
  });

  it('endgame with discovered checks and en passant', () => {
    const p = Position.fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
    expect([1, 2, 3, 4].map((d) => perft(p, d))).toEqual([14, 191, 2812, 43238]);
  });

  it('promotion-heavy position', () => {
    const p = Position.fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([6, 264, 9467]);
  });

  it('make/unmake restores the position exactly', () => {
    const p = Position.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
    const before = p.key();
    perft(p, 2);
    expect(p.key()).toBe(before);
    expect(p.depth).toBe(0);
  });
});

describe('Chess game', () => {
  it('fool’s mate is checkmate with notation', () => {
    const g = new ChessGame();
    playAll(g, 'f2f3 e7e5 g2g4 d8h4');
    expect(g.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(g.result()).toEqual({ winner: 1, reason: 'checkmate' });
  });

  it('castling moves the rook and keeps piece ids', () => {
    const g = new ChessGame();
    playAll(g, 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1');
    expect(g.moves.at(-1)!.san).toBe('O-O');
    expect(g.pos.board[62]).toBe(6);
    expect(g.pos.board[61]).toBe(4);
    expect(g.ids[61]).toBe(63);
    expect(g.ids[62]).toBe(60);
  });

  it('en passant removes the passed pawn', () => {
    const g = new ChessGame();
    playAll(g, 'e2e4 a7a6 e4e5 d7d5 e5d6');
    expect(g.moves.at(-1)!.san).toBe('exd6');
    expect(g.pos.board[27]).toBe(0);
    expect(g.ids[27]).toBe(-1);
  });

  it('stalemate and insufficient material are draws', () => {
    const stale = Position.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - -');
    expect(stale.legal()).toHaveLength(0);
    expect(stale.inCheck()).toBe(false);
    expect(Position.fromFen('8/8/4k3/8/8/2B5/4K3/8 w - -').insufficient()).toBe(true);
    expect(Position.fromFen('8/8/4k3/8/8/2B5/4K1N1/8 w - -').insufficient()).toBe(false);
    expect(Position.fromFen('8/8/4k3/8/8/2B5/4KP2/8 w - -').insufficient()).toBe(false);
  });

  it('threefold repetition is a draw; undo steps back', () => {
    const g = new ChessGame();
    playAll(g, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
    expect(g.result()).toEqual({ winner: null, reason: 'repetition' });
    g.undo();
    expect(g.result()).toBeNull();
  });

  it('the computer finds mate in one and grabs a free queen', () => {
    const mate = Position.fromFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - -');
    const m = search({ pos: mate.data(), level: 'normal', history: [], seed: 1 })!;
    expect(sqName(fromOf(m)) + sqName(toOf(m))).toBe('a1a8');
    const queen = Position.fromFen('4k3/8/8/3q4/8/8/3R4/4K3 w - -');
    const q = search({ pos: queen.data(), level: 'normal', history: [], seed: 1 })!;
    expect(sqName(toOf(q))).toBe('d5');
  });

  it('every level replies quickly from the opening', () => {
    const g = new ChessGame();
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const t = Date.now();
      const m = search(g.request(level, 7));
      expect(g.legal()).toContain(m);
      expect(Date.now() - t).toBeLessThan(2500);
    }
  }, 15000);
});
