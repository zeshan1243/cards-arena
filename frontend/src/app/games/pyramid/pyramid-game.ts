import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { Card, SUIT_SYMBOL } from '../../shared/models/card.model';
import { value } from '../solitaire/solitaire.engine';
import { Passes, PyramidEngine, PyramidState, coveredBy } from './pyramid.engine';

interface Stats {
  played: number;
  won: number;
  bestScore: number;
  /** Endless mode: best running total and most boards cleared in one run. */
  bestRun?: number;
  mostBoards?: number;
}

const FLIGHT = { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' };
const PASS_LABELS: Record<Passes, string> = { 1: '1 pass', 3: '3 passes', 0: 'Unlimited' };

@Component({
  selector: 'app-pyramid-game',
  imports: [RouterLink, PlayingCard, Modal, AdBanner],
  templateUrl: './pyramid-game.html',
  styleUrl: './pyramid-game.scss',
})
export class PyramidGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  private engine!: PyramidEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  /** Set the moment a deal ends, before the result modal appears, so no further moves count. */
  private ended = false;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;

  readonly passOptions: Passes[] = [1, 3, 0];
  readonly passLabels = PASS_LABELS;
  readonly passes = signal<Passes>(this.storage.get<Passes>('pyramid.passes', 3));
  readonly view = signal<PyramidState | null>(null);
  /** Card ids that can be tapped now. */
  readonly available = signal<Set<string>>(new Set());
  /** Uncovered card ids (the rest are drawn dimmed). */
  readonly free = signal<Set<string>>(new Set());
  readonly selected = signal<string | null>(null);
  readonly elapsed = signal(0);
  readonly canUndo = signal(false);
  readonly canRecycle = signal(false);
  readonly result = signal<'won' | 'lost' | null>(null);
  readonly hinted = signal<Set<string>>(new Set());
  readonly hintStock = signal(false);
  /** Why the last tapped card couldn't be used, shown in the help line. */
  readonly blocked = signal<string | null>(null);
  readonly stats = signal<Stats>(this.storage.get<Stats>('pyramid.stats', { played: 0, won: 0, bestScore: 0 }));

  /** Endless: clearing a board deals the next one and the score keeps adding up. */
  readonly endless = signal<boolean>(this.storage.get<boolean>('pyramid.endless', false));
  /** Board number within the current run. */
  readonly boardNo = signal(1);
  /** Points from boards already cleared this run. */
  readonly carried = signal(0);
  readonly total = computed(() => this.carried() + (this.view()?.score ?? 0));

  readonly time = computed(() => formatTime(this.elapsed()));
  readonly wasteTop = computed(() => this.view()?.waste.slice(-2) ?? []);
  readonly stockShown = computed(() => (this.view()?.stock ?? []).slice(-4));
  readonly cleared = computed(() => this.view()?.slots.filter((s) => s.gone).length ?? 0);
  readonly passText = computed(() => {
    const v = this.view();
    if (!v) return '';
    return this.passes() === 0 ? `Pass ${v.pass}` : `Pass ${v.pass}/${this.passes()}`;
  });
  /** Value the selected card needs to make 13. */
  readonly need = computed(() => {
    const id = this.selected();
    const card = id ? this.cardById(id) : null;
    return card ? 13 - value(card) : null;
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Pyramid Solitaire Online – Free | CardArena',
      description: 'Play Pyramid Solitaire free in your browser. Remove pairs that add up to 13 to clear the pyramid, with undo, hints and up to unlimited passes. No download.',
      path: '/games/pyramid-solitaire',
      image: '/og/pyramid-solitaire.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.resultTimer) clearTimeout(this.resultTimer);
  }

  // -------------------------------------------------------------- game flow

  /** Start over: a fresh run (or single game). */
  newGame(): void {
    this.stopTimer();
    if (this.started && !this.result()) this.saveStats({ played: this.stats().played + 1 });
    this.carried.set(0);
    this.boardNo.set(1);
    this.elapsed.set(0);
    this.deal();
  }

  /** Endless: bank this board's score and deal the next one; the clock keeps running. */
  nextBoard(): void {
    this.carried.update((c) => c + (this.view()?.score ?? 0));
    this.boardNo.update((n) => n + 1);
    this.deal();
  }

  toggleEndless(): void {
    const on = !this.endless();
    this.endless.set(on);
    this.storage.set('pyramid.endless', on);
    if (this.started && !this.result()) this.toast.info(on ? 'Endless mode on' : 'Endless mode off', on ? 'Clear this board and the next one is dealt — your score keeps adding up.' : 'Starts with your next game.');
    else if (!on || this.boardNo() > 1) this.newGame();
    else this.toast.info('Endless mode on', 'Clear a board and the next one is dealt — your score keeps adding up.');
  }

  private deal(): void {
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.ended = false;
    this.engine = new PyramidEngine(Math.floor(Math.random() * 2 ** 31), this.passes());
    this.started = false;
    this.result.set(null);
    this.selected.set(null);
    this.clearHint();
    this.sync();
    this.sound.play('card-deal');
    afterNextRender(() => this.animateDeal(), { injector: this.injector });
  }

  setPasses(p: Passes): void {
    if (p === this.passes()) return;
    this.passes.set(p);
    this.storage.set('pyramid.passes', p);
    if (this.started && !this.result()) this.toast.info(PASS_LABELS[p], 'Starts with your next game.');
    else this.newGame();
  }

  tap(id: string): void {
    if (this.ended) return;
    if (!this.available().has(id)) {
      this.shake(id);
      this.explainBlocked(id);
      return;
    }
    this.blocked.set(null);
    const card = this.cardById(id)!;
    const sel = this.selected();
    if (value(card) === 13 && this.engine.canRemove([id])) {
      this.selected.set(null);
      this.removeCards([id]);
      return;
    }
    if (sel === id) {
      this.selected.set(null);
      return;
    }
    if (sel && this.engine.canRemove([sel, id])) {
      this.selected.set(null);
      this.removeCards([sel, id]);
      return;
    }
    if (sel) this.shake(id);
    this.selected.set(id);
    this.sound.play('card-select');
  }

  draw(): void {
    if (this.ended) return;
    const prev = this.snapshot();
    const recycling = this.engine.canRecycle();
    if (!this.engine.draw()) return;
    this.selected.set(null);
    this.sound.play('card-deal');
    this.afterAction(prev, recycling ? this.pileRect('waste') : this.pileRect('stock'));
  }

  undo(): void {
    if (!this.engine.undo()) return;
    const prev = this.snapshot();
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.ended = false;
    this.result.set(null);
    this.selected.set(null);
    this.sync();
    this.flip(prev, this.pileRect('waste'));
  }

  hint(): void {
    const h = this.engine.hint();
    this.clearHint();
    if (h === null) {
      this.toast.info('No moves left', 'Try undoing a few moves, or start a new game.');
      return;
    }
    if (h === 'draw') this.hintStock.set(true);
    else this.hinted.set(new Set(h));
    this.hintTimer = setTimeout(() => this.clearHint(), 1800);
  }

  // -------------------------------------------------------------- internals

  private removeCards(ids: string[]): void {
    const prev = this.snapshot();
    // Fly the removed cards off to the discard spot before the board re-renders.
    const target = this.pileRect('done');
    for (const id of ids) {
      const el = this.board().nativeElement.querySelector<HTMLElement>(`[data-card="${id}"]`);
      const from = prev.get(id);
      if (!el || !from || !target) continue;
      const ghost = el.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, margin: '0', zIndex: '60', pointerEvents: 'none' });
      document.body.appendChild(ghost);
      ghost
        .animate(
          [{ transform: 'none', opacity: 1 }, { transform: `translate(${target.left - from.left}px, ${target.top - from.top}px) scale(.7) rotate(8deg)`, opacity: 0 }],
          { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' },
        )
        .finished.finally(() => ghost.remove());
    }
    this.engine.remove(ids);
    this.sound.play('card-play');
    this.afterAction(prev);
  }

  private sync(): void {
    this.view.set(this.engine.view);
    this.available.set(new Set(this.engine.selectable()));
    this.free.set(new Set(this.engine.available()));
    this.canUndo.set(this.engine.canUndo());
    this.canRecycle.set(this.engine.canRecycle());
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
    if (this.ended) return;
    this.ended = true;
    this.stopTimer();
    const s = this.stats();
    this.saveStats({ played: s.played + 1, won: s.won + (result === 'won' ? 1 : 0), bestScore: Math.max(s.bestScore, this.view()!.score), ...this.runStats(result) });
    this.started = false;
    this.resultTimer = setTimeout(() => {
      this.sound.play(result === 'won' ? 'win' : 'lose');
      this.result.set(result);
    }, 500);
  }

  private blockedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Tell the player which cards are still on top of a covered card. */
  private explainBlocked(id: string): void {
    const slots = this.view()?.slots ?? [];
    const i = slots.findIndex((x) => !x.gone && x.card.id === id);
    if (i < 0) return;
    const on = coveredBy(i, slots).filter((c) => !slots[c].gone).map((c) => cardName(slots[c].card));
    if (!on.length) return;
    this.blocked.set(`${cardName(slots[i].card)} is covered — remove ${on.join(' and ')} first`);
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
    this.blockedTimer = setTimeout(() => this.blocked.set(null), 3000);
  }

  private cardById(id: string): Card | null {
    const v = this.view();
    if (!v) return null;
    return v.slots.find((s) => !s.gone && s.card.id === id)?.card ?? v.waste.find((c) => c.id === id) ?? null;
  }

  private runStats(result: 'won' | 'lost'): Partial<Stats> {
    if (!this.endless()) return {};
    const s = this.stats();
    const boards = this.boardNo() - (result === 'won' ? 0 : 1);
    return { bestRun: Math.max(s.bestRun ?? 0, this.total()), mostBoards: Math.max(s.mostBoards ?? 0, boards) };
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('pyramid.stats', this.stats());
  }

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
      .nativeElement.querySelectorAll<HTMLElement>('.pyramid [data-card]')
      .forEach((el, i) => {
        const to = el.getBoundingClientRect();
        el.animate(
          [{ transform: `translate(${stock.left - to.left}px, ${stock.top - to.top}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: 320, easing: FLIGHT.easing, delay: i * 18, fill: 'backwards' },
        );
      });
  }

  private shake(id: string): void {
    this.board()
      .nativeElement.querySelector(`[data-card="${id}"]`)
      ?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
  }

  private clearHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hinted.set(new Set());
    this.hintStock.set(false);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function cardName(c: Card): string {
  return `${c.rank}${SUIT_SYMBOL[c.suit]}`;
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
