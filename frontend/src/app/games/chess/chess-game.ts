import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressService } from '../../core/services/progress.service';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { BOT_ROSTER } from '../core/bots';
import { ChessGame, KING, Level, Move, Played, Result, SearchRequest, Side, TYPES, colOf, fromOf, promoOf, rowOf, search, sqName, toOf } from './chess.engine';

interface Stats {
  played: number;
  won: number;
  drawn: number;
}

/** The computer's minimum pause before it moves, so its reply doesn't feel instant. */
const THINK_MS = 450;
const GLYPH: Record<string, string> = { p: '♟︎', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const REASON: Record<Result['reason'], string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate — no legal move, but not in check',
  fifty: 'Fifty moves without a capture or pawn move',
  repetition: 'The same position three times',
  material: 'Not enough pieces left to checkmate',
};

@Component({
  selector: 'app-chess-game',
  imports: [RouterLink, Modal, AdBanner],
  templateUrl: './chess-game.html',
  styleUrl: './chess-game.scss',
})
export class ChessGamePage implements OnDestroy {
  /** Your opponent, one of the same bots as the table games. */
  readonly foe = BOT_ROSTER[3];
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly progress = inject(ProgressService);
  private readonly toast = inject(ToastService);

  private game = new ChessGame();
  private started = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private worker: Worker | null = null;
  private workerFailed = false;
  private reqId = 0;
  private pending = new Map<number, (m: Move | null) => void>();
  private readonly movesStrip = viewChild<ElementRef<HTMLElement>>('strip');

  /** The colour you play: 0 White (moves first), 1 Black. */
  readonly you = signal<Side>(this.storage.get<Side>('chess.color', 0));
  readonly level = signal<Level>(this.storage.get<Level>('chess.level', 'normal'));
  readonly stats = signal<Stats>(this.storage.get<Stats>('chess.stats', { played: 0, won: 0, drawn: 0 }));

  readonly board = signal<number[]>([]);
  readonly ids = signal<number[]>([]);
  readonly turn = signal<Side>(0);
  readonly history = signal<Played[]>([]);
  readonly legal = signal<Move[]>([]);
  readonly inCheck = signal(false);
  readonly selected = signal<number | null>(null);
  readonly thinking = signal(false);
  readonly hintMove = signal<Move | null>(null);
  /** Promotion choices waiting for you to pick a piece. */
  readonly promoting = signal<Move[] | null>(null);
  readonly result = signal<Result | null>(null);
  readonly showResult = signal(false);

  readonly squares = Array.from({ length: 64 }, (_, sq) => sq);
  readonly flipped = computed(() => this.you() === 1);
  readonly yourTurn = computed(() => this.turn() === this.you() && !this.thinking() && !this.result());
  readonly pieces = computed(() => {
    const ids = this.ids();
    return this.board().flatMap((v, sq) => (v ? [{ id: ids[sq], sq, white: v > 0, type: TYPES[Math.abs(v)], glyph: GLYPH[TYPES[Math.abs(v)]] }] : []));
  });
  /** Squares the selected piece can move to. */
  readonly targets = computed(() => {
    const from = this.selected();
    return new Set(from === null ? [] : this.legal().filter((m) => fromOf(m) === from).map(toOf));
  });
  readonly movable = computed(() => new Set(this.yourTurn() ? this.legal().map(fromOf) : []));
  readonly last = computed(() => this.history().at(-1)?.move ?? null);
  readonly checkSq = computed(() => (this.inCheck() ? this.board().findIndex((v) => v === (this.turn() === 0 ? KING : -KING)) : -1));
  /** Pieces each side has taken, and the material balance from your side. */
  readonly captured = computed(() => {
    const taken: [string[], string[]] = [[], []];
    let balance = 0;
    for (const p of this.history()) {
      if (!p.captured) continue;
      const t = TYPES[Math.abs(p.captured)];
      taken[p.side].push(t);
      balance += (p.side === this.you() ? 1 : -1) * VALUE[t];
    }
    for (const list of taken) list.sort((a, b) => VALUE[b] - VALUE[a]);
    return { mine: taken[this.you()], theirs: taken[1 - this.you()], balance };
  });
  /** Moves paired by number: 1. e4 e5 … */
  readonly moveRows = computed(() => {
    const h = this.history();
    const rows: { n: number; white: string; black: string }[] = [];
    for (let i = 0; i < h.length; i += 2) rows.push({ n: i / 2 + 1, white: h[i].san, black: h[i + 1]?.san ?? '' });
    return rows;
  });
  readonly status = computed(() => {
    const r = this.result();
    if (r) return r.reason === 'checkmate' ? 'Checkmate' : 'Draw';
    if (this.thinking()) return `${this.foe.name} is thinking…`;
    if (this.turn() !== this.you()) return `${this.foe.name} to move`;
    return this.inCheck() ? 'Check! Your move' : 'Your move';
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Chess Online – Free vs Computer | CardArena',
      description: 'Play chess free in your browser against the computer. Four levels from beginner to expert, play White or Black, undo, hints and full rules. No download or sign-up.',
      path: '/games/chess',
      image: '/og/chess.jpg',
    });
    this.sync();
    // Played as Black: the computer opens. (This screen only renders in the browser.)
    if (this.you() === 1) this.think();
    // Keep the newest move in view in the move list.
    effect(() => {
      this.history();
      const el = this.movesStrip()?.nativeElement;
      if (el) queueMicrotask(() => el.scrollTo({ left: el.scrollWidth, top: el.scrollHeight }));
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.worker?.terminate();
  }

  // -------------------------------------------------------------- display helpers

  /** Where a square is drawn, with the board turned round when you play Black. */
  pos(sq: number): { r: number; c: number } {
    return this.flipped() ? { r: 7 - rowOf(sq), c: 7 - colOf(sq) } : { r: rowOf(sq), c: colOf(sq) };
  }

  isLight(sq: number): boolean {
    return (rowOf(sq) + colOf(sq)) % 2 === 0;
  }

  isLast(sq: number): boolean {
    const m = this.last();
    return m !== null && (fromOf(m) === sq || toOf(m) === sq);
  }

  isHint(sq: number): boolean {
    const m = this.hintMove();
    return m !== null && (fromOf(m) === sq || toOf(m) === sq);
  }

  /** File letter along the bottom edge and rank number up the side, as on a real board. */
  fileLabel(sq: number): string | null {
    return this.pos(sq).r === 7 ? 'abcdefgh'[colOf(sq)] : null;
  }

  rankLabel(sq: number): string | null {
    return this.pos(sq).c === 0 ? String(8 - rowOf(sq)) : null;
  }

  squareLabel(sq: number): string {
    const v = this.board()[sq];
    const piece = v ? `${v > 0 ? 'White' : 'Black'} ${({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } as Record<string, string>)[TYPES[Math.abs(v)]]}` : 'empty';
    return `${sqName(sq)}, ${piece}${this.targets().has(sq) ? ' — move here' : ''}`;
  }

  glyph(t: string): string {
    return GLYPH[t];
  }

  promoGlyph(m: Move): string {
    return GLYPH[TYPES[promoOf(m)]];
  }

  reasonText(r: Result): string {
    return REASON[r.reason];
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.abandon();
    this.cancelThinking();
    this.clearTimers();
    this.game = new ChessGame();
    this.started = false;
    this.result.set(null);
    this.showResult.set(false);
    this.promoting.set(null);
    this.sync();
    this.sound.play('card-deal');
    if (this.you() === 1) this.think();
  }

  /** Play the other colour; starts a new game. */
  switchSides(): void {
    const you = (1 - this.you()) as Side;
    this.you.set(you);
    this.storage.set('chess.color', you);
    this.newGame();
    this.toast.info(you === 0 ? 'You play White' : 'You play Black', you === 0 ? 'White moves first.' : `${this.foe.name} has White and moves first.`);
  }

  setLevel(l: Level): void {
    if (l === this.level()) return;
    this.level.set(l);
    this.storage.set('chess.level', l);
    if (this.started && !this.result()) this.toast.info(`${l[0].toUpperCase() + l.slice(1)} level`, `${this.foe.name} plays at this level from the next move.`);
  }

  clickSquare(sq: number): void {
    if (!this.yourTurn() || this.promoting()) return;
    this.hintMove.set(null);
    const from = this.selected();
    if (from !== null && this.targets().has(sq)) {
      const options = this.legal().filter((m) => fromOf(m) === from && toOf(m) === sq);
      if (options.length > 1) this.promoting.set(options);
      else this.move(options[0]);
      return;
    }
    const v = this.board()[sq];
    if (v && (v > 0 ? 0 : 1) === this.you()) {
      if (this.movable().has(sq)) {
        this.selected.set(from === sq ? null : sq);
        this.sound.play('card-select');
      } else {
        this.selected.set(null);
        this.toast.info('That piece can’t move', this.inCheck() ? 'You’re in check — you must get out of it.' : 'It’s blocked, or moving it would leave your king in check.');
      }
    } else this.selected.set(null);
  }

  promote(m: Move): void {
    this.promoting.set(null);
    this.move(m);
  }

  cancelPromotion(): void {
    this.promoting.set(null);
  }

  undo(): void {
    if (!this.game.moves.length || this.result()) return;
    this.cancelThinking();
    this.clearTimers();
    this.result.set(null);
    this.showResult.set(false);
    this.promoting.set(null);
    // Back to your previous move: your move and the computer's reply.
    do this.game.undo();
    while (this.game.pos.turn !== this.you() && this.game.moves.length);
    this.sync();
    if (this.game.pos.turn !== this.you()) this.think();
  }

  hint(): void {
    if (!this.yourTurn()) return;
    this.selected.set(null);
    this.ask(this.game.request('hard', this.seed()), (m) => {
      if (m === null || !this.yourTurn()) return;
      this.hintMove.set(m);
      this.later(() => this.hintMove.set(null), 2500);
    });
  }

  /** Show the result again after closing it to look at the board. */
  reviewDone(): void {
    this.showResult.set(false);
  }

  // -------------------------------------------------------------- internals

  private move(m: Move): void {
    this.started = true;
    this.play(m);
    if (!this.checkEnd()) this.think();
  }

  private play(m: Move): void {
    this.game.play(m);
    const p = this.game.moves.at(-1)!;
    this.sound.play(p.captured ? 'thulla' : 'card-play');
    this.sync();
  }

  private think(): void {
    this.thinking.set(true);
    const started = Date.now();
    this.ask(this.game.request(this.level(), this.seed()), (m) => {
      this.later(() => {
        this.thinking.set(false);
        if (m === null) return;
        this.play(m);
        if (this.game.pos.turn === this.you() && this.inCheck()) this.sound.play('turn');
        this.checkEnd();
      }, Math.max(0, THINK_MS - (Date.now() - started)));
    });
  }

  /** Run a search in the worker (or here if workers aren't available). */
  private ask(req: SearchRequest, done: (m: Move | null) => void): void {
    const id = ++this.reqId;
    this.pending.set(id, done);
    const worker = this.getWorker();
    if (worker) worker.postMessage({ ...req, id });
    else this.later(() => this.answer(id, search(req)), 30);
  }

  private answer(id: number, move: Move | null): void {
    const done = this.pending.get(id);
    this.pending.delete(id);
    done?.(move);
  }

  private getWorker(): Worker | null {
    if (this.worker || this.workerFailed) return this.worker;
    if (typeof Worker === 'undefined') {
      this.workerFailed = true;
      return null;
    }
    try {
      this.worker = new Worker(new URL('./chess.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; move: Move | null }>) => this.answer(e.data.id, e.data.move);
      this.worker.onerror = () => {
        // Fall back to searching on the main thread.
        this.worker?.terminate();
        this.worker = null;
        this.workerFailed = true;
        const waiting = [...this.pending.keys()];
        this.pending.clear();
        if (waiting.length && this.thinking()) {
          this.thinking.set(false);
          this.think();
        }
      };
    } catch {
      this.workerFailed = true;
    }
    return this.worker;
  }

  private cancelThinking(): void {
    this.pending.clear();
    this.thinking.set(false);
  }

  private checkEnd(): boolean {
    const r = this.game.result();
    if (!r) return false;
    this.result.set(r);
    const won = r.winner === this.you();
    const s = this.stats();
    this.saveStats({ played: s.played + 1, won: s.won + (won ? 1 : 0), drawn: s.drawn + (r.winner === null ? 1 : 0) });
    this.progress.record('chess', won ? 'win' : r.winner === null ? 'draw' : 'loss');
    if (won && this.level() === 'expert') this.progress.unlock('checkmate');
    this.started = false;
    this.later(() => {
      this.sound.play(won ? 'win' : 'lose');
      this.showResult.set(true);
    }, 700);
    return true;
  }

  /** Starting another game part-way through counts as a loss. */
  private abandon(): void {
    if (!this.started || this.result()) return;
    this.saveStats({ played: this.stats().played + 1 });
    this.progress.record('chess', 'loss');
  }

  private sync(): void {
    const g = this.game;
    this.board.set(Array.from(g.pos.board));
    this.ids.set(g.ids.slice());
    this.turn.set(g.pos.turn);
    this.history.set(g.moves.slice());
    this.legal.set(g.legal());
    this.inCheck.set(g.pos.inCheck());
    this.selected.set(null);
    this.hintMove.set(null);
  }

  private seed(): number {
    return Math.floor(Math.random() * 2 ** 31);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('chess.stats', this.stats());
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
