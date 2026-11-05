import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { TriPeaksEngine, TriPeaksState } from './tripeaks.engine';

interface Stats {
  played: number;
  won: number;
  bestScore: number;
  bestStreak: number;
}

const FLIGHT = { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' };

@Component({
  selector: 'app-tripeaks-game',
  imports: [RouterLink, PlayingCard, Modal, AdBanner],
  templateUrl: './tripeaks-game.html',
  styleUrl: './tripeaks-game.scss',
})
export class TriPeaksGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  private engine!: TriPeaksEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  readonly view = signal<TriPeaksState | null>(null);
  readonly free = signal<Set<number>>(new Set());
  readonly elapsed = signal(0);
  readonly canUndo = signal(false);
  /** 'won' or 'lost' once the deal is over. */
  readonly result = signal<'won' | 'lost' | null>(null);
  readonly hintSlot = signal<number | 'stock' | null>(null);
  readonly stats = signal<Stats>(this.storage.get<Stats>('tripeaks.stats', { played: 0, won: 0, bestScore: 0, bestStreak: 0 }));

  readonly time = computed(() => formatTime(this.elapsed()));
  readonly wasteTop = computed(() => this.view()?.waste.slice(-2) ?? []);
  /** A few face-down cards to suggest the stock's depth. */
  readonly stockShown = computed(() => (this.view()?.stock ?? []).slice(-4));
  readonly cleared = computed(() => this.view()?.slots.filter((s) => s.gone).length ?? 0);

  constructor() {
    inject(SeoService).apply({
      title: 'Play Tri Peaks Solitaire Online – Free | CardArena',
      description: 'Play Tri Peaks Solitaire free in your browser. Clear three peaks by playing cards one higher or lower, build long streaks, undo and hints. No download.',
      path: '/games/tripeaks',
      image: '/og/tripeaks.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.stopTimer();
    if (this.started && !this.result()) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new TriPeaksEngine(Math.floor(Math.random() * 2 ** 31));
    this.started = false;
    this.result.set(null);
    this.elapsed.set(0);
    this.clearHint();
    this.sync();
    this.sound.play('card-deal');
    afterNextRender(() => this.animateDeal(), { injector: this.injector });
  }

  tap(i: number): void {
    if (this.result()) return;
    const prev = this.snapshot();
    if (!this.engine.play(i)) {
      this.nope(i);
      return;
    }
    this.sound.play('card-play');
    this.afterAction(prev);
  }

  draw(): void {
    if (this.result()) return;
    const prev = this.snapshot();
    if (!this.engine.draw()) return;
    this.sound.play('card-deal');
    this.afterAction(prev, this.pileRect('stock'));
  }

  undo(): void {
    if (!this.engine.undo()) return;
    const prev = this.snapshot();
    this.result.set(null);
    this.sync();
    this.flip(prev);
  }

  hint(): void {
    const h = this.engine.hint();
    this.clearHint();
    if (h === null) {
      this.toast.info('No moves left', 'Try undoing a few moves, or start a new game.');
      return;
    }
    this.hintSlot.set(h === 'draw' ? 'stock' : h);
    this.hintTimer = setTimeout(() => this.clearHint(), 1800);
  }

  fmt(seconds: number): string {
    return formatTime(seconds);
  }

  private sync(): void {
    this.view.set(this.engine.view);
    this.free.set(new Set(this.engine.free()));
    this.canUndo.set(this.engine.canUndo());
  }

  private afterAction(prev: Map<string, DOMRect>, fallback?: DOMRect): void {
    this.clearHint();
    if (!this.started) {
      this.started = true;
      this.timer = setInterval(() => this.elapsed.update((t) => t + 1), 1000);
    }
    this.sync();
    this.flip(prev, fallback);
    if (this.engine.isWon()) this.finish('won');
    else if (this.engine.isStuck()) this.finish('lost');
  }

  private finish(result: 'won' | 'lost'): void {
    this.stopTimer();
    const s = this.stats();
    const v = this.view()!;
    this.saveStats({
      played: s.played + 1,
      won: s.won + (result === 'won' ? 1 : 0),
      bestScore: Math.max(s.bestScore, v.score),
      bestStreak: Math.max(s.bestStreak, v.bestStreak),
    });
    this.started = false;
    setTimeout(() => {
      this.sound.play(result === 'won' ? 'win' : 'lose');
      this.result.set(result);
    }, 500);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('tripeaks.stats', this.stats());
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
      .nativeElement.querySelectorAll<HTMLElement>('.peaks [data-card]')
      .forEach((el, i) => {
        const to = el.getBoundingClientRect();
        el.animate(
          [{ transform: `translate(${stock.left - to.left}px, ${stock.top - to.top}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: 320, easing: FLIGHT.easing, delay: i * 18, fill: 'backwards' },
        );
      });
  }

  private nope(i: number): void {
    const id = this.view()?.slots[i].card.id;
    this.board()
      .nativeElement.querySelector(`[data-card="${id}"]`)
      ?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
  }

  private clearHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintSlot.set(null);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
