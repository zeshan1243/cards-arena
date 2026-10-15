import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { Loader } from '../../shared/components/loader/loader';
import { PlayerAvatar } from '../../shared/components/player-avatar/player-avatar';
import { LeaderboardEntry } from '../../shared/models/user.model';

type Period = 'daily' | 'weekly' | 'monthly' | 'all';

@Component({
  selector: 'app-leaderboard',
  imports: [RouterLink, Loader, PlayerAvatar, DecimalPipe],
  template: `
    <section class="section container">
      <span class="eyebrow">Compete</span>
      <h1>Global leaderboard</h1>
      <div class="segmented" role="group" aria-label="Time period">
        @for (p of periods; track p.value) {
          <button type="button" [attr.aria-pressed]="period() === p.value" (click)="period.set(p.value)">{{ p.label }}</button>
        }
      </div>
      <p class="text-secondary note">{{ period() === 'all' ? 'Ranked by total XP.' : 'Ranked by XP earned in this period.' }}</p>

      @if (error()) {
        <div class="empty-state panel"><p>{{ error() }}</p><button class="btn btn-ghost" type="button" (click)="load()">Retry</button></div>
      } @else if (rows(); as list) {
        @if (list.length) {
          <ol class="board">
            @for (r of list; track r.username) {
              <li class="panel" [class.me]="r.username === auth.user()?.username" [class.top]="r.rank <= 3">
                <span class="rank">{{ r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank }}</span>
                <app-player-avatar [name]="r.username" [avatar]="r.avatarUrl" size="sm" />
                <a class="name" [routerLink]="['/profile']" [queryParams]="{ u: r.username }">{{ r.username }}</a>
                <span class="lvl hide-sm">Lvl {{ r.level }}</span>
                <span class="wins hide-sm">{{ r.gamesWon }} wins</span>
                <b class="xp">{{ r.xp | number }} XP</b>
              </li>
            }
          </ol>
        } @else {
          <div class="empty-state panel"><div class="big">🏆</div><p>No ranked players yet for this period. Be the first!</p><a class="btn btn-primary" routerLink="/play/bhabhi-thulla">Play now</a></div>
        }
      } @else {
        <app-loader message="Loading leaderboard…" />
      }
    </section>
  `,
  styles: `
    .segmented { margin: 12px 0 8px; }
    .note { font-size: .88rem; }
    .board { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 8px; }
    li { display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-radius: var(--radius-md); }
    li.top { border-color: rgba(245,158,11,.35); }
    li.me { border-color: rgba(0,212,255,.6); box-shadow: var(--shadow-glow-cyan); }
    .rank { width: 40px; font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; text-align: center; }
    .name { flex: 1; font-weight: 700; color: var(--text-primary); }
    .lvl, .wins { color: var(--text-secondary); font-size: .88rem; }
    .xp { font-family: var(--font-display); font-variant-numeric: tabular-nums; }
    .hide-sm { @media (max-width: 600px) { display: none; } }
  `,
})
export class LeaderboardPage {
  private readonly stats = inject(StatisticsService);
  readonly auth = inject(AuthService);
  readonly period = signal<Period>('all');
  readonly rows = signal<LeaderboardEntry[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly periods: { value: Period; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'all', label: 'All time' },
  ];

  constructor() {
    inject(SeoService).apply({ title: 'Leaderboard | CardArena', description: 'Top CardArena players by XP.', path: '/leaderboard' });
    effect(() => {
      this.period();
      this.load();
    });
  }

  load(): void {
    this.rows.set(null);
    this.error.set(null);
    this.stats.leaderboard(this.period()).subscribe({ next: (r) => this.rows.set(r), error: (e: Error) => this.error.set(e.message) });
  }
}
