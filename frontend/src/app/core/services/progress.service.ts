import { Injectable, computed, inject, signal } from '@angular/core';
import { GAMES } from '../data/games.data';
import { ACHIEVEMENTS, Achievement, EMPTY_PROGRESS, Outcome, Progress, dayKey, liveDays, migrate, newlyEarned, recordGame, totals } from './progress.logic';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';

const KEY = 'progress';
/** Old per-game stats keys, read once to seed progress. */
const OLD_KEYS: Record<string, string> = {
  solitaire: 'solitaire.stats',
  tripeaks: 'tripeaks.stats',
  'pyramid-solitaire': 'pyramid.stats',
  war: 'war.stats',
  checkers: 'checkers.stats',
  'yacht-dice': 'yacht.stats',
  farkle: 'farkle.stats',
};

/**
 * Games played and won, win streaks, the daily play streak and achievements, saved on this
 * device. Every game calls `record` once when a game finishes.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly slugs = GAMES.map((g) => g.slug);

  readonly progress = signal<Progress>(this.load());
  readonly totals = computed(() => totals(this.progress()));
  /** Days in a row you've played, as of today. */
  readonly dayStreak = computed(() => liveDays(this.progress(), dayKey(new Date())));
  readonly playedToday = computed(() => this.progress().days.last === dayKey(new Date()));
  readonly achievements = ACHIEVEMENTS;
  readonly unlockedCount = computed(() => ACHIEVEMENTS.filter((a) => this.progress().achievements[a.id]).length);

  /** Call once when a game finishes. */
  record(slug: string, outcome: Outcome): void {
    const today = dayKey(new Date());
    const before = this.progress().days;
    let p = recordGame(this.progress(), slug, outcome, today);
    const earned = newlyEarned(p, this.slugs);
    p = { ...p, achievements: { ...p.achievements, ...Object.fromEntries(earned.map((a) => [a.id, today])) } };
    this.save(p);
    // Let the result screen show first.
    setTimeout(() => {
      if (before.last !== today && p.days.current > 1) this.toast.show('success', `🔥 ${p.days.current}-day streak!`, 'You’ve played every day — come back tomorrow to keep it going.');
      earned.forEach((a, i) => setTimeout(() => this.announce(a), i * 700));
    }, 900);
  }

  /** Unlock a game-specific achievement. */
  unlock(id: string): void {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || this.progress().achievements[id]) return;
    this.save({ ...this.progress(), achievements: { ...this.progress().achievements, [id]: dayKey(new Date()) } });
    setTimeout(() => this.announce(a), 600);
  }

  /** Your record in one game (read inside a computed/template to stay live). */
  game(slug: string) {
    return this.progress().games[slug] ?? null;
  }

  reset(): void {
    this.save(EMPTY_PROGRESS);
  }

  private announce(a: Achievement): void {
    this.toast.show('achievement', `${a.icon} Achievement unlocked: ${a.title}`, a.description, 5000);
  }

  private save(p: Progress): void {
    this.progress.set(p);
    this.storage.set(KEY, p);
  }

  private load(): Progress {
    const saved = this.storage.get<Progress | null>(KEY, null);
    if (saved) return { ...EMPTY_PROGRESS, ...saved };
    const old = Object.fromEntries(Object.entries(OLD_KEYS).map(([slug, key]) => [slug, this.storage.get<{ played?: number; won?: number; drawn?: number } | undefined>(key, undefined)]));
    // Spider keeps stats per suit count.
    const spider = Object.values(this.storage.get<Record<string, { played: number; won: number }>>('spider.stats', {}));
    old['spider-solitaire'] = { played: spider.reduce((t, x) => t + (x?.played ?? 0), 0), won: spider.reduce((t, x) => t + (x?.won ?? 0), 0) };
    let p = migrate(EMPTY_PROGRESS, old);
    // Credit achievements already earned by the imported totals, quietly.
    const earned = newlyEarned(p, this.slugs);
    p = { ...p, achievements: Object.fromEntries(earned.map((a) => [a.id, dayKey(new Date())])) };
    if (Object.keys(p.games).length) this.storage.set(KEY, p);
    return p;
  }
}
