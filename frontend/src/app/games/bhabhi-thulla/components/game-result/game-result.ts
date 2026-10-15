import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { FinishSessionResponse } from '../../../../shared/models/user.model';
import { PlayerOutcome, StandingRow } from '../../bhabhi-thulla.store';
import { Scoreboard } from '../scoreboard/scoreboard';

const COPY: Record<PlayerOutcome, { emoji: string; title: string; sub: string }> = {
  win: { emoji: '🎉', title: 'You win!', sub: 'First to empty your hand. Brilliant play.' },
  safe: { emoji: '😮‍💨', title: 'You’re safe!', sub: 'You escaped before the end — not the Bhabhi this time.' },
  draw: { emoji: '🤝', title: 'Close call!', sub: 'Everyone escaped together — no Bhabhi this game.' },
  loss: { emoji: '🙈', title: 'You’re the Bhabhi!', sub: 'Last one holding cards. Shake it off and go again.' },
};

@Component({
  selector: 'app-bt-game-result',
  imports: [RouterLink, Scoreboard],
  template: `
    <div class="result" [class]="'result ' + outcome()">
      <div class="emoji" aria-hidden="true">{{ copy().emoji }}</div>
      <h2>{{ copy().title }}</h2>
      <p class="sub">{{ copy().sub }}</p>

      @if (loggedIn()) {
        <div class="xp">
          @if (saving()) {
            <span class="text-secondary">Saving result…</span>
          } @else if (finish(); as f) {
            <span class="xp-amount">+{{ f.xpAwarded }} XP</span>
            <span class="text-secondary">Level {{ f.level }}{{ f.leveledUp ? ' — level up!' : '' }}</span>
          }
        </div>
      }
      <p class="score">Score: <b>{{ myScore() }}</b></p>

      <app-bt-scoreboard [rows]="standings()" />

      @if (accountsEnabled && !loggedIn()) {
        <div class="guest">
          <p>Create a free account to save your statistics, earn XP and unlock achievements.</p>
          <a class="btn btn-cyan btn-block" routerLink="/register">Create account</a>
        </div>
      }

      <div class="actions">
        <button class="btn btn-primary btn-lg btn-block" type="button" (click)="playAgain.emit()" autofocus>Play again</button>
        <a class="btn btn-ghost btn-block" routerLink="/games">Back to games</a>
      </div>
    </div>
  `,
  styles: `
    .result { text-align: center; }
    .emoji { font-size: clamp(2.4rem, 7vh, 3.5rem); animation: bounce .8s var(--ease-out); }
    h2 { margin: 6px 0 4px; font-size: clamp(1.8rem, 4vw, 2.4rem); }
    .win h2 { background: linear-gradient(90deg, #fde68a, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .loss h2 { color: #fca5a5; }
    .sub { color: var(--text-secondary); margin-bottom: 14px; }
    .xp { display: grid; gap: 2px; margin-bottom: 8px; }
    .xp-amount { font-family: var(--font-display); font-weight: 900; font-size: 1.8rem; color: var(--color-secondary); }
    .score { margin-bottom: 12px; }
    @media (max-height: 900px) { .sub { margin-bottom: 8px; } app-bt-scoreboard { margin-bottom: 12px; } .guest { padding: 10px; margin-bottom: 12px; p { margin-bottom: 8px; } } }
    app-bt-scoreboard { display: block; text-align: left; margin-bottom: 18px; }
    .guest { padding: 14px; border-radius: var(--radius-md); background: rgba(0,212,255,.07); border: 1px solid rgba(0,212,255,.25); margin-bottom: 16px; p { font-size: .9rem; margin-bottom: 10px; } }
    .actions { display: grid; gap: 10px; }
    @keyframes bounce { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: none; } }
  `,
})
export class GameResult {
  readonly outcome = input.required<PlayerOutcome>();
  readonly standings = input.required<StandingRow[]>();
  readonly loggedIn = input(false);
  readonly accountsEnabled = environment.accountsEnabled;
  readonly finish = input<FinishSessionResponse | null>(null);
  readonly saving = input(false);
  readonly playAgain = output<void>();

  readonly copy = computed(() => COPY[this.outcome()]);
  readonly myScore = computed(() => this.standings().find((r) => r.isYou)?.score ?? 0);
}
