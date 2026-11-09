import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { Battle, Side, WarEngine, WarMode, WarState } from './war.engine';

interface Stats {
  played: number;
  won: number;
}

/** Auto-play pace, in ms: how long a battle stays on the table, and the gap before the next. */
const PACE = { normal: { show: 750, gap: 250 }, fast: { show: 260, gap: 60 } } as const;
type Speed = keyof typeof PACE;
const FLIGHT = { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' };

@Component({
  selector: 'app-war-game',
  imports: [RouterLink, PlayingCard, Modal, AdBanner],
  templateUrl: './war-game.html',
  styleUrl: './war-game.scss',
  host: { '(document:keydown.space)': 'onSpace($event)' },
})
export class WarGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly injector = inject(Injector);
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  private engine!: WarEngine;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private started = false;

  readonly mode = signal<WarMode>(this.storage.get<WarMode>('war.mode', 'classic'));
  readonly view = signal<WarState | null>(null);
  /** The battle on the table, until its cards are collected. */
  readonly battle = signal<Battle | null>(null);
  readonly busy = signal(false);
  readonly auto = signal(false);
  readonly speed = signal<Speed>('normal');
  readonly result = signal<Side | 'draw' | null>(null);
  readonly stats = signal<Stats>(this.storage.get<Stats>('war.stats', { played: 0, won: 0 }));

  /** Cards on the table come off the decks as soon as they are played. */
  readonly deckCounts = computed(() => {
    const v = this.view();
    const b = this.battle();
    return [0, 1].map((i) => (v?.decks[i].length ?? 0) - (b?.table[i].length ?? 0));
  });
  readonly wonCounts = computed(() => [0, 1].map((i) => this.view()?.won[i].length ?? 0));
  readonly totals = computed(() => [0, 1].map((i) => this.deckCounts()[i] + this.wonCounts()[i] + (this.battle()?.table[i].length ?? 0)));
  readonly message = computed(() => {
    const b = this.battle();
    if (!b) return this.started ? '' : 'Tap your deck to flip';
    const war = b.wars ? (b.wars > 1 ? `${b.wars}× WAR! ` : 'WAR! ') : '';
    const n = b.table[0].length + b.table[1].length;
    return `${war}${b.winner === 0 ? 'You take' : 'Computer takes'} ${n} cards`;
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play War Card Game Online – Free vs Computer | CardArena',
      description: 'Play the War card game free in your browser. Flip cards against the computer, win wars and capture the whole deck. Classic or Quick mode, auto-play.',
      path: '/games/war',
      image: '/og/war.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.clearTimers();
    if (this.started && this.result() === null) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new WarEngine(Math.floor(Math.random() * 2 ** 31), this.mode());
    this.started = false;
    this.auto.set(false);
    this.busy.set(false);
    this.battle.set(null);
    this.result.set(null);
    this.view.set(this.engine.view);
    this.sound.play('card-deal');
  }

  setMode(m: WarMode): void {
    if (m === this.mode()) return;
    this.mode.set(m);
    this.storage.set('war.mode', m);
    this.newGame();
  }

  toggleAuto(): void {
    this.auto.update((a) => !a);
    if (this.auto() && !this.busy()) this.flip();
  }

  toggleSpeed(): void {
    this.speed.update((s) => (s === 'normal' ? 'fast' : 'normal'));
  }

  onSpace(event: Event): void {
    if ((event.target as HTMLElement)?.closest('button, a, input, select')) return;
    event.preventDefault();
    this.flip();
  }

  flip(): void {
    if (this.busy() || this.result() !== null) return;
    const before = this.snapshot();
    const b = this.engine.battle();
    if (!b) return;
    this.started = true;
    this.busy.set(true);
    this.battle.set(b);
    this.sound.play(b.wars ? 'thulla' : 'card-play');
    this.animateIn(before);
    const pace = PACE[this.speed()];
    this.later(() => this.collect(b.winner), pace.show + (b.wars ? 500 : 0));
  }

  /** Sweep the pot to the winner, then update the counts. */
  private collect(winner: Side): void {
    const target = this.pileRect(this.mode() === 'quick' ? `won-${winner}` : `deck-${winner}`);
    const els = this.board().nativeElement.querySelectorAll<HTMLElement>('.table [data-card]');
    if (target)
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        el.animate([{ transform: 'none' }, { transform: `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(.9)`, opacity: 0.6 }], {
          duration: 240,
          easing: 'ease-in',
          fill: 'forwards',
        });
      });
    this.later(() => {
      this.battle.set(null);
      this.view.set(this.engine.view);
      this.busy.set(false);
      const r = this.engine.result();
      if (r !== null) this.finish(r);
      else if (this.auto()) this.later(() => this.flip(), PACE[this.speed()].gap);
    }, target ? 250 : 0);
  }

  private finish(r: Side | 'draw'): void {
    this.auto.set(false);
    const s = this.stats();
    this.saveStats({ played: s.played + 1, won: s.won + (r === 0 ? 1 : 0) });
    this.started = false;
    this.later(() => {
      this.sound.play(r === 0 ? 'win' : 'lose');
      this.result.set(r);
    }, 300);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('war.stats', this.stats());
  }

  // ------------------------------------------------------------- animation

  private snapshot(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    for (const id of ['deck-0', 'deck-1']) {
      const r = this.pileRect(id);
      if (r) map.set(id, r);
    }
    return map;
  }

  private pileRect(id: string): DOMRect | undefined {
    return this.board().nativeElement.querySelector(`[data-pile="${id}"]`)?.getBoundingClientRect();
  }

  /** Each new table card flies out of its owner's deck, war cards one after another. */
  private animateIn(decks: Map<string, DOMRect>): void {
    afterNextRender(
      () => {
        this.board()
          .nativeElement.querySelectorAll<HTMLElement>('.table [data-card]')
          .forEach((el) => {
            const from = decks.get(`deck-${el.dataset['side']}`);
            if (!from) return;
            const to = el.getBoundingClientRect();
            el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }], {
              ...FLIGHT,
              delay: Number(el.dataset['i']) * (this.speed() === 'fast' ? 40 : 110),
              fill: 'backwards',
            });
          });
      },
      { injector: this.injector },
    );
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
