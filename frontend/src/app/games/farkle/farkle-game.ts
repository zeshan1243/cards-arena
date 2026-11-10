import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { seededRng } from '../core/deck';
import { FarkleEngine, FarkleState, Level, keeps, scoringIndexes } from './farkle.engine';

interface Stats {
  played: number;
  won: number;
  /** Fewest turns to reach 10,000 solo. */
  bestTurns: number;
  bestTurn: number;
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const ROLL_MS = 520;
const CPU_MS = 750;

export const SCORING = [
  { combo: 'Single 1', pts: '100' },
  { combo: 'Single 5', pts: '50' },
  { combo: 'Three 1s', pts: '1,000' },
  { combo: 'Three of a kind', pts: 'face × 100' },
  { combo: 'Four of a kind', pts: '1,000' },
  { combo: 'Five of a kind', pts: '2,000' },
  { combo: 'Six of a kind', pts: '3,000' },
  { combo: 'Straight 1–6', pts: '1,500' },
  { combo: 'Three pairs', pts: '1,500' },
  { combo: 'Four of a kind + pair', pts: '1,500' },
  { combo: 'Two triplets', pts: '2,500' },
];

@Component({
  selector: 'app-farkle-game',
  imports: [RouterLink, Modal, AdBanner],
  templateUrl: './farkle-game.html',
  styleUrl: './farkle-game.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class FarkleGame implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly rng = seededRng(Math.floor(Math.random() * 2 ** 31));
  private readonly dieEls = viewChildren<ElementRef<HTMLElement>>('die');

  private engine!: FarkleEngine;
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly scoring = SCORING;
  readonly opponents = signal<number>(this.storage.get<number>('farkle.opponents', 1));
  readonly level = signal<Level>(this.storage.get<Level>('farkle.level', 'normal'));
  readonly target = signal<number>(this.storage.get<number>('farkle.target', 10000));
  readonly view = signal<FarkleState | null>(null);
  readonly selected = signal<number[]>([]);
  readonly rolling = signal(false);
  readonly busy = signal(false);
  readonly over = signal(false);
  /** Last thing that happened, shown under the dice. */
  readonly log = signal('');
  readonly showChart = signal(false);
  readonly stats = signal<Stats>(this.storage.get<Stats>('farkle.stats', { played: 0, won: 0, bestTurns: 0, bestTurn: 0 }));

  readonly names = computed(() => {
    const n = this.view()?.players.length ?? 1;
    return Array.from({ length: n }, (_, i) => (i === 0 ? 'You' : n === 2 ? 'Computer' : `CPU ${i}`));
  });
  readonly myTurn = computed(() => this.view()?.turn === 0 && !this.busy() && !this.over());
  readonly choosing = computed(() => this.myTurn() && this.view()?.phase === 'choose' && !this.rolling());
  readonly scoringDice = computed(() => {
    const v = this.view();
    return v && v.phase === 'choose' ? scoringIndexes(v.dice) : new Set<number>();
  });
  readonly pickPoints = computed(() => {
    this.view();
    return this.selected().length ? this.engine.pickPoints(this.selected()) : 0;
  });
  /** Dice left to roll after setting aside the selection (6 again on hot dice). */
  readonly rollCount = computed(() => {
    const v = this.view();
    if (!v || v.phase !== 'choose') return 6;
    const left = v.dice.length - this.selected().length;
    return left === 0 ? 6 : left;
  });
  readonly bankTotal = computed(() => (this.view()?.turnPoints ?? 0) + this.pickPoints());
  readonly status = computed(() => {
    const v = this.view();
    if (!v || this.over()) return 'Game over';
    if (v.turn !== 0) return `${this.names()[v.turn]}’s turn`;
    if (v.finalFrom !== null && v.finalFrom !== 0) return 'Last turn — beat the leader!';
    if (v.phase === 'start') return 'Roll the dice';
    if (v.phase === 'farkle') return 'Farkle!';
    return 'Pick scoring dice';
  });
  readonly winnerText = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.players.length === 1) return `${v.target.toLocaleString()} in ${v.players[0].turns} turns`;
    const w = this.engine.winner();
    return w === 0 ? 'You won!' : w === -1 ? 'It’s a tie!' : `${this.names()[w ?? 1]} won`;
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Farkle Online – Free Dice Game | CardArena',
      description: 'Play Farkle free in your browser: roll six dice, set aside scoring dice and bank before you Farkle. Solo or against up to three computers. No download.',
      path: '/games/farkle',
      image: '/og/farkle.jpg',
    });
    this.newGame();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  // -------------------------------------------------------------- game flow

  newGame(): void {
    this.clearTimers();
    if (this.started() && !this.over()) this.saveStats({ played: this.stats().played + 1 });
    this.engine = new FarkleEngine(1 + this.opponents(), this.target());
    this.busy.set(false);
    this.rolling.set(false);
    this.over.set(false);
    this.selected.set([]);
    this.log.set(this.opponents() ? `First to ${this.target().toLocaleString()} wins` : `Reach ${this.target().toLocaleString()} in as few turns as you can`);
    this.sync();
  }

  setOpponents(n: number): void {
    if (n === this.opponents()) return;
    this.opponents.set(n);
    this.storage.set('farkle.opponents', n);
    this.newGame();
  }

  setTarget(t: number): void {
    if (t === this.target()) return;
    this.target.set(t);
    this.storage.set('farkle.target', t);
    this.newGame();
  }

  setLevel(l: Level): void {
    this.level.set(l);
    this.storage.set('farkle.level', l);
  }

  toggle(i: number): void {
    if (!this.choosing()) return;
    this.selected.update((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    this.sound.play('card-select');
  }

  /** Select the highest-scoring set of dice. */
  selectBest(): void {
    const v = this.view();
    if (!this.choosing() || !v) return;
    const best = keeps(v.dice)[0];
    this.selected.set(pickIndexes(v.dice, best.dice));
    this.sound.play('card-select');
  }

  roll(): void {
    const v = this.view();
    if (!v || !this.myTurn() || this.rolling()) return;
    if (v.phase === 'start') this.doRoll([]);
    else if (v.phase === 'choose' && this.pickPoints()) this.doRoll(this.selected());
    else if (v.phase === 'choose') this.toast.info('Set aside scoring dice first', 'Tap the dice you want to keep — 1s, 5s or sets.');
  }

  bank(): void {
    if (!this.choosing() || !this.pickPoints()) return;
    this.doBank(this.selected());
  }

  onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [role="dialog"]')) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.roll();
    } else if (e.key === 'b' || e.key === 'B') {
      this.bank();
    } else if (/^[1-6]$/.test(e.key)) {
      this.toggle(Number(e.key) - 1);
    }
  }

  pipsOf(face: number): boolean[] {
    return Array.from({ length: 9 }, (_, k) => PIPS[face].includes(k));
  }

  progress(score: number): number {
    return Math.min(1, score / (this.view()?.target ?? 10000));
  }

  // -------------------------------------------------------------- internals

  private started(): boolean {
    const v = this.engine?.view;
    return !!v && v.players.some((p) => p.turns > 0 || p.score > 0);
  }

  private doRoll(pick: number[], after?: () => void): void {
    const hot = this.view()!.phase === 'choose' && pick.length === this.view()!.dice.length;
    if (!this.engine.roll(this.rng, pick)) return;
    this.selected.set([]);
    this.rolling.set(true);
    this.sound.play('card-deal');
    if (hot) this.log.set(`Hot dice! ${this.names()[this.view()!.turn]} rolls all six again`);
    this.sync();
    this.dieEls().forEach((el, i) => {
      const spin = (this.rng() < 0.5 ? -1 : 1) * (300 + Math.floor(this.rng() * 200));
      el.nativeElement.animate(
        [
          { transform: `translateY(-38px) rotate(${-spin}deg) scale(.85)`, opacity: 0.4 },
          { transform: `translateY(6px) rotate(${-spin * 0.15}deg) scale(1.02)`, opacity: 1, offset: 0.7 },
          { transform: 'none' },
        ],
        { duration: ROLL_MS - 60 + i * 15, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    });
    this.later(() => {
      this.rolling.set(false);
      this.sound.play('card-play');
      if (this.engine.view.phase === 'farkle') this.farkled();
      else after?.();
    }, ROLL_MS);
  }

  private doBank(pick: number[]): void {
    const seat = this.engine.view.turn;
    const total = this.engine.view.turnPoints + this.engine.pickPoints(pick);
    this.engine.bank(pick);
    this.selected.set([]);
    if (seat === 0 && total > this.stats().bestTurn) this.saveStats({ bestTurn: total });
    this.log.set(`${this.names()[seat]} banked ${total.toLocaleString()}`);
    this.sound.play('turn');
    this.sync();
    this.nextTurn();
  }

  private farkled(): void {
    const seat = this.engine.view.turn;
    this.sound.play('lose');
    this.log.set(`${this.names()[seat]} farkled — no points this turn`);
    this.busy.set(true);
    this.later(() => {
      this.engine.pass();
      this.sync();
      this.nextTurn();
    }, 1500);
  }

  private nextTurn(): void {
    if (this.engine.isOver()) {
      this.finish();
      return;
    }
    if (this.engine.view.turn === 0) {
      this.busy.set(false);
      return;
    }
    this.busy.set(true);
    this.later(() => this.cpuRoll(), CPU_MS);
  }

  private cpuRoll(pick: number[] = []): void {
    this.doRoll(pick, () => this.later(() => this.cpuChoose(), CPU_MS * 0.6));
  }

  private cpuChoose(): void {
    const d = this.engine.decide(this.level(), this.rng);
    this.selected.set(d.pick);
    this.later(() => {
      if (d.bank) this.doBank(d.pick);
      else this.cpuRoll(d.pick);
    }, CPU_MS);
  }

  private finish(): void {
    this.busy.set(false);
    const v = this.engine.view;
    const s = this.stats();
    const solo = v.players.length === 1;
    const won = !solo && this.engine.winner() === 0;
    this.saveStats({
      played: s.played + 1,
      won: s.won + (won ? 1 : 0),
      bestTurns: solo && v.target === 10000 ? (s.bestTurns ? Math.min(s.bestTurns, v.players[0].turns) : v.players[0].turns) : s.bestTurns,
    });
    this.later(() => {
      this.sound.play(solo || won ? 'win' : 'lose');
      this.over.set(true);
    }, 700);
  }

  private sync(): void {
    const v = this.engine.view;
    this.view.set({ ...v });
  }

  private saveStats(patch: Partial<Stats>): void {
    this.stats.update((s) => ({ ...s, ...patch }));
    this.storage.set('farkle.stats', this.stats());
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

/** Indexes in `roll` for the dice values in `want`. */
function pickIndexes(roll: number[], want: number[]): number[] {
  const pick: number[] = [];
  for (const d of want) pick.push(roll.findIndex((x, i) => x === d && !pick.includes(i)));
  return pick;
}
