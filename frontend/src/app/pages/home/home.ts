import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { SeoService } from '../../core/services/seo.service';
import { environment } from '../../../environments/environment';
import { GameCard } from '../../shared/components/game-card/game-card';
import { PlayingCard } from '../../shared/components/playing-card/playing-card';
import { Card } from '../../shared/models/card.model';
import { GameInfo } from '../../shared/models/game.model';

@Component({
  selector: 'app-home',
  imports: [RouterLink, GameCard, PlayingCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  readonly accountsEnabled = environment.accountsEnabled;
  private readonly games = inject(GameService);
  private readonly router = inject(Router);

  readonly featured = this.games.all.filter((g) => g.available).concat(this.games.query('regional', 'popular', '').filter((g) => !g.available).slice(0, 2));
  readonly gameCount = this.games.all.filter((g) => g.available).length;
  readonly popular = this.games.query('popular', 'most-played', '').slice(0, 4);
  readonly regional = this.games.byCategory('regional');

  readonly heroCards: Card[] = [
    { id: 'spades-A', suit: 'spades', rank: 'A' },
    { id: 'hearts-K', suit: 'hearts', rank: 'K' },
    { id: 'diamonds-Q', suit: 'diamonds', rank: 'Q' },
    { id: 'clubs-J', suit: 'clubs', rank: 'J' },
    { id: 'hearts-10', suit: 'hearts', rank: '10' },
  ];

  readonly features = [
    { icon: '🧠', title: 'Smart AI opponents', text: 'Bots that track voids, count cards and play to win — from relaxed to expert.' },
    { icon: '🌏', title: 'Regional favourites', text: 'Bhabhi Thulla, Court Piece, 29, Seep and Call Break — the games you grew up with.' },
    { icon: '📱', title: 'Made for mobile', text: 'Big touch targets and smooth animations on every screen from 320px up.' },
    { icon: '⚡', title: 'Instant play', text: 'No download, no install and no account needed to start a game.' },
    environment.accountsEnabled
      ? { icon: '🏆', title: 'Progress & stats', text: 'Earn XP, unlock achievements and climb the leaderboard with a free account.' }
      : { icon: '🎚️', title: 'Four difficulty levels', text: 'From easy-going Easy bots to card-counting Expert ones — pick your challenge.' },
    { icon: '🎯', title: 'Clear rules', text: 'Every regional variation is spelled out, so you always know which rules apply.' },
  ];

  constructor() {
    inject(SeoService).apply({
      title: 'Play Bhabhi Thulla, 29 & Solitaire Free Online | CardArena',
      description:
        'Free online card games: Bhabhi Thulla, Court Piece, 29, Call Break, Thirteen, Hearts, Spades and Solitaire. Play in your browser vs smart AI — no download.',
      path: '/',
    });
  }

  play(game: GameInfo): void {
    void this.router.navigate(game.available ? ['/play', game.slug] : ['/games', game.slug]);
  }
}
