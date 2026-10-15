import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { GameService } from '../../core/services/game.service';
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
      const faq = this.content()?.faq;
      if (faq?.length) {
        structuredData.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        });
      }
      this.seo.apply({
        title: g.available ? `${g.name} Online – Play Free Card Game Against AI | CardArena` : `${g.name} Card Game – Rules & How to Play | CardArena`,
        description: `${g.description} ${g.available ? 'Play free in your browser — no download required.' : 'Coming soon to CardArena.'}`,
        path,
        structuredData,
      });
    });
  }
}
