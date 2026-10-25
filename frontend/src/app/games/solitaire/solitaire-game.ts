import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { Card } from '../../shared/models/card.model';
import { DrawCount, Move, PileId, SolitaireEngine, SolitaireState } from './solitaire.engine';

interface Drag {
  from: PileId;
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

const FLIGHT = { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' };

@Component({
  selector: 'app-solitaire-game',
  imports: [RouterLink, PlayingCard, Modal, AdBanner],
  templateUrl: './solitaire-game.html',
  styleUrl: './solitaire-game.scss',
})
export class SolitaireGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  private engine!: SolitaireEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  readonly drawCount = signal<DrawCount>(this.storage.get<DrawCount>('solitaire.draw', 1));
  readonly view = signal<SolitaireState | null>(null);
  readonly elapsed = signal(0);
  readonly won = signal(false);
  readonly canUndo = signal(false);
  readonly canAutoFinish = signal(false);
  readonly autoFinishing = signal(false);
  readonly drag = signal<Drag | null>(null);
  /** Pointer offset of the cards being dragged. */
  readonly dx = signal(0);
  readonly dy = signal(0);
  readonly hintIds = signal<Set<string>>(new Set());
  readonly hintPile = signal<PileId | null>(null);
  readonly stats = signal<Stats>(this.storage.get<Stats>('solitaire.stats', { played: 0, won: 0, bestTime: null, bestScore: 0 }));

  readonly time = computed(() => formatTime(this.elapsed()));
  /** Waste cards on show: the top one, or the top three fanned out when drawing three. */
  readonly wasteShown = computed(() => {
    const w = this.view()?.waste ?? [];
    return w.slice(-(this.drawCount() === 3 ? 3 : 2));
  });
  readonly dragIds = computed(() => new Set(this.drag()?.moved ? this.drag()!.ids : []));

  constructor() {
    inject(SeoService).apply({
      title: 'Play Solitaire Online – Free Klondike | CardArena',
      description: 'Play classic Klondike Solitaire free in your browser. Draw 1 or Draw 3, drag and drop or tap to move, undo, hints and auto-finish.',
      path: '/games/solitaire',
      image: '/og/solitaire.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.stopTimers();
    if (this.started && !this.won()) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new SolitaireEngine(Math.floor(Math.random() * 2 ** 31), this.drawCount());
    this.started = false;
    this.won.set(false);
    this.elapsed.set(0);
    this.clearHint();
    this.sync();
    this.sound.play('card-deal');
    // Deal: every card flies out of the stock, one after another.
    afterNextRender(() => this.animateDeal(), { injector: this.injector });
  }

  setDraw(n: DrawCount): void {
    if (n === this.drawCount()) return;
    this.drawCount.set(n);
    this.storage.set('solitaire.draw', n);
    if (!this.started) this.newGame();
    else this.toast.info(`Draw ${n}`, 'Applies from your next game.');
  }

  draw(): void {
    if (this.autoFinishing()) return;
    const prev = this.snapshot();
    if (!this.engine.draw()) return;
    this.sound.play('card-deal');
    this.afterAction(prev, this.pileRect('stock'));
  }

  undo(): void {
    if (this.autoFinishing() || !this.engine.undo()) return;
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
    if (h === 'draw') this.hintPile.set('stock');
    else {
      this.hintIds.set(new Set(this.engine.pickUp(h.from, h.index)!.map((c) => c.id)));
      this.hintPile.set(h.to);
    }
    this.hintTimer = setTimeout(() => this.clearHint(), 1800);
  }

  autoFinish(): void {
    if (!this.engine.canAutoFinish()) return;
    this.autoFinishing.set(true);
    const step = () => {
      const prev = this.snapshot();
      if (!this.engine.autoFinishStep()) {
        this.autoFinishing.set(false);
        return;
      }
      this.sound.play('card-play');
      this.afterAction(prev);
      if (!this.won()) this.autoTimer = setTimeout(step, 110);
      else this.autoFinishing.set(false);
    };
    step();
  }

  // ------------------------------------------------------------ pointer input

  down(event: PointerEvent, from: PileId, index: number): void {
    if (event.button !== 0 || this.autoFinishing() || this.won()) return;
    const cards = this.engine.pickUp(from, index);
    if (!cards) return;
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
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-pile]')?.dataset['pile'] as PileId | undefined;
    const prev = this.snapshot();
    this.drag.set(null);
    this.dx.set(0);
    this.dy.set(0);
    if (target && this.engine.move({ from: d.from, index: d.index, to: target })) {
      this.sound.play('card-play');
      this.afterAction(prev);
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
  keyActivate(event: MouseEvent, from: PileId, index: number): void {
    if (event.detail === 0) this.tap(from, index);
  }

  private tap(from: PileId, index: number): void {
    const to = this.engine.bestTarget(from, index);
    if (!to) {
      this.nope(from, index);
      return;
    }
    const prev = this.snapshot();
    this.engine.move({ from, index, to } satisfies Move);
    this.sound.play('card-play');
    this.afterAction(prev);
  }

  // -------------------------------------------------------------- rendering

  /** Vertical offset of each tableau card, in card widths: face-down cards overlap more. */
  offsets(col: { up: boolean }[]): number[] {
    let y = 0;
    return col.map((c, i) => {
      const top = y;
      y += i < col.length - 1 ? (c.up ? 0.36 : 0.16) : 0;
      return top;
    });
  }

  columnHeight(col: { up: boolean }[]): number {
    const o = this.offsets(col);
    return (o[o.length - 1] ?? 0) + 1.4;
  }

  tab(i: number): PileId {
    return `t${i}`;
  }

  fnd(i: number): PileId {
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
    this.canAutoFinish.set(this.engine.canAutoFinish());
  }

  private afterAction(prev: Map<string, DOMRect>, fallback?: DOMRect): void {
    this.clearHint();
    if (!this.started) {
      this.started = true;
      this.timer = setInterval(() => this.elapsed.update((t) => t + 1), 1000);
    }
    this.sync();
    this.flip(prev, fallback);
    if (this.engine.isWon()) this.win();
  }

  private win(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const s = this.stats();
    const score = this.view()!.score;
    this.saveStats({
      played: s.played + 1,
      won: s.won + 1,
      bestTime: s.bestTime === null ? this.elapsed() : Math.min(s.bestTime, this.elapsed()),
      bestScore: Math.max(s.bestScore, score),
    });
    this.started = false;
    setTimeout(() => {
      this.sound.play('win');
      this.won.set(true);
    }, 500);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('solitaire.stats', this.stats());
  }

  // ------------------------------------------------------------- animation

  private snapshot(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    this.board().nativeElement.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => map.set(el.dataset['card']!, el.getBoundingClientRect()));
    return map;
  }

  private pileRect(id: PileId): DOMRect | undefined {
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
          { duration: 320, easing: FLIGHT.easing, delay: i * 18, fill: 'backwards' },
        );
      });
  }

  private nope(from: PileId, index: number): void {
    const ids = this.engine.pickUp(from, index)?.map((c) => c.id) ?? [];
    for (const id of ids) {
      this.board()
        .nativeElement.querySelector(`[data-card="${id}"]`)
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
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.timer = null;
    this.autoTimer = null;
    this.autoFinishing.set(false);
  }
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
