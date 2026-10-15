import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
export class NotFoundPage {}
