import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameFilter, GameService, GameSort } from '../../core/services/game.service';
import { SeoService } from '../../core/services/seo.service';
import { GameCard } from '../../shared/components/game-card/game-card';
import { GameInfo } from '../../shared/models/game.model';

@Component({
  selector: 'app-games',
  imports: [GameCard],
  template: `
    <section class="section">
      <div class="container">
        <span class="eyebrow">Games catalog</span>
        <h1>All card games</h1>
        <p class="text-secondary intro">Regional favourites and timeless classics. Bhabhi Thulla is live now — more tables are opening soon.</p>

        <div class="toolbar">
          <input class="input search" type="search" placeholder="Search games..." aria-label="Search games" [value]="search()" (input)="search.set($any($event.target).value)" />
          <div class="segmented" role="group" aria-label="Filter games">
            @for (f of filters; track f.value) {
              <button type="button" [attr.aria-pressed]="filter() === f.value" (click)="filter.set(f.value)">{{ f.label }}</button>
            }
          </div>
          <label class="sort">
            <span class="sr-only">Sort by</span>
            <select class="input" [value]="sort()" (change)="sort.set($any($event.target).value)" aria-label="Sort games">
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="az">A–Z</option>
              <option value="most-played">Most played</option>
            </select>
          </label>
        </div>

        <p class="count" aria-live="polite">{{ results().length }} {{ results().length === 1 ? 'game' : 'games' }}</p>
        <div class="grid">
          @for (g of results(); track g.slug) {
            <app-game-card [game]="g" (play)="play($event)" />
          } @empty {
            <div class="empty-state"><div class="big">🃏</div><p>No games match “{{ search() }}”.</p></div>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .intro { max-width: 640px; margin-bottom: 28px; }
    .toolbar { display: grid; gap: 12px; margin-bottom: 18px; @media (min-width: 1000px) { grid-template-columns: 1fr auto 180px; align-items: center; } }
    .segmented { overflow-x: auto; flex-wrap: nowrap; @media (min-width: 1000px) { flex-wrap: wrap; } }
    .count { color: var(--text-secondary); font-size: .9rem; }
    .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
    .empty-state { grid-column: 1 / -1; }
  `,
})
export class GamesPage {
  private readonly games = inject(GameService);
  private readonly router = inject(Router);

  readonly filter = signal<GameFilter>('all');
  readonly sort = signal<GameSort>('popular');
  readonly search = signal('');
  readonly results = computed(() => this.games.query(this.filter(), this.sort(), this.search()));

  readonly filters: { value: GameFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'popular', label: 'Popular' },
    { value: 'regional', label: 'Regional' },
    { value: 'multiplayer', label: 'Multiplayer' },
    { value: 'single', label: 'Single player' },
    { value: 'classic', label: 'Classic' },
  ];

  constructor() {
    inject(SeoService).apply({
      title: 'All Card Games – Play Free Online | CardArena',
      description: 'Browse free online card games: Bhabhi Thulla, Court Piece, 29, Seep, Call Break, Hokm, Tarneeb, Baloot, Spades and Hearts.',
      path: '/games',
    });
  }

  play(game: GameInfo): void {
    void this.router.navigate(['/play', game.slug]);
  }
}
