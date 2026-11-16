import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayKey } from '../../core/services/progress.logic';
import { ProgressService } from '../../core/services/progress.service';
import { SeoService } from '../../core/services/seo.service';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { Modal } from '../../shared/components/modal/modal';
import { Grid, Level, PEERS, boxOf, candidates, colOf, conflicts, daySeed, generate, rowOf, seededRng } from './sudoku.engine';

interface Saved {
  level: Level;
  /** The date of the daily puzzle, or null for a random one. */
  daily: string | null;
  puzzle: Grid;
  solution: Grid;
  values: Grid;
  notes: number[];
  elapsed: number;
  mistakes: number;
  hints: number;
  done: boolean;
}

interface Stats {
  played: number;
  won: number;
  best: Partial<Record<Level, number>>;
  /** Dates of daily puzzles solved. */
  dailies: string[];
}

const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

@Component({
  selector: 'app-sudoku-game',
  imports: [RouterLink, Modal, AdBanner],
  templateUrl: './sudoku-game.html',
  styleUrl: './sudoku-game.scss',
})
export class SudokuGame implements OnDestroy {
  private readonly storage = inject(StorageService);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly progress = inject(ProgressService);
  private history: { values: Grid; notes: number[] }[] = [];
  private clock: ReturnType<typeof setInterval> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly levels = LEVELS;
  readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly cells = Array.from({ length: 81 }, (_, i) => ({ i, r: rowOf(i), c: colOf(i) }));

  readonly level = signal<Level>(this.storage.get<Level>('sudoku.level', 'medium'));
  /** Show wrong digits in red as you enter them. */
  readonly check = signal<boolean>(this.storage.get<boolean>('sudoku.check', true));
  readonly stats = signal<Stats>({ played: 0, won: 0, best: {}, dailies: [], ...this.storage.get<Partial<Stats>>('sudoku.stats', {}) });

  readonly daily = signal<string | null>(null);
  readonly puzzle = signal<Grid>([]);
  readonly solution = signal<Grid>([]);
  readonly values = signal<Grid>([]);
  readonly notes = signal<number[]>([]);
  readonly elapsed = signal(0);
  readonly mistakes = signal(0);
  readonly hints = signal(0);
  readonly done = signal(false);
  readonly showResult = signal(false);
  readonly selected = signal<number>(40);
  readonly notesMode = signal(false);
  /** Bumps when the puzzle is solved, to play the board's finishing ripple. */
  readonly celebrate = signal(false);

  readonly given = computed(() => new Set(this.puzzle().flatMap((v, i) => (v ? [i] : []))));
  /** Cells shown in red: wrong against the solution with checking on, otherwise only clashes. */
  readonly wrong = computed(() => {
    const v = this.values(), sol = this.solution(), given = this.given();
    if (this.check()) return new Set(v.flatMap((d, i) => (d && !given.has(i) && d !== sol[i] ? [i] : [])));
    return new Set([...conflicts(v)].filter((i) => !given.has(i)));
  });
  /** How many of each digit are on the board. */
  readonly placed = computed(() => {
    const n = Array(10).fill(0);
    this.values().forEach((d) => d && n[d]++);
    return n;
  });
  readonly selDigit = computed(() => this.values()[this.selected()] ?? 0);
  readonly peers = computed(() => new Set(PEERS[this.selected()] ?? []));
  readonly filled = computed(() => this.values().filter(Boolean).length);
  readonly time = computed(() => this.format(this.elapsed()));
  readonly title = computed(() => (this.daily() ? `Daily · ${cap(this.level())}` : cap(this.level())));
  readonly dailyDone = computed(() => this.stats().dailies.includes(dayKey(new Date())));

  constructor() {
    inject(SeoService).apply({
      title: 'Play Sudoku Online – Free Puzzles, 4 Levels | CardArena',
      description: 'Play Sudoku free in your browser: Easy to Expert puzzles with one solution each, a daily puzzle, notes, hints, undo and mistake checking. No download.',
      path: '/games/sudoku',
      image: '/og/sudoku.jpg',
    });
    const saved = this.storage.get<Saved | null>('sudoku.save', null);
    if (saved && !saved.done && saved.puzzle?.length === 81) this.restore(saved);
    else this.start(this.level(), null);
    this.clock = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clock) clearInterval(this.clock);
    this.timers.forEach(clearTimeout);
    this.save();
  }

  // -------------------------------------------------------------- view helpers

  format(sec: number): string {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(s).padStart(2, '0');
  }

  hasNote(i: number, d: number): boolean {
    return !!(this.notes()[i] & (1 << d));
  }

  cellLabel(i: number): string {
    const v = this.values()[i];
    const where = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
    if (!v) return `${where}, empty`;
    return `${where}, ${v}${this.given().has(i) ? ' (given)' : this.wrong().has(i) ? ' (wrong)' : ''}`;
  }

  // -------------------------------------------------------------- actions

  select(i: number): void {
    this.selected.set(i);
  }

  input(d: number): void {
    const i = this.selected();
    if (this.done() || this.given().has(i)) return;
    const values = this.values(), notes = this.notes();
    if (this.notesMode()) {
      if (values[i]) return;
      this.remember();
      this.notes.set(notes.map((m, k) => (k === i ? m ^ (1 << d) : m)));
      this.save();
      return;
    }
    if (values[i] === d) return;
    this.remember();
    this.values.set(values.map((v, k) => (k === i ? d : v)));
    // Clear this cell's notes and the digit from notes in its row, column and box.
    const peers = new Set(PEERS[i]);
    this.notes.set(notes.map((m, k) => (k === i ? 0 : peers.has(k) ? m & ~(1 << d) : m)));
    if (d !== this.solution()[i]) {
      this.mistakes.update((n) => n + 1);
      if (this.check()) this.sound.play('lose');
      else this.sound.play('card-play');
    } else this.sound.play('card-play');
    this.save();
    this.checkWin();
  }

  erase(): void {
    const i = this.selected();
    if (this.done() || this.given().has(i) || (!this.values()[i] && !this.notes()[i])) return;
    this.remember();
    this.values.set(this.values().map((v, k) => (k === i ? 0 : v)));
    this.notes.set(this.notes().map((m, k) => (k === i ? 0 : m)));
    this.save();
  }

  undo(): void {
    const last = this.history.pop();
    if (!last || this.done()) return;
    this.values.set(last.values);
    this.notes.set(last.notes);
    this.save();
  }

  /** Fill the selected cell if it's empty or wrong; otherwise the easiest open cell. */
  hint(): void {
    if (this.done()) return;
    const v = this.values(), sol = this.solution();
    let i = this.selected();
    if (this.given().has(i) || v[i] === sol[i]) {
      const cand = candidates(v.map((d, k) => (d === sol[k] ? d : 0)));
      const open = v.flatMap((d, k) => (d !== sol[k] ? [k] : []));
      if (!open.length) return;
      open.sort((a, b) => popcount(cand[a]) - popcount(cand[b]));
      i = open[0];
    }
    this.remember();
    this.selected.set(i);
    this.hints.update((n) => n + 1);
    const d = sol[i];
    const peers = new Set(PEERS[i]);
    this.values.set(v.map((x, k) => (k === i ? d : x)));
    this.notes.set(this.notes().map((m, k) => (k === i ? 0 : peers.has(k) ? m & ~(1 << d) : m)));
    this.sound.play('card-select');
    this.save();
    this.checkWin();
  }

  toggleNotes(): void {
    this.notesMode.update((on) => !on);
  }

  /** Fill every empty cell's notes with the digits it could still take. */
  autoNotes(): void {
    if (this.done()) return;
    this.remember();
    const v = this.values();
    const cand = candidates(v);
    this.notes.set(v.map((d, i) => (d ? 0 : cand[i])));
    this.save();
  }

  toggleCheck(): void {
    const on = !this.check();
    this.check.set(on);
    this.storage.set('sudoku.check', on);
    this.toast.info(on ? 'Mistakes shown' : 'Mistakes hidden', on ? 'Wrong digits turn red as you enter them.' : 'Only digits that clash in a row, column or box turn red.');
  }

  newGame(level: Level = this.level()): void {
    this.abandon();
    this.level.set(level);
    this.storage.set('sudoku.level', level);
    this.start(level, null);
    this.sound.play('card-deal');
  }

  playDaily(): void {
    const today = dayKey(new Date());
    if (this.daily() === today && !this.done()) {
      this.toast.info('Daily puzzle', 'You’re already playing today’s puzzle.');
      return;
    }
    this.abandon();
    this.start('medium', today);
    this.sound.play('card-deal');
    if (this.dailyDone()) this.toast.info('Daily puzzle', 'You’ve solved today’s puzzle already — this one is for practice.');
  }

  reviewBoard(): void {
    this.showResult.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    if (this.showResult()) return;
    const i = this.selected();
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      this.selected.set(((rowOf(i) + dr + 9) % 9) * 9 + ((colOf(i) + dc + 9) % 9));
    };
    if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.input(Number(e.key));
    } else if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowDown') move(1, 0);
    else if (e.key === 'ArrowLeft') move(0, -1);
    else if (e.key === 'ArrowRight') move(0, 1);
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      this.erase();
    } else if (e.key === 'n' || e.key === 'N') this.toggleNotes();
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.undo();
    }
  }

  // -------------------------------------------------------------- internals

  private start(level: Level, daily: string | null): void {
    const rng = daily ? seededRng(daySeed(daily)) : seededRng(Math.floor(Math.random() * 2 ** 31));
    const p = generate(level, rng);
    this.level.set(level);
    this.daily.set(daily);
    this.puzzle.set(p.puzzle);
    this.solution.set(p.solution);
    this.values.set([...p.puzzle]);
    this.notes.set(Array(81).fill(0));
    this.elapsed.set(0);
    this.mistakes.set(0);
    this.hints.set(0);
    this.done.set(false);
    this.showResult.set(false);
    this.celebrate.set(false);
    this.notesMode.set(false);
    this.history = [];
    this.selected.set(p.puzzle.findIndex((v) => !v));
    this.save();
  }

  private restore(s: Saved): void {
    this.level.set(s.level);
    this.daily.set(s.daily);
    this.puzzle.set(s.puzzle);
    this.solution.set(s.solution);
    this.values.set(s.values);
    this.notes.set(s.notes);
    this.elapsed.set(s.elapsed);
    this.mistakes.set(s.mistakes);
    this.hints.set(s.hints);
    this.selected.set(Math.max(0, s.values.findIndex((v) => !v)));
  }

  private tick(): void {
    if (this.done() || this.showResult() || (typeof document !== 'undefined' && document.hidden)) return;
    this.elapsed.update((t) => t + 1);
    if (this.elapsed() % 5 === 0) this.save();
  }

  private remember(): void {
    this.history.push({ values: this.values(), notes: this.notes() });
    if (this.history.length > 300) this.history.shift();
  }

  private checkWin(): void {
    const v = this.values(), sol = this.solution();
    if (!v.every((d, i) => d === sol[i])) return;
    this.done.set(true);
    const level = this.level(), t = this.elapsed();
    const s = this.stats();
    const best = s.best[level];
    const record = best === undefined || t < best;
    const today = this.daily();
    this.saveStats({
      played: s.played + 1,
      won: s.won + 1,
      best: record ? { ...s.best, [level]: t } : s.best,
      dailies: today && !s.dailies.includes(today) ? [...s.dailies, today].slice(-60) : s.dailies,
    });
    this.progress.record('sudoku', 'win');
    if (level === 'expert' && !this.hints()) this.progress.unlock('sudoku-expert');
    this.save();
    this.celebrate.set(true);
    this.later(() => {
      this.sound.play('win');
      this.showResult.set(true);
    }, 1100);
    this.newRecord = record && best !== undefined;
  }
  /** Shown in the result: this time beat a previous best. */
  newRecord = false;

  /** Starting another puzzle part-way through counts as a loss. */
  private abandon(): void {
    if (this.done() || !this.values().some((v, i) => v !== this.puzzle()[i])) return;
    this.saveStats({ ...this.stats(), played: this.stats().played + 1 });
    this.progress.record('sudoku', 'loss');
  }

  private save(): void {
    if (!this.puzzle().length) return;
    const s: Saved = {
      level: this.level(),
      daily: this.daily(),
      puzzle: this.puzzle(),
      solution: this.solution(),
      values: this.values(),
      notes: this.notes(),
      elapsed: this.elapsed(),
      mistakes: this.mistakes(),
      hints: this.hints(),
      done: this.done(),
    };
    this.storage.set('sudoku.save', s);
  }

  private saveStats(s: Stats): void {
    this.stats.set(s);
    this.storage.set('sudoku.stats', s);
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  /** For the template: the box a cell is in. */
  box(i: number): number {
    return boxOf(i);
  }
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}
