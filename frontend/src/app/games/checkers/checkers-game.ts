import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { seededRng } from '../core/deck';
import { Board, CheckersEngine, CheckersState, Level, Move, Side, colOf, isDark, rowOf } from './checkers.engine';

interface Stats {
  played: number;
  won: number;
  drawn: number;
}

/** Time per hop when a move is animated, and the computer's pause before it plays. */
const HOP_MS = 240;
const THINK_MS = 350;

/** The board part-way through `move`: the piece on its k-th landing square, the first k captures gone. */
function partway(board: Board, move: Move, k: number): Board {
  const next = board.slice();
  const p = next[move.from]!;
  next[move.from] = null;
  for (const c of move.captures.slice(0, k)) next[c] = null;
  next[move.path[k - 1]] = p;
  return next;
}

@Component({
  selector: 'app-checkers-game',
  imports: [RouterLink, Modal, AdBanner],
  templateUrl: './checkers-game.html',
  styleUrl: './checkers-game.scss',
})
export class CheckersGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly rng = seededRng(Math.floor(Math.random() * 2 ** 31));

  private engine = new CheckersEngine();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private started = false;

  readonly squares = Array.from({ length: 64 }, (_, sq) => ({ sq, dark: isDark(sq), row: rowOf(sq), col: colOf(sq) }));
  readonly level = signal<Level>(this.storage.get<Level>('checkers.level', 'normal'));
  readonly view = signal<CheckersState>(this.engine.view);
  /** What's drawn: the real board, or a frame of an animated move. */
  readonly display = signal<Board>(this.engine.view.board);
  readonly moves = signal<Move[]>(this.engine.moves());
  readonly selected = signal<number | null>(null);
  /** Landing squares chosen so far in a multi-jump. */
  readonly partial = signal<number[]>([]);
  readonly busy = signal(false);
  readonly hintMove = signal<Move | null>(null);
  readonly result = signal<Side | 'draw' | null>(null);
  readonly stats = signal<Stats>(this.storage.get<Stats>('checkers.stats', { played: 0, won: 0, drawn: 0 }));

  readonly pieces = computed(() => this.display().flatMap((p, sq) => (p ? [{ p, row: rowOf(sq), col: colOf(sq), sq }] : [])));
  readonly yourTurn = computed(() => this.view().turn === 0 && !this.busy() && this.result() === null);
  /** Your pieces that can move this turn. */
  readonly movable = computed(() => new Set(this.yourTurn() ? this.moves().map((m) => m.from) : []));
  /** Moves still matching the selected piece and the hops chosen so far. */
  readonly candidates = computed(() => {
    const from = this.selected();
    const part = this.partial();
    return this.moves().filter((m) => m.from === from && part.every((s, i) => m.path[i] === s));
  });
  readonly targets = computed(() => new Set(this.candidates().map((m) => m.path[this.partial().length])));
  readonly mustCapture = computed(() => this.yourTurn() && !!this.moves()[0]?.captures.length);
  readonly counts = computed(() => [0, 1].map((side) => this.view().board.filter((p) => p?.side === side).length));
  readonly status = computed(() => {
    if (this.result() !== null) return 'Game over';
    if (this.view().turn === 1) return 'Computer is thinking…';
    if (this.partial().length) return 'Keep jumping!';
    return this.mustCapture() ? 'You must capture' : 'Your move';
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Checkers Online – Free vs Computer | CardArena',
      description: 'Play Checkers (draughts) free in your browser against the computer. Four AI levels, compulsory captures, multi-jumps, kings, undo and hints. No download.',
      path: '/games/checkers',
      image: '/og/checkers.jpg',
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.clearTimers();
    if (this.started && this.result() === null) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new CheckersEngine();
    this.started = false;
    this.busy.set(false);
    this.result.set(null);
    this.sync();
    this.sound.play('card-deal');
  }

  setLevel(l: Level): void {
    if (l === this.level()) return;
    this.level.set(l);
    this.storage.set('checkers.level', l);
    if (this.started && this.result() === null) this.toast.info(`${l[0].toUpperCase() + l.slice(1)} level`, 'The computer plays at this level from its next move.');
  }

  clickSquare(sq: number): void {
    if (!this.yourTurn()) return;
    this.hintMove.set(null);
    if (this.targets().has(sq)) {
      this.hop(sq);
      return;
    }
    // Mid-jump the piece is committed; otherwise pick (or switch to) a movable piece.
    if (this.partial().length) return;
    const p = this.view().board[sq];
    if (p?.side === 0 && this.movable().has(sq)) {
      this.selected.set(this.selected() === sq ? null : sq);
      this.sound.play('card-select');
    } else if (p?.side === 0) {
      this.nope(this.mustCapture() ? 'You must capture' : 'That piece can’t move');
    } else {
      this.selected.set(null);
    }
  }

  undo(): void {
    if (this.busy() || !this.engine.undo()) return;
    this.result.set(null);
    this.sync();
  }

  hint(): void {
    if (!this.yourTurn()) return;
    this.selected.set(null);
    this.partial.set([]);
    this.display.set(this.view().board);
    const m = this.engine.bestMove('hard', this.rng);
    this.hintMove.set(m);
    this.later(() => this.hintMove.set(null), 2200);
  }

  isHint(sq: number): boolean {
    const m = this.hintMove();
    return !!m && (m.from === sq || m.path[m.path.length - 1] === sq);
  }

  isLast(sq: number): boolean {
    const m = this.view().last;
    return !!m && (m.from === sq || m.path.includes(sq));
  }

  /** One hop of your move; plays it once it's complete. */
  private hop(sq: number): void {
    const part = [...this.partial(), sq];
    const done = this.candidates().find((m) => m.path.length === part.length && m.path[part.length - 1] === sq);
    const move = done ?? this.candidates().find((m) => m.path[part.length - 1] === sq)!;
    this.display.set(partway(this.view().board, move, part.length));
    this.sound.play(move.captures.length ? 'thulla' : 'card-play');
    if (done) {
      this.commit(done);
      return;
    }
    this.partial.set(part);
    // Only one way to go on? Take the next hop automatically.
    const next = new Set(this.candidates().map((m) => m.path[part.length]));
    if (next.size === 1) {
      this.busy.set(true);
      this.later(() => {
        this.busy.set(false);
        this.hop([...next][0]);
      }, HOP_MS);
    }
  }

  private commit(move: Move): void {
    this.started = true;
    this.engine.play(move);
    this.sync();
    if (this.checkEnd()) return;
    this.busy.set(true);
    this.later(() => this.computerMove(), THINK_MS);
  }

  private computerMove(): void {
    const move = this.engine.bestMove(this.level(), this.rng);
    if (!move) return;
    const board = this.view().board;
    move.path.forEach((_, k) =>
      this.later(() => {
        this.display.set(partway(board, move, k + 1));
        this.sound.play(move.captures.length ? 'thulla' : 'card-play');
      }, k * HOP_MS),
    );
    this.later(() => {
      this.engine.play(move);
      this.busy.set(false);
      this.sync();
      this.checkEnd();
    }, move.path.length * HOP_MS);
  }

  private checkEnd(): boolean {
    const r = this.engine.result();
    if (r === null) return false;
    const s = this.stats();
    this.saveStats({ played: s.played + 1, won: s.won + (r === 0 ? 1 : 0), drawn: s.drawn + (r === 'draw' ? 1 : 0) });
    this.started = false;
    this.later(() => {
      this.sound.play(r === 0 ? 'win' : 'lose');
      this.result.set(r);
    }, 500);
    return true;
  }

  private sync(): void {
    const v = this.engine.view;
    this.view.set(v);
    this.display.set(v.board);
    this.moves.set(this.engine.moves());
    this.selected.set(null);
    this.partial.set([]);
    this.hintMove.set(null);
    // With one movable piece, select it for you.
    const froms = new Set(this.moves().map((m) => m.from));
    if (v.turn === 0 && froms.size === 1) this.selected.set([...froms][0]);
  }

  private nope(message: string): void {
    this.toast.info(message, this.mustCapture() ? 'Captures are compulsory — pick a highlighted piece.' : 'Pick one of the highlighted pieces.');
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('checkers.stats', this.stats());
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
