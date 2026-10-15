import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-multiplayer',
  imports: [RouterLink],
  template: `
    <section class="section container">
      <div class="hero panel">
        <span class="eyebrow">Coming soon</span>
        <h1>Multiplayer</h1>
        <p class="text-secondary">Private rooms with shareable codes, public matchmaking, chat and rematches are on the way. We’re making sure every rule
          and bot is rock solid first — then the server takes over as referee so every game is fair.</p>
        <div class="preview" aria-hidden="true">
          <div class="room panel">
            <h3>Invite friends</h3>
            <p class="text-secondary">Room code</p>
            <div class="code">AB72K</div>
            <div class="row"><span class="btn btn-ghost btn-sm">Copy link</span><span class="btn btn-cyan btn-sm">Share</span></div>
          </div>
        </div>
        <div class="cta">
          <a class="btn btn-primary btn-lg" routerLink="/play/bhabhi-thulla">Play vs AI now</a>
          <a class="btn btn-ghost btn-lg" routerLink="/register">Create account</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero { padding: clamp(24px, 5vw, 56px); text-align: center; p { max-width: 640px; margin-inline: auto; } }
    .preview { display: grid; place-items: center; margin: 28px 0; }
    .room { padding: 22px 28px; width: min(320px, 100%); }
    .code { font-family: var(--font-display); font-weight: 900; font-size: 2.4rem; letter-spacing: .3em; color: var(--color-secondary); margin: 4px 0 14px; }
    .row { display: flex; gap: 8px; justify-content: center; }
    .cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  `,
})
export class MultiplayerPage {
  constructor() {
    inject(SeoService).apply({ title: 'Multiplayer Card Games – Coming Soon | CardArena', description: 'Play Bhabhi Thulla and more with friends in private rooms. Coming soon to CardArena.', path: '/multiplayer' });
  }
}
