import { Rng } from '../core/deck';

/**
 * Checkers (American / English draughts) on an 8×8 board, you against the computer.
 * Pieces sit on the dark squares; men move one square diagonally forward and kings both ways.
 * Captures are optional by default (you choose whether to jump); with `forced` on, as in the
 * standard rules, any available capture must be taken. Either way a capturing piece keeps jumping
 * while it can, and you may choose any capture sequence, not only the longest. A man reaching the far row is crowned and
 * its move ends there. You lose when you have no pieces or no legal move. After 80 plies with
 * no capture and no man moved, the game is a draw.
 *
 * Side 0 (you) starts at the bottom (rows 5–7) and moves first; side 1 starts at the top.
 */

export type Side = 0 | 1;
export type Level = 'easy' | 'normal' | 'hard' | 'expert';

export interface Piece {
  id: number;
  side: Side;
  king: boolean;
}

/** Board squares, index row * 8 + col; row 0 is the top. */
export type Board = (Piece | null)[];

export interface Move {
  from: number;
  /** Every square the piece lands on, in order (one for a step, one per jump). */
  path: number[];
  /** Squares of the pieces captured, in order. */
  captures: number[];
}

export interface CheckersState {
  board: Board;
  turn: Side;
  /** Plies since the last capture or man move, for the draw rule. */
  quiet: number;
  plies: number;
  last: Move | null;
}

export const DRAW_PLIES = 80;
const DEPTH: Record<Level, number> = { easy: 1, normal: 3, hard: 5, expert: 8 };

export const rowOf = (sq: number) => Math.floor(sq / 8);
export const colOf = (sq: number) => sq % 8;
export const isDark = (sq: number) => (rowOf(sq) + colOf(sq)) % 2 === 1;

export function initialBoard(): Board {
  let id = 0;
  return Array.from({ length: 64 }, (_, sq) => {
    if (!isDark(sq)) return null;
    const r = rowOf(sq);
    if (r <= 2) return { id: id++, side: 1, king: false };
    if (r >= 5) return { id: id++, side: 0, king: false };
    return null;
  });
}

const forward = (side: Side) => (side === 0 ? -1 : 1);
const kingRow = (side: Side) => (side === 0 ? 0 : 7);

function dirs(p: Piece): [number, number][] {
  const f = forward(p.side);
  return p.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[f, -1], [f, 1]];
}

function at(r: number, c: number): number | null {
  return r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : null;
}

/** Every legal move for `side`, captures first; with `forced`, only captures when any exists. */
export function legalMoves(board: Board, side: Side, forced = true): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  board.forEach((p, sq) => {
    if (!p || p.side !== side) return;
    collectJumps(board, sq, p, sq, [], [], jumps);
    if (forced && jumps.length) return;
    for (const [dr, dc] of dirs(p)) {
      const to = at(rowOf(sq) + dr, colOf(sq) + dc);
      if (to !== null && !board[to]) steps.push({ from: sq, path: [to], captures: [] });
    }
  });
  return forced && jumps.length ? jumps : [...jumps, ...steps];
}

function collectJumps(board: Board, from: number, p: Piece, sq: number, path: number[], captures: number[], out: Move[]): void {
  let extended = false;
  // A man crowned mid-sequence stops there.
  const crowned = !p.king && path.length > 0 && rowOf(sq) === kingRow(p.side);
  if (!crowned) {
    for (const [dr, dc] of dirs(p)) {
      const over = at(rowOf(sq) + dr, colOf(sq) + dc);
      const to = at(rowOf(sq) + 2 * dr, colOf(sq) + 2 * dc);
      if (over === null || to === null) continue;
      const victim = board[over];
      if (!victim || victim.side === p.side || captures.includes(over)) continue;
      if (board[to] && to !== from) continue;
      extended = true;
      collectJumps(board, from, p, to, [...path, to], [...captures, over], out);
    }
  }
  if (!extended && path.length) out.push({ from, path, captures });
}

/** The board after `move`; the input is not changed. */
export function applyMove(board: Board, move: Move): Board {
  const next = board.slice();
  const p = next[move.from]!;
  next[move.from] = null;
  for (const c of move.captures) next[c] = null;
  const to = move.path[move.path.length - 1];
  next[to] = p.king || rowOf(to) !== kingRow(p.side) ? p : { ...p, king: true };
  return next;
}

export const sameMove = (a: Move, b: Move) => a.from === b.from && a.path.join() === b.path.join();

export class CheckersEngine {
  private state: CheckersState;
  private history: CheckersState[] = [];

  /** Standard rule: an available capture must be taken. Off by default. */
  constructor(public forced = false) {
    this.state = { board: initialBoard(), turn: 0, quiet: 0, plies: 0, last: null };
  }

  get view(): CheckersState {
    return structuredClone(this.state);
  }

  moves(): Move[] {
    return legalMoves(this.state.board, this.state.turn, this.forced);
  }

  /** The winner, 'draw', or null while play goes on. */
  result(): Side | 'draw' | null {
    if (this.state.quiet >= DRAW_PLIES) return 'draw';
    return this.moves().length ? null : ((1 - this.state.turn) as Side);
  }

  play(move: Move): boolean {
    const legal = this.moves().find((m) => sameMove(m, move));
    if (!legal || this.result() !== null) return false;
    this.history.push(this.state);
    const s = this.state;
    const manMoved = !s.board[legal.from]!.king;
    this.state = {
      board: applyMove(s.board, legal),
      turn: (1 - s.turn) as Side,
      quiet: legal.captures.length || manMoved ? 0 : s.quiet + 1,
      plies: s.plies + 1,
      last: legal,
    };
    return true;
  }

  /** Back to the start of your previous turn (undoing the computer's reply too). */
  undo(): boolean {
    if (!this.history.length) return false;
    do this.state = this.history.pop()!;
    while (this.state.turn !== 0 && this.history.length);
    return true;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** The computer's choice for the side to move. */
  bestMove(level: Level, rng: Rng): Move | null {
    const moves = this.moves();
    if (moves.length <= 1) return moves[0] ?? null;
    if (level === 'easy' && rng() < 0.35) return moves[Math.floor(rng() * moves.length)];
    const side = this.state.turn;
    // Optional captures mean many more moves to weigh, so Expert looks one ply less deep.
    const depth = this.forced ? DEPTH[level] : Math.min(DEPTH[level], 7);
    let best: Move[] = [];
    let bestScore = -Infinity;
    for (const m of order(moves)) {
      const score = -search(applyMove(this.state.board, m), (1 - side) as Side, depth - 1, -Infinity, -bestScore + 1, this.forced);
      if (score > bestScore) {
        bestScore = score;
        best = [m];
      } else if (score === bestScore) best.push(m);
    }
    return best[Math.floor(rng() * best.length)];
  }
}

/** Captures first, longest first: makes alpha-beta cut sooner. */
function order(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => b.captures.length - a.captures.length);
}

/** Negamax with alpha-beta; scores are from `side`'s point of view. */
function search(board: Board, side: Side, depth: number, alpha: number, beta: number, forced: boolean): number {
  const moves = legalMoves(board, side, forced);
  if (!moves.length) return -10000 - depth; // losing sooner is worse
  let best = -Infinity;
  let list = order(moves);
  // Past the horizon keep playing out captures so the evaluation doesn't stop mid-exchange.
  if (depth <= 0) {
    if (!moves[0].captures.length || depth <= -6) return evaluate(board, side);
    if (!forced) {
      // Captures are optional: the side to move can also decline them ("stand pat").
      best = evaluate(board, side);
      if (best > alpha) alpha = best;
      if (alpha >= beta) return best;
      list = list.filter((m) => m.captures.length);
    }
  }
  for (const m of list) {
    const score = -search(applyMove(board, m), (1 - side) as Side, depth - 1, -beta, -alpha, forced);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Material, plus small bonuses for advancing men, central squares and a guarded back row. */
export function evaluate(board: Board, side: Side): number {
  let score = 0;
  board.forEach((p, sq) => {
    if (!p) return;
    const r = rowOf(sq);
    const c = colOf(sq);
    let v = p.king ? 160 : 100;
    if (!p.king) v += (p.side === 0 ? 7 - r : r) * 3;
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 4;
    if (!p.king && r === (p.side === 0 ? 7 : 0)) v += 6;
    score += p.side === side ? v : -v;
  });
  return score;
}
