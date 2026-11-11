import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAMES } from '../../core/data/games.data';
import { ProgressService } from '../../core/services/progress.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

/** Your games played and won, streaks and achievements, saved on this device. */
@Component({
  selector: 'app-progress-page',
  imports: [RouterLink],
  template: `
    <section class="section container">
      <span class="eyebrow">Your progress</span>
      <h1>My stats</h1>
      <p class="text-secondary lead">Every game you finish is tracked here, on this device — no account needed.</p>

      <div class="tiles">
        <div class="tile streak" [class.cold]="!svc.playedToday()">
          <span class="big">🔥 {{ svc.dayStreak() }}</span>
          <span class="lbl">Day streak</span>
          <small>{{ svc.playedToday() ? 'Played today ✓' : svc.dayStreak() ? 'Play today to keep it' : 'Finish a game to start one' }} · Best {{ p().days.best }}</small>
        </div>
        <div class="tile"><span class="big">{{ t().played }}</span><span class="lbl">Games played</span></div>
        <div class="tile"><span class="big">{{ t().won }}</span><span class="lbl">Wins</span><small>{{ t().lost }} lost · {{ t().drawn }} drawn</small></div>
        <div class="tile"><span class="big">{{ winRate(t().won, t().played) }}</span><span class="lbl">Win rate</span></div>
        <div class="tile"><span class="big">{{ t().bestStreak }}</span><span class="lbl">Best win streak</span></div>
        <div class="tile"><span class="big">{{ svc.unlockedCount() }}<em>/{{ svc.achievements.length }}</em></span><span class="lbl">Achievements</span></div>
      </div>

      <h2>Achievements</h2>
      <ul class="badges">
        @for (a of svc.achievements; track a.id) {
          @let on = p().achievements[a.id];
          <li class="badge" [class.locked]="!on">
            <span class="icon" aria-hidden="true">{{ on ? a.icon : '🔒' }}</span>
            <span><b>{{ a.title }}</b><small>{{ a.description }}</small></span>
          </li>
        }
      </ul>

      <h2>By game</h2>
      @if (played().length) {
        <div class="table-wrap">
          <table>
            <thead><tr><th>Game</th><th>Played</th><th>Won</th><th>Win %</th><th>Streak</th><th>Best</th><th></th></tr></thead>
            <tbody>
              @for (r of played(); track r.slug) {
                <tr>
                  <td><a [routerLink]="['/games', r.slug]" class="name"><i [style.background]="r.accent" aria-hidden="true">{{ r.art[0] }}</i>{{ r.name }}</a></td>
                  <td>{{ r.rec.played }}</td>
                  <td>{{ r.rec.won }}</td>
                  <td>{{ winRate(r.rec.won, r.rec.played) }}</td>
                  <td>@if (r.rec.streak > 1) { 🔥 }{{ r.rec.streak }}</td>
                  <td>{{ r.rec.bestStreak }}</td>
                  <td><a class="btn btn-ghost btn-sm" [routerLink]="['/play', r.slug]">Play</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-secondary">No games finished yet — pick one below.</p>
      }

      @if (unplayed().length) {
        <h3>Not played yet</h3>
        <div class="chips">
          @for (g of unplayed(); track g.slug) {
            <a class="chip-link" [routerLink]="['/games', g.slug]"><i [style.background]="g.accent" aria-hidden="true">{{ g.art[0] }}</i>{{ g.name }}</a>
          }
        </div>
      }

      @if (t().played) {
        <button class="btn btn-ghost reset" type="button" (click)="reset()">Reset my stats</button>
      }
    </section>
  `,
  styles: `
    .lead { margin: 4px 0 20px; }
    h2 { margin: 32px 0 12px; font-size: 1.3rem; }
    h3 { margin: 24px 0 10px; font-size: 1rem; color: var(--text-secondary); }
    .tiles { display: grid; gap: 12px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
    @media (max-width: 900px) { .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tile { display: grid; gap: 2px; align-content: start; padding: 16px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid var(--border-color);
      .big { font-family: var(--font-display); font-size: 2rem; font-weight: 800; line-height: 1.1; em { font-style: normal; font-size: 1rem; color: var(--text-secondary); } }
      .lbl { font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); }
      small { color: var(--text-muted, var(--text-secondary)); font-size: .78rem; } }
    .tile.streak { background: linear-gradient(135deg, rgba(249,115,22,.22), rgba(239,68,68,.12)); border-color: rgba(249,115,22,.45);
      .big { color: #fdba74; } }
    .tile.streak.cold { filter: saturate(.5); }
    @media (max-width: 560px) { .tile.streak { grid-column: 1 / -1; } .tile .big { font-size: 1.6rem; } }
    .badges { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); }
    .badge { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(250,204,21,.14), rgba(255,255,255,.03)); border: 1px solid rgba(250,204,21,.4);
      .icon { font-size: 1.8rem; width: 40px; text-align: center; flex-shrink: 0; }
      b { display: block; } small { color: var(--text-secondary); font-size: .8rem; } }
    @media (max-width: 560px) {
      .badges { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .badge { flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; .icon { width: auto; font-size: 1.5rem; } b { font-size: .9rem; } small { font-size: .74rem; line-height: 1.3; display: block; } }
    }
    .badge.locked { background: rgba(255,255,255,.02); border-color: var(--border-color); .icon { opacity: .5; font-size: 1.3rem; } b { color: var(--text-secondary); } }
    .table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid var(--border-color); }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    th { font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; }
    th:first-child, td:first-child { text-align: left; }
    tbody tr:last-child td { border-bottom: 0; }
    .name, .chip-link { display: inline-flex; align-items: center; gap: 10px; color: var(--text-primary); font-weight: 700; text-decoration: none !important;
      i { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; font-style: normal; font-size: .9rem; color: #fff; } }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip-link { padding: 6px 12px 6px 6px; border-radius: 999px; border: 1px solid var(--border-color); background: rgba(255,255,255,.03); font-size: .9rem; &:hover { background: rgba(255,255,255,.08); } }
    .reset { margin-top: 32px; }
    @media (max-width: 600px) { th, td { padding: 8px 6px; font-size: .85rem; } td:last-child, th:last-child { display: none; } }
  `,
})
export class ProgressPage {
  readonly svc = inject(ProgressService);
  private readonly toast = inject(ToastService);
  readonly p = this.svc.progress;
  readonly t = this.svc.totals;

  readonly played = computed(() =>
    GAMES.flatMap((g) => {
      const rec = this.p().games[g.slug];
      return rec?.played ? [{ slug: g.slug, name: g.name, accent: g.accent, art: g.art, rec }] : [];
    }).sort((a, b) => b.rec.played - a.rec.played),
  );
  readonly unplayed = computed(() => GAMES.filter((g) => !this.p().games[g.slug]?.played));

  constructor() {
    inject(SeoService).apply({ title: 'My stats | CardArena', description: 'Your CardArena games played and won, streaks and achievements.', path: '/progress', noindex: true });
  }

  winRate(won: number, played: number): string {
    return played ? `${Math.round((won / played) * 100)}%` : '–';
  }

  reset(): void {
    if (!confirm('Reset all your stats, streaks and achievements on this device?')) return;
    this.svc.reset();
    this.toast.info('Stats reset', 'Your progress starts fresh.');
  }
}
