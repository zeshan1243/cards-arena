import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { GameService } from '../../core/services/game.service';
import { GameInfo } from '../../shared/models/game.model';
import { SeoService } from '../../core/services/seo.service';
import { GameArt } from '../../shared/components/game-art/game-art';
import { GameCard } from '../../shared/components/game-card/game-card';
import { CORE_RULES, VARIANT_DESCRIPTIONS } from '../../games/bhabhi-thulla/engine/bhabhi-thulla.rules';
import { NotFoundPage } from '../not-found/not-found';

@Component({
  selector: 'app-game-detail',
  imports: [RouterLink, GameArt, GameCard, NotFoundPage],
  templateUrl: './game-detail.html',
  styleUrl: './game-detail.scss',
})
export class GameDetailPage {
  readonly accountsEnabled = environment.accountsEnabled;
  private readonly games = inject(GameService);
  private readonly seo = inject(SeoService);

  readonly slug = input.required<string>();
  readonly game = computed(() => this.games.bySlug(this.slug()));
  readonly content = computed(() => this.games.content(this.slug()));
  readonly related = computed(() => (this.game() ? this.games.related(this.game()!) : []));
  readonly isBhabhi = computed(() => this.slug() === 'bhabhi-thulla');
  readonly coreRules = CORE_RULES;
  readonly variants = Object.values(VARIANT_DESCRIPTIONS);

  constructor() {
    effect(() => {
      const g = this.game();
      if (!g) {
        this.seo.apply({ title: 'Game not found | CardArena', description: 'This game does not exist.', path: `/games/${this.slug()}`, noindex: true });
        return;
      }
      const path = `/games/${g.slug}`;
      const structuredData: object[] = [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${environment.siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Games', item: `${environment.siteUrl}/games` },
            { '@type': 'ListItem', position: 3, name: g.name, item: `${environment.siteUrl}${path}` },
          ],
        },
      ];
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: g.name,
        ...(g.aka ? { alternateName: g.aka } : {}),
        description: g.description,
        url: `${environment.siteUrl}${path}`,
        image: `${environment.siteUrl}/og/${g.slug}.jpg`,
        genre: 'Card game',
        gamePlatform: 'Web browser',
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        playMode: g.maxPlayers === 1 || g.botEnabled ? 'SinglePlayer' : 'MultiPlayer',
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: g.minPlayers, maxValue: g.maxPlayers },
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        publisher: { '@type': 'Organization', name: 'CardArena', url: `${environment.siteUrl}/` },
      });
      const faq = this.content()?.faq;
      if (faq?.length) {
        structuredData.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        });
      }
      this.seo.apply({ title: gameTitle(g), description: gameDescription(g), path, structuredData, image: `/og/${g.slug}.jpg` });
    });
  }
}

/** e.g. "Thirteen (Tiến Lên) Online – Play Free vs AI | CardArena"; one-player games drop "vs AI". */
function gameTitle(g: GameInfo): string {
  const label = /^\d+$/.test(g.name) ? `${g.name} Card Game` : g.aka ? `${g.name} (${g.aka})` : g.name;
  if (!g.available) return `${label} – Rules & How to Play | CardArena`;
  if (!g.botEnabled) return `${label} – Play Free Online | CardArena`;
  const card = g.aka || label !== g.name ? '' : ' Card Game';
  return `${label} Online – Play Free${card} vs AI | CardArena`;
}

/** Catalog blurb plus a call to action, kept within the ~158 characters Google shows. */
function gameDescription(g: GameInfo): string {
  const cta = g.available ? 'Play free in your browser — no download required.' : 'Coming soon to CardArena.';
  const full = `${g.description} ${cta}`;
  if (full.length <= 158) return full;
  if (g.description.length <= 158) return g.description;
  return g.description.slice(0, 155).replace(/\s+\S*$/, '') + '…';
}
