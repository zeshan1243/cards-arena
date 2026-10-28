import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink],
  template: `
    <section class="doc-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/">Home</a> / <span>About</span></nav>
        <h1>About CardArena</h1>
        <p class="lead">A free home for classic and regional card games — playable in your browser on any phone, tablet or computer.</p>
      </div>
    </section>
    <article class="container doc">
      <h2>What is CardArena?</h2>
      <p>
        CardArena brings together the card games people grew up playing with family and friends — from South Asian favourites
        like Bhabhi Thulla, Court Piece, 29, Call Break and Seep to worldwide classics like Hearts, Spades, Rummy and Solitaire.
        There is nothing to download and no account to create: open a game and start playing in seconds.
      </p>

      <h2>Our games</h2>
      <ul>
        @for (g of games; track g.slug) {
          <li><a [routerLink]="['/games', g.slug]">{{ g.name }}</a> — {{ g.tagline }}</li>
        }
      </ul>

      <h2>Smart opponents at every level</h2>
      <p>
        Every multiplayer game comes with AI opponents at four difficulty levels. Easy bots play loosely and are great for learning;
        Normal and Hard bots follow suit carefully, save their strong cards and remember what has been played; Expert bots count
        cards and plan ahead. Each game page explains the rules, the regional variations we support and strategy tips.
      </p>

      <h2>Free to play</h2>
      <p>
        CardArena is free and supported by advertising. We keep ads away from the cards while you play. CardArena is for
        entertainment only — there is no real-money gambling and nothing to buy.
      </p>

      <h2>Get in touch</h2>
      <p>
        Found a bug, play a rule differently, or want a game added? We would love to hear from you on our
        <a routerLink="/contact">contact page</a>. You can read how we handle data in our <a routerLink="/privacy">privacy policy</a>.
      </p>
    </article>
  `,
})
export class AboutPage {
  readonly games = inject(GameService).all.filter((g) => g.available);

  constructor() {
    inject(SeoService).apply({
      title: 'About CardArena – Free Online Card Games',
      description: 'CardArena is a free home for classic and regional card games — Bhabhi Thulla, Court Piece, 29, Hearts, Rummy, Solitaire and more — playable in your browser.',
      path: '/about',
    });
  }
}
