import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SMARTLINK_URL } from '../../../core/services/ads.service';
import { GameService } from '../../../core/services/game.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container grid">
        <div class="brand">
          <a routerLink="/" class="logo">CARD<b>ARENA</b></a>
          <p class="text-secondary">A modern home for classic and regional card games. Free to play, no download required.</p>
        </div>
        <nav aria-label="Regional games">
          <h2 class="col-title">Regional games</h2>
          @for (g of regional; track g.slug) {
            <a [routerLink]="['/games', g.slug]">{{ g.name }}</a>
          }
        </nav>
        <nav aria-label="Classic games">
          <h2 class="col-title">Classic games</h2>
          @for (g of classic; track g.slug) {
            <a [routerLink]="['/games', g.slug]">{{ g.name }}</a>
          }
        </nav>
        <nav aria-label="CardArena">
          <h2 class="col-title">CardArena</h2>
          <a routerLink="/games">All games</a>
          @if (accountsEnabled) {
            <a routerLink="/leaderboard">Leaderboard</a>
            <a routerLink="/multiplayer">Multiplayer</a>
          }
          <a routerLink="/settings">Settings</a>
          <a [href]="smartlink" target="_blank" rel="sponsored noopener noreferrer">Sponsored</a>
        </nav>
      </div>
      <div class="container bottom">
        <span>© {{ year }} CardArena. Free-to-play entertainment — no real-money gambling.</span>
      </div>
    </footer>
  `,
  styles: `
    .footer { margin-top: 64px; border-top: 1px solid var(--border-color); background: rgba(0,0,0,0.2); padding-top: 48px; }
    .grid { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; @media (min-width: 900px) { grid-template-columns: 2fr 1fr 1fr 1fr; } }
    .brand { grid-column: 1 / -1; @media (min-width: 900px) { grid-column: auto; } p { max-width: 340px; margin-top: 12px; font-size: 0.9rem; } }
    .logo { font-family: var(--font-display); letter-spacing: .06em; color: var(--text-primary); font-size: 1.15rem; b { color: var(--color-secondary); } }
    nav { display: grid; gap: 8px; align-content: start; }
    .col-title { font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px; }
    nav a { color: var(--text-primary); opacity: .85; font-size: .92rem; &:hover { opacity: 1; } }
    .bottom { padding-block: 24px; margin-top: 36px; border-top: 1px solid var(--border-color); font-size: .82rem; color: var(--text-muted); }
  `,
})
export class Footer {
  readonly accountsEnabled = environment.accountsEnabled;
  readonly smartlink = SMARTLINK_URL;
  private readonly games = inject(GameService);
  readonly regional = this.games.byCategory('regional').slice(0, 6);
  readonly classic = this.games.byCategory('classic');
  readonly year = new Date().getFullYear();
}
