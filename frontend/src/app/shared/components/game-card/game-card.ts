import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameInfo } from '../../models/game.model';
import { GameArt } from '../game-art/game-art';

@Component({
  selector: 'app-game-card',
  imports: [RouterLink, GameArt],
  template: `
    <article class="game-card" [style.--accent]="game().accent">
      <a class="art" [routerLink]="['/games', game().slug]" [attr.aria-label]="game().name + ' details'">
        <app-game-art [art]="game().art" [accent]="game().accent" [slug]="game().slug" />
        @if (!game().available) { <span class="soon">Coming soon</span> }
      </a>
      <div class="body">
        <h3><a [routerLink]="['/games', game().slug]">{{ game().name }}</a></h3>
        <p class="desc">{{ game().tagline }}</p>
        <div class="meta">
          <span class="chip">👥 {{ game().minPlayers === game().maxPlayers ? game().minPlayers : game().minPlayers + '–' + game().maxPlayers }} players</span>
          @if (game().botEnabled) { <span class="chip chip-cyan">🤖 AI</span> }
          @if (game().multiplayerEnabled) { <span class="chip chip-purple">🌐 Online</span> }
          <span class="chip">{{ game().region }}</span>
        </div>
        @if (game().available) {
          <button class="btn btn-primary btn-block" type="button" (click)="play.emit(game())">Play</button>
        } @else {
          <a class="btn btn-ghost btn-block" [routerLink]="['/games', game().slug]">Learn the rules</a>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .game-card {
      height: 100%; display: flex; flex-direction: column; overflow: hidden;
      border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border-color);
      box-shadow: var(--shadow-card); transition: transform var(--dur-med) var(--ease-out), box-shadow var(--dur-med), border-color var(--dur-med);
      &:hover { transform: translateY(-6px); border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 18px 40px rgba(0,0,0,.45), 0 0 30px color-mix(in srgb, var(--accent) 30%, transparent); }
    }
    .art { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; app-game-art { height: 100%; transition: transform var(--dur-slow) var(--ease-out); } }
    .game-card:hover .art app-game-art { transform: scale(1.05); }
    .soon { position: absolute; top: 12px; right: 12px; padding: 4px 10px; border-radius: 999px; background: rgba(11,16,32,.8); font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--color-warning); border: 1px solid rgba(245,158,11,.4); }
    .body { flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 18px; }
    h3 { margin: 0; font-size: 1.3rem; a { color: var(--text-primary); } }
    .desc { margin: 0; color: var(--text-secondary); font-size: .92rem; flex: 1; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class GameCard {
  readonly game = input.required<GameInfo>();
  readonly play = output<GameInfo>();
}
