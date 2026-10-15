import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { Loader } from '../../shared/components/loader/loader';
import { UserStatistics } from '../../shared/models/user.model';

@Component({
  selector: 'app-statistics',
  imports: [RouterLink, Loader, DecimalPipe],
  template: `
    <section class="section container">
      <span class="eyebrow">Your numbers</span>
      <h1>Statistics</h1>
      @if (error()) {
        <div class="empty-state panel"><p>{{ error() }}</p><button class="btn btn-ghost" type="button" (click)="load()">Retry</button></div>
      } @else if (data(); as d) {
        <div class="tiles">
          <div class="tile panel"><span>Games played</span><b>{{ d.totals.gamesPlayed }}</b></div>
          <div class="tile panel"><span>Won</span><b>{{ d.totals.gamesWon }}</b></div>
          <div class="tile panel"><span>Lost (Bhabhi)</span><b>{{ d.totals.gamesLost }}</b></div>
          <div class="tile panel"><span>Win rate</span><b>{{ d.totals.winRate | number: '1.0-1' }}%</b></div>
        </div>
        @for (g of d.games; track g.gameSlug) {
          <div class="panel game">
            <h2><a [routerLink]="['/games', g.gameSlug]">{{ g.gameName }}</a></h2>
            <div class="table-wrap">
              <table class="table">
                <tbody>
                  <tr><th scope="row">Games played</th><td class="num">{{ g.gamesPlayed }}</td></tr>
                  <tr><th scope="row">Games won</th><td class="num">{{ g.gamesWon }}</td></tr>
                  <tr><th scope="row">Games lost</th><td class="num">{{ g.gamesLost }}</td></tr>
                  <tr><th scope="row">Win rate</th><td class="num">{{ g.winRate | number: '1.0-1' }}%</td></tr>
                  <tr><th scope="row">Total score</th><td class="num">{{ g.totalScore }}</td></tr>
                  <tr><th scope="row">Best score</th><td class="num">{{ g.bestScore }}</td></tr>
                  <tr><th scope="row">Current win streak</th><td class="num">{{ g.currentWinStreak }}</td></tr>
                  <tr><th scope="row">Longest win streak</th><td class="num">{{ g.longestWinStreak }}</td></tr>
                  <tr><th scope="row">Average game time</th><td class="num">{{ duration(g.averageDurationSeconds) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        } @empty {
          <div class="empty-state panel"><div class="big">📊</div><p>Play a game to start building your statistics.</p><a class="btn btn-primary" routerLink="/play/bhabhi-thulla">Play Bhabhi Thulla</a></div>
        }
      } @else {
        <app-loader message="Loading statistics…" />
      }
    </section>
  `,
  styles: `
    .tiles { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); margin: 20px 0; @media (min-width: 700px) { grid-template-columns: repeat(4, 1fr); } }
    .tile { padding: 18px; display: grid; gap: 4px; span { color: var(--text-secondary); font-size: .82rem; } b { font-family: var(--font-display); font-size: 1.8rem; } }
    .game { padding: 22px; margin-bottom: 16px; h2 { font-size: 1.3rem; a { color: var(--text-primary); } } }
    .table th { text-transform: none; letter-spacing: 0; font-size: .92rem; font-weight: 500; }
  `,
})
export class StatisticsPage {
  private readonly stats = inject(StatisticsService);
  readonly data = signal<UserStatistics | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(SeoService).apply({ title: 'Statistics | CardArena', description: 'Your CardArena statistics.', path: '/statistics', noindex: true });
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.stats.myStatistics().subscribe({ next: (d) => this.data.set(d), error: (e: Error) => this.error.set(e.message) });
  }

  duration(s: number): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s % 60)}s`;
  }
}
