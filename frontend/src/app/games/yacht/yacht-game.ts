import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChildren } from '@angular/core';
import { ProgressService } from '../../core/services/progress.service';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BOT_ROSTER } from '../core/bots';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { seededRng } from '../core/deck';
import {
  CATEGORIES, Category, HINTS, LABELS, LOWER, Level, ROLLS, UPPER, UPPER_BONUS, UPPER_BONUS_AT, YACHT_BONUS,
  YachtEngine, YachtState, isYacht, total, upperBonus, upperTotal,
} from './yacht.engine';

interface Stats {
  played: number;
  won: number;
  best: number;
}

/** Which pips show on each face, as cells of a 3×3 grid (0–8). */
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const ROLL_MS = 520;
/** The computer's pause between steps. */
const CPU_MS = 650;

@Component({
  selector: 'app-yacht-game',
  imports: [RouterLink, NgTemplateOutlet, Modal, AdBanner],
  templateUrl: './yacht-game.html',
  styleUrl: './yacht-game.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class YachtGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly progress = inject(ProgressService);
  private readonly toast = inject(ToastService);
  private readonly rng = seededRng(Math.floor(Math.random() * 2 ** 31));
  private readonly dieEls = viewChildren<ElementRef<HTMLElement>>('die');

  private engine!: YachtEngine;
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly upper = UPPER;
  readonly lower = LOWER;
  readonly pips = PIPS;
  readonly bonusAt = UPPER_BONUS_AT;
  readonly bonus = UPPER_BONUS;
  readonly rollsPerTurn = ROLLS;

  readonly opponents = signal<number>(this.storage.get<number>('yacht.opponents', 1));
  readonly level = signal<Level>(this.storage.get<Level>('yacht.level', 'normal'));
  readonly view = signal<YachtState | null>(null);
  readonly rolling = signal(false);
  readonly busy = signal(false);
  /** Box the computer is about to fill, highlighted for a moment. */
  readonly cpuPick = signal<Category | null>(null);
  /** Box just filled, for a short flash: `seat:category`. */
  readonly justFilled = signal<string | null>(null);
  readonly over = signal(false);
  readonly stats = signal<Stats>(this.storage.get<Stats>('yacht.stats', { played: 0, won: 0, best: 0 }));

  readonly names = computed(() => {
    const n = this.view()?.players.length ?? 1;
    return Array.from({ length: n }, (_, i) => (i === 0 ? 'You' : BOT_ROSTER[i - 1].name));
  });
  readonly myTurn = computed(() => this.view()?.turn === 0 && !this.busy() && !this.over());
  readonly rolled = computed(() => (this.view()?.rollsLeft ?? ROLLS) < ROLLS);
  readonly canRoll = computed(() => this.myTurn() && !this.rolling() && (this.view()?.rollsLeft ?? 0) > 0);
  /** What each open box would score for you right now. */
  readonly choices = computed(() => {
    this.view();
    return this.myTurn() && this.rolled() && !this.rolling() ? this.engine.options() : new Map<Category, number>();
  });
  readonly bestChoice = computed(() => {
    let best: Category | null = null;
    for (const [c, p] of this.choices()) if (best === null || p > this.choices().get(best)!) best = c;
    return best;
  });
  readonly totals = computed(() => this.view()?.players.map(total) ?? [0]);
  readonly yacht = computed(() => this.rolled() && !this.rolling() && isYacht(this.view()!.dice));
  readonly status = computed(() => {
    const v = this.view();
    if (!v || this.over()) return 'Game over';
    if (v.turn !== 0) return `${this.names()[v.turn]} is rolling…`;
    if (!this.rolled()) return 'Roll the dice';
    if (v.rollsLeft === 0) return 'Pick a box to score';
    return 'Tap dice to hold, or score';
  });
  readonly winnerText = computed(() => {
    const t = this.totals();
    if (t.length === 1) return t[0] >= 200 ? 'Great game!' : 'Game complete';
    const best = Math.max(...t);
    const winners = t.flatMap((x, i) => (x === best ? [i] : []));
    if (winners.length > 1) return winners.includes(0) ? 'It’s a tie!' : `${winners.map((i) => this.names()[i]).join(' & ')} tied`;
    return winners[0] === 0 ? 'You won!' : `${this.names()[winners[0]]} won`;
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Yacht Dice Online – Free Dice Game | CardArena',
      description: 'Play Yacht Dice free in your browser: roll five dice up to three times, fill 13 scoring boxes and chase the 50-point Yacht. Solo or against the computer.',
      path: '/games/yacht-dice',
      image: '/og/yacht-dice.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.clearTimers();
    if (this.started() && !this.over()) {
      this.saveStats({ played: this.stats().played + 1 });
      if ((this.view()?.players.length ?? 1) > 1) this.progress.record('yacht-dice', 'loss');
    }
    this.engine = new YachtEngine(1 + this.opponents());
    this.busy.set(false);
    this.rolling.set(false);
    this.over.set(false);
    this.cpuPick.set(null);
    this.sync();
  }

  setOpponents(n: number): void {
    if (n === this.opponents()) return;
    this.opponents.set(n);
    this.storage.set('yacht.opponents', n);
    if (this.started() && !this.over()) this.toast.info('New game', n ? `Playing against ${n} computer${n > 1 ? 's' : ''}.` : 'Playing solo.');
    this.newGame();
  }

  setLevel(l: Level): void {
    if (l === this.level()) return;
    this.level.set(l);
    this.storage.set('yacht.level', l);
  }

  roll(): void {
    if (!this.canRoll()) return;
    this.doRoll();
  }

  toggle(i: number): void {
    if (!this.myTurn() || this.rolling() || !this.engine.toggleHold(i)) return;
    this.sound.play('card-select');
    this.sync();
  }

  score(cat: Category): void {
    if (!this.choices().has(cat)) return;
    this.fill(cat);
  }

  onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [role="dialog"]')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.key === ' ' || !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        this.roll();
      }
    } else if (/^[1-5]$/.test(e.key)) {
      this.toggle(Number(e.key) - 1);
    }
  }

  // ------------------------------------------------------------- template helpers

  label(c: Category): string {
    return LABELS[c];
  }
  hint(c: Category): string {
    return HINTS[c];
  }
  cell(seat: number, cat: Category): number | undefined {
    return this.view()?.players[seat].card[cat];
  }
  upperSum(seat: number): number {
    return upperTotal(this.view()!.players[seat].card);
  }
  upperBonusOf(seat: number): number {
    return upperBonus(this.view()!.players[seat].card);
  }
  upperDone(seat: number): boolean {
    return UPPER.every((c) => this.cell(seat, c) !== undefined);
  }
  yachtBonusOf(seat: number): number {
    return this.view()!.players[seat].bonusYachts * YACHT_BONUS;
  }
  pipsOf(face: number): boolean[] {
    const on = PIPS[face];
    return Array.from({ length: 9 }, (_, k) => on.includes(k));
  }

  // -------------------------------------------------------------- internals

  private started(): boolean {
    const v = this.engine?.view;
    return !!v && (v.round > 1 || v.turn > 0 || v.rollsLeft < ROLLS);
  }

  /** Roll the free dice with a tumble, then hand back to `after`. */
  private doRoll(after?: () => void): void {
    const free = this.engine.rolled ? this.view()!.held.map((h) => !h) : [true, true, true, true, true];
    this.engine.roll(this.rng);
    this.rolling.set(true);
    this.sound.play('card-deal');
    this.sync();
    const els = this.dieEls();
    free.forEach((f, i) => {
      if (!f || !els[i]) return;
      const spin = (this.rng() < 0.5 ? -1 : 1) * (300 + Math.floor(this.rng() * 200));
      els[i].nativeElement.animate(
        [
          { transform: `translateY(-38px) rotate(${-spin}deg) scale(.85)`, offset: 0 },
          { transform: `translateY(6px) rotate(${-spin * 0.15}deg) scale(1.02)`, offset: 0.7 },
          { transform: 'none' },
        ],
        { duration: ROLL_MS - 60 + i * 15, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    });
    this.later(() => {
      this.rolling.set(false);
      this.sound.play('card-play');
      if (isYacht(this.engine.view.dice)) this.sound.play('win');
      after?.();
    }, ROLL_MS);
  }

  private fill(cat: Category): void {
    const seat = this.engine.view.turn;
    const dice = this.engine.view.dice;
    if (seat === 0 && dice.length === 5 && dice.every((d) => d === dice[0])) this.progress.unlock('yacht');
    this.engine.score(cat);
    this.justFilled.set(`${seat}:${cat}`);
    this.later(() => this.justFilled.set(null), 900);
    this.cpuPick.set(null);
    this.sound.play('button');
    this.sync();
    if (this.engine.isOver()) {
      this.finish();
      return;
    }
    if (this.engine.view.turn !== 0) {
      this.busy.set(true);
      this.later(() => this.cpuTurn(), CPU_MS);
    } else {
      this.busy.set(false);
      if (this.opponents()) this.later(() => this.sound.play('turn'), 200);
    }
  }

  private cpuTurn(): void {
    const level = this.level();
    this.doRoll(() => this.cpuStep(level));
  }

  private cpuStep(level: Level): void {
    if (this.engine.shouldStop(level)) {
      const cat = this.engine.chooseCategory(level, this.rng);
      this.cpuPick.set(cat);
      this.later(() => this.fill(cat), CPU_MS);
      return;
    }
    this.engine.setHeld(this.engine.chooseHolds(level));
    this.sync();
    this.later(() => this.doRoll(() => this.cpuStep(level)), CPU_MS);
  }

  private finish(): void {
    this.busy.set(false);
    const t = this.engine.totals();
    const won = t.length > 1 && t[0] === Math.max(...t) && t.filter((x) => x === t[0]).length === 1;
    const s = this.stats();
    this.saveStats({ played: s.played + 1, won: s.won + (won ? 1 : 0), best: Math.max(s.best, t[0]) });
    this.progress.record('yacht-dice', t.length === 1 ? 'done' : won ? 'win' : t[0] === Math.max(...t) ? 'draw' : 'loss');
    this.later(() => {
      this.sound.play(t.length === 1 || won ? 'win' : 'lose');
      this.over.set(true);
    }, 700);
  }

  private sync(): void {
    this.view.set(this.engine.view);
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('yacht.stats', this.stats());
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  protected readonly categories = CATEGORIES;
}
