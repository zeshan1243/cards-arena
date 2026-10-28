import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

export const CONTACT_EMAIL = 'contact@cardsarena.world';

@Component({
  selector: 'app-contact-page',
  imports: [RouterLink],
  template: `
    <section class="doc-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/">Home</a> / <span>Contact</span></nav>
        <h1>Contact us</h1>
        <p class="lead">Questions, bug reports, rule suggestions or business enquiries — we read every message.</p>
      </div>
    </section>
    <article class="container doc">
      <div class="panel card">
        <span class="icon" aria-hidden="true">✉️</span>
        <div>
          <h2>Email</h2>
          <p><a [href]="'mailto:' + email">{{ email }}</a></p>
          <p class="note">We usually reply within a few days.</p>
        </div>
      </div>

      <h2>Quick links</h2>
      <ul>
        <li><a [href]="mail('Bug report')">Report a bug</a> — tell us the game, what happened and your device or browser.</li>
        <li><a [href]="mail('Rule suggestion')">Suggest a rule or variation</a> — card games are played many ways; tell us yours.</li>
        <li><a [href]="mail('Game request')">Request a new game</a></li>
        <li><a [href]="mail('Privacy request')">Privacy request</a> — see our <a routerLink="/privacy">privacy policy</a>.</li>
        <li><a [href]="mail('Business enquiry')">Advertising and partnerships</a></li>
      </ul>

      <h2>Before you write</h2>
      <p>
        Every game page has full rules, strategy tips and answers to common questions — have a look at the
        <a routerLink="/games">game pages</a> first; your answer may already be there.
      </p>
    </article>
  `,
  styles: `
    .card { display: flex; gap: 18px; align-items: flex-start; padding: 22px 24px; margin-top: 8px; }
    .card h2 { margin: 0 0 4px; }
    .card p { margin: 0; }
    .icon { font-size: 2rem; line-height: 1; }
    .note { font-size: .88rem; margin-top: 6px !important; }
  `,
})
export class ContactPage {
  readonly email = CONTACT_EMAIL;

  constructor() {
    inject(SeoService).apply({
      title: 'Contact CardArena',
      description: 'Contact CardArena: report a bug, suggest a rule or a new card game, make a privacy request or ask about advertising.',
      path: '/contact',
    });
  }

  mail(subject: string): string {
    return `mailto:${this.email}?subject=${encodeURIComponent(subject)}`;
  }
}
