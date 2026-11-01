import { Component, DestroyRef, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { Card } from '../../shared/models/card.model';
import { SpiderEngine, SpiderState, SuitCount, TableauCard } from './spider.engine';

interface Drag {
  from: number;
  index: number;
  ids: string[];
  x: number;
  y: number;
  moved: boolean;
}

interface Stats {
  played: number;
  won: number;
  bestTime: number | null;
  bestScore: number;
}

type AllStats = Record<SuitCount, Stats>;

const FLIGHT = { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' };
const NO_STATS: Stats = { played: 0, won: 0, bestTime: null, bestScore: 0 };
/** Card spacing in card widths: face-up cards, face-down cards, and how far either may shrink. */
const UP = 0.3;
const DOWN = 0.12;
const MIN_UP = 0.15;
const MIN_DOWN = 0.05;

@Component({
  selector: 'app-spider-game',
  imports: [RouterLink, PlayingCard, Modal, AdBanner],
  templateUrl: './spider-game.html',
  styleUrl: './spider-game.scss',
})
export class SpiderGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');
  private readonly tableau = viewChild<ElementRef<HTMLElement>>('tableau');

  private engine!: SpiderEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  readonly suits = signal<SuitCount>(this.storage.get<SuitCount>('spider.suits', 1));
  readonly view = signal<SpiderState | null>(null);
  readonly elapsed = signal(0);
  readonly won = signal(false);
  readonly canUndo = signal(false);
  readonly drag = signal<Drag | null>(null);
  readonly dx = signal(0);
  readonly dy = signal(0);
  readonly hintIds = signal<Set<string>>(new Set());
  readonly hintPile = signal<string | null>(null);
  /** Height the tableau can use without scrolling, in card widths. */
  readonly room = signal(6);
  readonly allStats = signal<AllStats>(this.storage.get<AllStats>('spider.stats', { 1: NO_STATS, 2: NO_STATS, 4: NO_STATS }));

  readonly stats = computed(() => this.allStats()[this.suits()] ?? NO_STATS);
  readonly time = computed(() => formatTime(this.elapsed()));
  readonly dragIds = computed(() => new Set(this.drag()?.moved ? this.drag()!.ids : []));
  /** One face-down card per deal left in the stock. */
  readonly stockPacks = computed(() => Array.from({ length: (this.view()?.stock.length ?? 0) / 10 }, (_, i) => i));
  readonly foundations = computed(() => Array.from({ length: 8 }, (_, i) => this.view()?.completed[i]?.[0] ?? null));
  readonly offsets = computed(() => (this.view()?.tableau ?? []).map((col) => columnOffsets(col, this.room())));

  constructor() {
    inject(SeoService).apply({
      title: 'Play Spider Solitaire Online – Free, 1, 2 or 4 Suits | CardArena',
      description: 'Play Spider Solitaire free in your browser. 1, 2 or 4 suits, drag and drop or tap to move, unlimited undo and hints. No download or sign-up.',
      path: '/games/spider-solitaire',
      image: '/og/spider-solitaire.jpg',
    });
    this.newGame();
    afterNextRender(() => this.watchSize(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.stopTimers();
    if (this.started && !this.won()) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new SpiderEngine(Math.floor(Math.random() * 2 ** 31), this.suits());
    this.started = false;
    this.won.set(false);
    this.elapsed.set(0);
    this.clearHint();
    this.sync();
    this.sound.play('card-deal');
    afterNextRender(() => this.animateDeal(), { injector: this.injector });
  }

  setSuits(n: SuitCount): void {
    if (n === this.suits()) return;
    if (this.started && !this.won()) this.saveStats({ played: this.stats().played + 1 });
    this.started = false; // the abandoned game is counted against the old suit count
    this.suits.set(n);
    this.storage.set('spider.suits', n);
    this.newGame();
  }

  deal(): void {
    const v = this.view();
    if (!v?.stock.length) return;
    if (!this.engine.canDeal()) {
      this.toast.info('Fill every column first', 'You can only deal when no column is empty.');
      return;
    }
    const prev = this.snapshot();
    const completed = v.completed.length;
    this.engine.deal();
    this.sound.play('card-deal');
    this.afterAction(prev, completed, this.pileRect('stock'));
  }

  undo(): void {
    if (!this.engine.undo()) return;
    const prev = this.snapshot();
    this.sync();
    this.flip(prev, this.pileRect('stock'));
  }

  hint(): void {
    const h = this.engine.hint();
    this.clearHint();
    if (!h) {
      this.toast.info('No moves left', 'Try undoing a few moves, or start a new game.');
      return;
    }
    if (h === 'deal') this.hintPile.set('stock');
    else {
      this.hintIds.set(new Set(this.engine.pickUp(h.from, h.index)!.map((c) => c.id)));
      this.hintPile.set(`t${h.to}`);
    }
    this.hintTimer = setTimeout(() => this.clearHint(), 1800);
  }

  // ------------------------------------------------------------ pointer input

  down(event: PointerEvent, from: number, index: number): void {
    if (event.button !== 0 || this.won()) return;
    const cards = this.engine.pickUp(from, index);
    if (!cards) {
      this.nope(from, index);
      return;
    }
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.drag.set({ from, index, ids: cards.map((c) => c.id), x: event.clientX, y: event.clientY, moved: false });
    this.dx.set(0);
    this.dy.set(0);
  }

  pointerMove(event: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) this.drag.set({ ...d, moved: true });
    this.dx.set(dx);
    this.dy.set(dy);
  }

  up(event: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    if (!d.moved) {
      this.drag.set(null);
      this.tap(d.from, d.index);
      return;
    }
    // Dragged cards ignore the pointer, so this finds what's underneath them.
    const pile = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-pile]')?.dataset['pile'];
    const prev = this.snapshot();
    const completed = this.view()!.completed.length;
    this.drag.set(null);
    this.dx.set(0);
    this.dy.set(0);
    if (pile?.startsWith('t') && this.engine.move({ from: d.from, index: d.index, to: Number(pile.slice(1)) })) {
      this.sound.play('card-play');
      this.afterAction(prev, completed);
    } else {
      this.flip(prev); // glide back
    }
  }

  cancel(): void {
    if (!this.drag()) return;
    const prev = this.snapshot();
    this.drag.set(null);
    this.dx.set(0);
    this.dy.set(0);
    this.flip(prev);
  }

  /** Keyboard activation (Enter/Space); pointer taps are handled in `up`. */
  keyActivate(event: MouseEvent, from: number, index: number): void {
    if (event.detail === 0) this.tap(from, index);
  }

  private tap(from: number, index: number): void {
    const to = this.engine.bestTarget(from, index);
    if (to === null) {
      this.nope(from, index);
      return;
    }
    const prev = this.snapshot();
    const completed = this.view()!.completed.length;
    this.engine.move({ from, index, to });
    this.sound.play('card-play');
    this.afterAction(prev, completed);
  }

  // -------------------------------------------------------------- rendering

  columnHeight(ti: number): number {
    const o = this.offsets()[ti] ?? [];
    return (o[o.length - 1] ?? 0) + 1.4;
  }

  fnd(i: number): string {
    return `f${i}`;
  }

  fmt(seconds: number): string {
    return formatTime(seconds);
  }

  isDragged(card: Card): boolean {
    return this.dragIds().has(card.id);
  }

  private sync(): void {
    this.view.set(this.engine.view);
    this.canUndo.set(this.engine.canUndo());
  }

  private afterAction(prev: Map<string, DOMRect>, completedBefore: number, fallback?: DOMRect): void {
    this.clearHint();
    if (!this.started) {
      this.started = true;
      this.timer = setInterval(() => this.elapsed.update((t) => t + 1), 1000);
    }
    this.sync();
    this.flip(prev, fallback);
    if (this.view()!.completed.length > completedBefore) this.sound.play('turn');
    if (this.engine.isWon()) this.win();
  }

  private win(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const s = this.stats();
    this.saveStats({
      played: s.played + 1,
      won: s.won + 1,
      bestTime: s.bestTime === null ? this.elapsed() : Math.min(s.bestTime, this.elapsed()),
      bestScore: Math.max(s.bestScore, this.view()!.score),
    });
    this.started = false;
    setTimeout(() => {
      this.sound.play('win');
      this.won.set(true);
    }, 500);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.allStats.update((all) => ({ ...all, [this.suits()]: { ...this.stats(), ...patch } }));
    this.storage.set('spider.stats', this.allStats());
  }

  /** Keeps `room` in step with the board size so long columns squeeze instead of scrolling. */
  private watchSize(): void {
    const measure = () => {
      const tableau = this.tableau()?.nativeElement;
      const col = tableau?.querySelector<HTMLElement>('.column');
      if (!tableau || !col?.offsetWidth) return;
      const board = this.board().nativeElement;
      const free = board.clientHeight - (tableau.offsetTop - board.offsetTop) - 24;
      this.room.set(Math.max(3, free / col.offsetWidth));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(this.board().nativeElement);
    measure();
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  // ------------------------------------------------------------- animation

  private snapshot(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    this.board().nativeElement.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => map.set(el.dataset['card']!, el.getBoundingClientRect()));
    return map;
  }

  private pileRect(id: string): DOMRect | undefined {
    return this.board().nativeElement.querySelector(`[data-pile="${id}"]`)?.getBoundingClientRect();
  }

  /** FLIP: after the next render, slide every card from where it was to where it is now. */
  private flip(prev: Map<string, DOMRect>, fallback?: DOMRect): void {
    afterNextRender(
      () => {
        this.board().nativeElement.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
          const from = prev.get(el.dataset['card']!) ?? fallback;
          if (!from) return;
          const to = el.getBoundingClientRect();
          const dx = from.left - to.left;
          const dy = from.top - to.top;
          if (Math.abs(dx) + Math.abs(dy) < 1) return;
          el.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 50 }, { transform: 'none', zIndex: 50 }], FLIGHT);
        });
      },
      { injector: this.injector },
    );
  }

  private animateDeal(): void {
    const stock = this.pileRect('stock');
    if (!stock) return;
    this.board()
      .nativeElement.querySelectorAll<HTMLElement>('.column [data-card]')
      .forEach((el, i) => {
        const to = el.getBoundingClientRect();
        el.animate(
          [{ transform: `translate(${stock.left - to.left}px, ${stock.top - to.top}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: 320, easing: FLIGHT.easing, delay: i * 10, fill: 'backwards' },
        );
      });
  }

  private nope(from: number, index: number): void {
    const col = this.view()?.tableau[from] ?? [];
    for (const t of col.slice(index)) {
      this.board()
        .nativeElement.querySelector(`[data-card="${t.card.id}"]`)
        ?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
    }
  }

  private clearHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintIds.set(new Set());
    this.hintPile.set(null);
  }

  private stopTimers(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Top of each card in card widths; spacing shrinks (down to a floor) so the column fits `room`. */
function columnOffsets(col: TableauCard[], room: number): number[] {
  const gaps = col.slice(0, -1);
  const up = gaps.filter((c) => c.up).length;
  const down = gaps.length - up;
  const natural = up * UP + down * DOWN;
  const space = room - 1.4;
  const scale = natural > space ? space / natural : 1;
  const u = Math.max(MIN_UP, UP * scale);
  const d = Math.max(MIN_DOWN, DOWN * scale);
  let y = 0;
  return col.map((c, i) => {
    const top = y;
    if (i < col.length - 1) y += c.up ? u : d;
    return top;
  });
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
