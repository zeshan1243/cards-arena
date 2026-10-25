import { RenderMode, ServerRoute } from '@angular/ssr';
import { GAMES } from './core/data/games.data';

/**
 * Public, indexable pages are prerendered to static HTML at build time so crawlers and
 * link previews get real titles, content and structured data. Everything else (game
 * tables, account pages) renders in the browser.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'games', renderMode: RenderMode.Prerender },
  {
    path: 'games/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => GAMES.map((g) => ({ slug: g.slug })),
  },
  { path: '**', renderMode: RenderMode.Client },
];
