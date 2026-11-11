/**
 * Chess with the full rules: castling, en passant, promotion, check, checkmate and stalemate,
 * plus draws by the fifty-move rule, threefold repetition and insufficient material.
 *
 * Squares are numbered row * 8 + col with row 0 the top (rank 8) and col 0 file a, so a1 is 56
 * and e1 is 60. Side 0 is White, side 1 is Black. Pieces on the board are signed numbers:
 * positive for White, negative for Black (1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king).
 *
 * The computer searches with negamax, alpha-beta, a capture search at the leaves and iterative
 * deepening under a time budget. `search` is pure and runs in a web worker in the browser.
 */

export type Side = 0 | 1;
export type Level = 'easy' | 'normal' | 'hard' | 'expert';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const TYPES: PieceType[] = ['p', 'p', 'n', 'b', 'r', 'q', 'k'];

/** Move flags. */
const EP = 1, CASTLE = 2, DOUBLE = 4;

/** A move packed in a number: from | to << 6 | promotion piece << 12 | flags << 16. */
export type Move = number;
export const fromOf = (m: Move) => m & 63;
export const toOf = (m: Move) => (m >> 6) & 63;
export const promoOf = (m: Move) => (m >> 12) & 7;
const flagsOf = (m: Move) => m >> 16;
const pack = (from: number, to: number, promo = 0, flags = 0): Move => from | (to << 6) | (promo << 12) | (flags << 16);

export const rowOf = (sq: number) => sq >> 3;
export const colOf = (sq: number) => sq & 7;
export const sqName = (sq: number) => 'abcdefgh'[colOf(sq)] + (8 - rowOf(sq));
export const sideOf = (v: number): Side => (v > 0 ? 0 : 1);

// ------------------------------------------------------------------ geometry

function targets(dirs: number[][], slide: boolean): number[][][] {
  return Array.from({ length: 64 }, (_, sq) =>
    dirs.map(([dr, dc]) => {
      const out: number[] = [];
      let r = rowOf(sq) + dr, c = colOf(sq) + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        out.push(r * 8 + c);
        if (!slide) break;
        r += dr;
        c += dc;
      }
      return out;
    }),
  );
}
const KNIGHT_SQ = targets([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], false).map((d) => d.flat());
const KING_SQ = targets([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]], false).map((d) => d.flat());
/** Rays per square: four rook directions, then four bishop directions. */
const RAYS = targets([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]], true);

/** Castling rights kept after a move touches a square: 1 White O-O, 2 White O-O-O, 4 Black O-O, 8 Black O-O-O. */
const CASTLE_KEEP = Array.from({ length: 64 }, (_, sq) =>
  ({ 60: ~3, 63: ~1, 56: ~2, 4: ~12, 7: ~4, 0: ~8 } as Record<number, number>)[sq] ?? 15,
);

// ------------------------------------------------------------------ position

export interface PositionData {
  board: number[];
  turn: Side;
  castling: number;
  ep: number;
  half: number;
}

interface Undo {
  m: Move;
  captured: number;
  capSq: number;
  castling: number;
  ep: number;
  half: number;
}

export class Position {
  board: Int8Array;
  turn: Side;
  castling: number;
  /** En-passant target square, or -1. */
  ep: number;
  /** Half-moves since the last capture or pawn move. */
  half: number;
  kings: [number, number] = [-1, -1];
  private stack: Undo[] = [];

  constructor(d: PositionData) {
    this.board = Int8Array.from(d.board);
    this.turn = d.turn;
    this.castling = d.castling;
    this.ep = d.ep;
    this.half = d.half;
    this.board.forEach((v, sq) => {
      if (v === KING) this.kings[0] = sq;
      if (v === -KING) this.kings[1] = sq;
    });
  }

  static start(): Position {
    const back = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
    const board = Array(64).fill(0);
    back.forEach((p, c) => {
      board[c] = -p;
      board[8 + c] = -PAWN;
      board[48 + c] = PAWN;
      board[56 + c] = p;
    });
    return new Position({ board, turn: 0, castling: 15, ep: -1, half: 0 });
  }

  /** From Forsyth–Edwards Notation (the first four fields, plus the half-move clock if given). */
  static fromFen(fen: string): Position {
    const [placement, turn, castling, ep, half] = fen.trim().split(/\s+/);
    const board: number[] = [];
    for (const ch of placement.replace(/\//g, '')) {
      if (/\d/.test(ch)) board.push(...Array(Number(ch)).fill(0));
      else {
        const t = TYPES.indexOf(ch.toLowerCase() as PieceType, 1);
        board.push(ch === ch.toUpperCase() ? t : -t);
      }
    }
    const rights = [...(castling ?? '-')].reduce((r, c) => r | ({ K: 1, Q: 2, k: 4, q: 8 } as Record<string, number>)[c] || r, 0);
    const epSq = ep && ep !== '-' ? (8 - Number(ep[1])) * 8 + 'abcdefgh'.indexOf(ep[0]) : -1;
    return new Position({ board, turn: turn === 'b' ? 1 : 0, castling: rights, ep: epSq, half: Number(half ?? 0) || 0 });
  }

  data(): PositionData {
    return { board: Array.from(this.board), turn: this.turn, castling: this.castling, ep: this.ep, half: this.half };
  }

  /** A hash identifying the position for repetition (en passant only counts when it can be taken). */
  key(): number {
    let ep = 64;
    if (this.ep >= 0) {
      const pawn = this.turn === 0 ? PAWN : -PAWN;
      const from = this.ep + (this.turn === 0 ? 8 : -8);
      if ((colOf(this.ep) > 0 && this.board[from - 1] === pawn) || (colOf(this.ep) < 7 && this.board[from + 1] === pawn)) ep = this.ep;
    }
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const mix = (v: number) => {
      h1 = Math.imul(h1 ^ (v & 255), 0x01000193);
      h2 = Math.imul(h2 ^ (v & 255), 0x5bd1e995) ^ (h2 >>> 15);
    };
    for (let i = 0; i < 64; i++) mix(this.board[i]);
    mix(this.turn);
    mix(this.castling);
    mix(ep);
    return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
  }

  /** Is `sq` attacked by `by`? */
  attacked(sq: number, by: Side): boolean {
    const b = this.board;
    const s = by === 0 ? 1 : -1;
    // Pawns attack diagonally forward: a White pawn on the row below attacks up.
    const pr = rowOf(sq) + (by === 0 ? 1 : -1);
    if (pr >= 0 && pr < 8) {
      const c = colOf(sq);
      if (c > 0 && b[pr * 8 + c - 1] === s * PAWN) return true;
      if (c < 7 && b[pr * 8 + c + 1] === s * PAWN) return true;
    }
    for (const t of KNIGHT_SQ[sq]) if (b[t] === s * KNIGHT) return true;
    for (const t of KING_SQ[sq]) if (b[t] === s * KING) return true;
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      const slider = d < 4 ? ROOK : BISHOP;
      for (const t of rays[d]) {
        const v = b[t];
        if (!v) continue;
        if (v === s * slider || v === s * QUEEN) return true;
        break;
      }
    }
    return false;
  }

  inCheck(side: Side = this.turn): boolean {
    return this.attacked(this.kings[side], (1 - side) as Side);
  }

  /** Pseudo-legal moves (may leave the king in check). */
  pseudo(capturesOnly = false): Move[] {
    const b = this.board;
    const me = this.turn;
    const s = me === 0 ? 1 : -1;
    const out: Move[] = [];
    const enemy = (v: number) => v * s < 0;
    for (let sq = 0; sq < 64; sq++) {
      const v = b[sq] * s;
      if (v <= 0) continue;
      if (v === PAWN) {
        const fwd = me === 0 ? -8 : 8;
        const last = me === 0 ? 0 : 7;
        const startRow = me === 0 ? 6 : 1;
        const one = sq + fwd;
        const add = (to: number, flags = 0) => {
          if (rowOf(to) === last) for (const p of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(pack(sq, to, p, flags));
          else out.push(pack(sq, to, 0, flags));
        };
        if (!b[one] && (!capturesOnly || rowOf(one) === last)) {
          add(one);
          if (!capturesOnly && rowOf(sq) === startRow && !b[one + fwd]) out.push(pack(sq, one + fwd, 0, DOUBLE));
        }
        for (const dc of [-1, 1]) {
          const c = colOf(sq) + dc;
          if (c < 0 || c > 7) continue;
          const to = one + dc;
          if (enemy(b[to])) add(to);
          else if (to === this.ep) out.push(pack(sq, to, 0, EP));
        }
      } else if (v === KNIGHT || v === KING) {
        for (const to of (v === KNIGHT ? KNIGHT_SQ : KING_SQ)[sq]) {
          if (b[to] * s > 0 || (capturesOnly && !b[to])) continue;
          out.push(pack(sq, to));
        }
        if (v === KING && !capturesOnly) this.castles(sq, out);
      } else {
        const rays = RAYS[sq];
        const d0 = v === BISHOP ? 4 : 0;
        const d1 = v === ROOK ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          for (const to of rays[d]) {
            const t = b[to];
            if (t * s > 0) break;
            if (t || !capturesOnly) out.push(pack(sq, to));
            if (t) break;
          }
        }
      }
    }
    return out;
  }

  private castles(sq: number, out: Move[]): void {
    const me = this.turn;
    const home = me === 0 ? 60 : 4;
    if (sq !== home) return;
    const b = this.board;
    const foe = (1 - me) as Side;
    const [ks, qs] = me === 0 ? [1, 2] : [4, 8];
    const rook = me === 0 ? ROOK : -ROOK;
    if (this.castling & ks && !b[home + 1] && !b[home + 2] && b[home + 3] === rook && !this.attacked(home, foe) && !this.attacked(home + 1, foe) && !this.attacked(home + 2, foe))
      out.push(pack(home, home + 2, 0, CASTLE));
    if (this.castling & qs && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook && !this.attacked(home, foe) && !this.attacked(home - 1, foe) && !this.attacked(home - 2, foe))
      out.push(pack(home, home - 2, 0, CASTLE));
  }

  legal(): Move[] {
    const me = this.turn;
    return this.pseudo().filter((m) => {
      this.make(m);
      const ok = !this.inCheck(me);
      this.unmake();
      return ok;
    });
  }

  make(m: Move): void {
    const b = this.board;
    const from = fromOf(m), to = toOf(m), promo = promoOf(m), flags = flagsOf(m);
    const piece = b[from];
    const s = piece > 0 ? 1 : -1;
    let capSq = to;
    if (flags & EP) capSq = to + (this.turn === 0 ? 8 : -8);
    const captured = b[capSq];
    this.stack.push({ m, captured, capSq, castling: this.castling, ep: this.ep, half: this.half });
    b[capSq] = 0;
    b[from] = 0;
    b[to] = promo ? promo * s : piece;
    if (flags & CASTLE) {
      const [rf, rt] = to > from ? [to + 1, to - 1] : [to - 2, to + 1];
      b[rt] = b[rf];
      b[rf] = 0;
    }
    if (piece * s === KING) this.kings[this.turn] = to;
    this.castling &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
    this.ep = flags & DOUBLE ? (from + to) >> 1 : -1;
    this.half = piece * s === PAWN || captured ? 0 : this.half + 1;
    this.turn = (1 - this.turn) as Side;
  }

  unmake(): void {
    const u = this.stack.pop()!;
    const b = this.board;
    const from = fromOf(u.m), to = toOf(u.m), promo = promoOf(u.m), flags = flagsOf(u.m);
    this.turn = (1 - this.turn) as Side;
    const s = this.turn === 0 ? 1 : -1;
    b[from] = promo ? PAWN * s : b[to];
    b[to] = 0;
    b[u.capSq] = u.captured;
    if (flags & CASTLE) {
      const [rf, rt] = to > from ? [to + 1, to - 1] : [to - 2, to + 1];
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if (b[from] * s === KING) this.kings[this.turn] = from;
    this.castling = u.castling;
    this.ep = u.ep;
    this.half = u.half;
  }

  /** Neither side can possibly checkmate: bare kings, one knight or bishop, or only bishops all on one square colour. */
  insufficient(): boolean {
    const minors: { t: number; colour: number }[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const t = Math.abs(this.board[sq]);
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT || t === BISHOP) minors.push({ t, colour: (rowOf(sq) + colOf(sq)) % 2 });
    }
    if (minors.length <= 1) return true;
    return minors.every((m) => m.t === BISHOP) && new Set(minors.map((m) => m.colour)).size === 1;
  }

  /** How many moves are made and not yet unmade. */
  get depth(): number {
    return this.stack.length;
  }
}

// ------------------------------------------------------------------ notation

/** Standard algebraic notation for a legal move in `pos` (e.g. Nf3, exd5, O-O, e8=Q+). */
export function san(pos: Position, m: Move): string {
  const from = fromOf(m), to = toOf(m);
  const t = Math.abs(pos.board[from]);
  let out: string;
  if (flagsOf(m) & CASTLE) out = to > from ? 'O-O' : 'O-O-O';
  else {
    const capture = !!pos.board[to] || !!(flagsOf(m) & EP);
    if (t === PAWN) out = (capture ? 'abcdefgh'[colOf(from)] + 'x' : '') + sqName(to) + (promoOf(m) ? '=' + TYPES[promoOf(m)].toUpperCase() : '');
    else {
      const rivals = pos.legal().filter((x) => x !== m && toOf(x) === to && Math.abs(pos.board[fromOf(x)]) === t).map(fromOf);
      let dis = '';
      if (rivals.length) {
        if (!rivals.some((r) => colOf(r) === colOf(from))) dis = 'abcdefgh'[colOf(from)];
        else if (!rivals.some((r) => rowOf(r) === rowOf(from))) dis = String(8 - rowOf(from));
        else dis = sqName(from);
      }
      out = TYPES[t].toUpperCase() + dis + (capture ? 'x' : '') + sqName(to);
    }
  }
  pos.make(m);
  if (pos.inCheck()) out += pos.legal().length ? '+' : '#';
  pos.unmake();
  return out;
}

// ------------------------------------------------------------------ evaluation

const VALUE = [0, 100, 320, 330, 500, 900, 0];

/* Piece-square tables from White's side, row 0 = rank 8 (the "simplified evaluation function"). */
const PST: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

/** Static score from the side to move's point of view, in centipawns. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  let score = 0;
  let heavy = 0;
  const bishops = [0, 0];
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v || Math.abs(v) === KING) continue;
    const t = Math.abs(v);
    if (t !== PAWN) heavy += VALUE[t];
    if (t === BISHOP) bishops[sideOf(v)]++;
    const idx = v > 0 ? sq : (7 - rowOf(sq)) * 8 + colOf(sq);
    score += (v > 0 ? 1 : -1) * (VALUE[t] + PST[t][idx]);
  }
  // Kings walk to the centre once most pieces are gone.
  const kingTable = heavy <= 2600 ? KING_END : PST[KING];
  const [wk, bk] = pos.kings;
  score += kingTable[wk] - kingTable[(7 - rowOf(bk)) * 8 + colOf(bk)];
  if (bishops[0] >= 2) score += 30;
  if (bishops[1] >= 2) score -= 30;
  return pos.turn === 0 ? score : -score;
}

// ------------------------------------------------------------------ search

export const MATE = 100000;

export interface SearchRequest {
  pos: PositionData;
  level: Level;
  /** Earlier positions in the game (keys), so the computer avoids or seeks repetition. */
  history: number[];
  seed: number;
}

const LEVELS: Record<Level, { depth: number; ms: number; noise: number; blunder: number }> = {
  easy: { depth: 1, ms: 200, noise: 60, blunder: 0.3 },
  normal: { depth: 2, ms: 400, noise: 20, blunder: 0 },
  hard: { depth: 4, ms: 900, noise: 0, blunder: 0 },
  expert: { depth: 7, ms: 1800, noise: 0, blunder: 0 },
};

class Timeout extends Error {}

/** Captures first (most valuable victim, least valuable attacker), then promotions. */
function ordered(pos: Position, moves: Move[], first: Move, killers: Move[]): Move[] {
  const b = pos.board;
  const score = (m: Move) => {
    if (m === first) return 1e6;
    const victim = Math.abs(b[toOf(m)]) || (flagsOf(m) & EP ? PAWN : 0);
    let s = 0;
    if (victim) s += 10000 + VALUE[victim] * 10 - VALUE[Math.abs(b[fromOf(m)])] / 10;
    if (promoOf(m)) s += 9000 + VALUE[promoOf(m)];
    if (killers.includes(m)) s += 5000;
    return s;
  };
  return moves.map((m) => [score(m), m]).sort((a, b2) => b2[0] - a[0]).map((x) => x[1]);
}

/** The computer's move for the side to move, or null if there is none. */
export function search(req: SearchRequest): Move | null {
  const pos = new Position(req.pos);
  const cfg = LEVELS[req.level];
  let seed = req.seed >>> 0 || 1;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const rootMoves = pos.legal();
  if (rootMoves.length <= 1) return rootMoves[0] ?? null;
  if (cfg.blunder && rng() < cfg.blunder) return rootMoves[Math.floor(rng() * rootMoves.length)];

  const deadline = Date.now() + cfg.ms;
  let nodes = 0;
  const killers: Move[][] = [];
  const seen = new Map<number, number>();
  for (const k of req.history) seen.set(k, (seen.get(k) ?? 0) + 1);

  const tick = () => {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) throw new Timeout();
  };

  const quiesce = (alpha: number, beta: number): number => {
    tick();
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const me = pos.turn;
    for (const m of ordered(pos, pos.pseudo(true), 0, [])) {
      pos.make(m);
      if (pos.inCheck(me)) {
        pos.unmake();
        continue;
      }
      const score = -quiesce(-beta, -alpha);
      pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const negamax = (depth: number, alpha: number, beta: number, ply: number): number => {
    tick();
    if (pos.half >= 100) return 0;
    const key = pos.key();
    if ((seen.get(key) ?? 0) >= 1 && ply > 0) return 0; // a repeat is as good as a draw
    const check = pos.inCheck();
    if (check) depth++;
    if (depth <= 0) return quiesce(alpha, beta);
    const me = pos.turn;
    let legal = 0;
    let best = -Infinity;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    for (const m of ordered(pos, pos.pseudo(), 0, killers[ply] ?? [])) {
      pos.make(m);
      if (pos.inCheck(me)) {
        pos.unmake();
        continue;
      }
      legal++;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      pos.unmake();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!pos.board[toOf(m)]) killers[ply] = [m, ...(killers[ply] ?? [])].slice(0, 2);
        break;
      }
    }
    seen.set(key, seen.get(key)! - 1);
    if (!legal) return check ? -MATE + ply : 0;
    return best;
  };

  let bestMove = rootMoves[0];
  let order = ordered(pos, rootMoves, 0, []);
  for (let depth = 1; depth <= cfg.depth; depth++) {
    try {
      const scored: [number, Move][] = [];
      let alpha = -Infinity;
      for (const m of order) {
        pos.make(m);
        // Noise only at the leaves of shallow levels, to vary their play.
        const score = -negamax(depth - 1, -Infinity, -alpha + cfg.noise + 1, 1) + (cfg.noise ? (rng() - 0.5) * cfg.noise : 0);
        pos.unmake();
        scored.push([score, m]);
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b[0] - a[0]);
      // Pick at random among moves equal to the best, so games vary.
      const top = scored.filter((s) => s[0] >= scored[0][0] - (cfg.noise ? cfg.noise / 4 : 0.5));
      bestMove = top[Math.floor(rng() * top.length)][1];
      order = [bestMove, ...scored.map((s) => s[1]).filter((m) => m !== bestMove)];
      if (scored[0][0] > MATE - 100) break; // found a mate
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      // Restore the position: unwind any moves made before the timeout.
      while (pos.depth) pos.unmake();
      break;
    }
  }
  return bestMove;
}

// ------------------------------------------------------------------ game

export type Result =
  | { winner: Side; reason: 'checkmate' }
  | { winner: null; reason: 'stalemate' | 'fifty' | 'repetition' | 'material' };

export interface Played {
  move: Move;
  san: string;
  side: Side;
  captured: number;
}

/** A game in progress: the position, its history and stable ids for drawing pieces. */
export class ChessGame {
  pos = Position.start();
  /** A stable id per piece so moves can be animated; -1 for empty squares. */
  ids: number[] = Array.from({ length: 64 }, (_, sq) => (sq < 16 || sq >= 48 ? sq : -1));
  moves: Played[] = [];
  keys: number[] = [this.pos.key()];
  private undoStack: { ids: number[] }[] = [];

  legal(): Move[] {
    return this.pos.legal();
  }

  result(): Result | null {
    if (!this.pos.legal().length) return this.pos.inCheck() ? { winner: (1 - this.pos.turn) as Side, reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
    if (this.pos.half >= 100) return { winner: null, reason: 'fifty' };
    if (this.pos.insufficient()) return { winner: null, reason: 'material' };
    const key = this.keys[this.keys.length - 1];
    if (this.keys.filter((k) => k === key).length >= 3) return { winner: null, reason: 'repetition' };
    return null;
  }

  play(m: Move): boolean {
    if (!this.legal().includes(m)) return false;
    const from = fromOf(m), to = toOf(m);
    const side = this.pos.turn;
    const notation = san(this.pos, m);
    const capSq = flagsOf(m) & EP ? to + (side === 0 ? 8 : -8) : to;
    const captured = this.pos.board[capSq];
    this.undoStack.push({ ids: this.ids.slice() });
    const ids = this.ids;
    ids[capSq] = -1;
    ids[to] = ids[from];
    ids[from] = -1;
    if (flagsOf(m) & CASTLE) {
      const [rf, rt] = to > from ? [to + 1, to - 1] : [to - 2, to + 1];
      ids[rt] = ids[rf];
      ids[rf] = -1;
    }
    this.pos.make(m);
    this.moves.push({ move: m, san: notation, side, captured });
    this.keys.push(this.pos.key());
    return true;
  }

  /** Take back one half-move. */
  undo(): boolean {
    const u = this.undoStack.pop();
    if (!u) return false;
    this.pos.unmake();
    this.ids = u.ids;
    this.moves.pop();
    this.keys.pop();
    return true;
  }

  request(level: Level, seed: number): SearchRequest {
    return { pos: this.pos.data(), level, history: this.keys, seed };
  }
}
