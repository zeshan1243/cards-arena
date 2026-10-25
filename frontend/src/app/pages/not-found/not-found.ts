import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section container nf">
      <div class="big" aria-hidden="true">🃏</div>
      <h1>Page not found</h1>
      <p class="text-secondary">That card isn’t in this deck.</p>
      <div class="cta"><a class="btn btn-primary" routerLink="/">Go home</a><a class="btn btn-ghost" routerLink="/games">Browse games</a></div>
    </section>
  `,
  styles: `.nf { text-align: center; } .big { font-size: 4rem; } .cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }`,
})
export class NotFoundPage {
  constructor() {
    inject(SeoService).apply({
      title: 'Page not found | CardArena',
      description: 'This page does not exist. Browse free online card games on CardArena.',
      path: inject(Router).url.split('?')[0],
      noindex: true,
    });
  }
}
