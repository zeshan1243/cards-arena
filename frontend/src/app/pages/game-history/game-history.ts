import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { Loader } from '../../shared/components/loader/loader';
import { GameHistoryEntry } from '../../shared/models/user.model';

@Component({
  selector: 'app-game-history',
  imports: [RouterLink, Loader, DatePipe, DecimalPipe],
  template: `
    <section class="section container">
      <span class="eyebrow">Recent games</span>
      <h1>Game history</h1>
      @if (error()) {
        <div class="empty-state panel"><p>{{ error() }}</p><button class="btn btn-ghost" type="button" (click)="load()">Retry</button></div>
      } @else if (entries(); as list) {
        @if (list.length) {
          <div class="panel table-wrap">
            <table class="table">
              <thead><tr><th>Game</th><th>Result</th><th class="hide-sm">Players</th><th class="num">Score</th><th class="num hide-sm">Duration</th><th class="num">Date</th></tr></thead>
              <tbody>
                @for (e of list; track e.sessionId) {
                  <tr>
                    <td><a [routerLink]="['/games', e.gameSlug]">{{ e.gameName }}</a><small class="mode">{{ e.mode === 'ai' ? 'vs AI' : e.mode }}</small></td>
                    <td><span class="chip" [class.chip-green]="e.result === 'win'" [class.chip-cyan]="e.result === 'safe'" [class.lost]="e.result === 'loss'">{{ label(e.result, e.position) }}</span></td>
                    <td class="hide-sm players">{{ names(e) }}</td>
                    <td class="num">{{ e.score > 0 ? '+' : '' }}{{ e.score }}</td>
                    <td class="num hide-sm">{{ e.durationSeconds ? (e.durationSeconds / 60 | number: '1.0-0') + 'm' : '—' }}</td>
                    <td class="num">{{ e.finishedAt | date: 'MMM d, HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state panel"><div class="big">🕹️</div><p>No finished games yet.</p><a class="btn btn-primary" routerLink="/play/bhabhi-thulla">Play now</a></div>
        }
      } @else {
        <app-loader message="Loading history…" />
      }
    </section>
  `,
  styles: `
    .table-wrap { overflow-x: auto; margin-top: 20px; }
    .mode { display: block; color: var(--text-secondary); font-size: .75rem; }
    .players { color: var(--text-secondary); font-size: .88rem; }
    .lost { color: #fca5a5; border-color: rgba(239,68,68,.4); background: rgba(239,68,68,.1); }
    .hide-sm { @media (max-width: 640px) { display: none; } }
  `,
})
export class GameHistoryPage {
  private readonly stats = inject(StatisticsService);
  readonly entries = signal<GameHistoryEntry[] | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(SeoService).apply({ title: 'Game history | CardArena', description: 'Your recent CardArena games.', path: '/history', noindex: true });
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.stats.history(50).subscribe({ next: (d) => this.entries.set(d), error: (e: Error) => this.error.set(e.message) });
  }

  label(result: string, position: number | null): string {
    if (result === 'win') return '🥇 Won';
    if (result === 'loss') return '💀 Bhabhi';
    return position ? `Safe #${position}` : 'Safe';
  }

  names(e: GameHistoryEntry): string {
    return e.players.map((p) => p.name).join(', ');
  }
}
