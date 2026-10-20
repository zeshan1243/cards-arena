import { Injectable } from '@angular/core';
import { GAMES, GAME_CONTENT, GameContent, findGame } from '../data/games.data';
import { GameCategory, GameInfo } from '../../shared/models/game.model';

export type GameFilter = 'all' | 'popular' | 'regional' | 'multiplayer' | 'single' | 'classic';
export type GameSort = 'popular' | 'newest' | 'az' | 'most-played';

/** Game catalog. Static for SEO and instant rendering; mirrors GET /api/v1/games. */
@Injectable({ providedIn: 'root' })
export class GameService {
  readonly all = GAMES;

  bySlug(slug: string): GameInfo | undefined {
    return findGame(slug);
  }

  content(slug: string): GameContent | undefined {
    return GAME_CONTENT[slug];
  }

  related(game: GameInfo): GameInfo[] {
    return game.related.map((s) => findGame(s)).filter((g): g is GameInfo => !!g);
  }

  byCategory(category: GameCategory): GameInfo[] {
    return GAMES.filter((g) => g.categories.includes(category));
  }

  query(filter: GameFilter, sort: GameSort, search: string): GameInfo[] {
    const q = search.trim().toLowerCase();
    const filtered = GAMES.filter((g) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'multiplayer' && g.multiplayerEnabled) ||
        (filter === 'single' && (g.botEnabled || g.maxPlayers === 1)) ||
        (filter !== 'multiplayer' && filter !== 'single' && g.categories.includes(filter));
      const matchesSearch = !q || [g.name, g.description, g.region, g.tagline].some((s) => s.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
    const sorters: Record<GameSort, (a: GameInfo, b: GameInfo) => number> = {
      popular: (a, b) => Number(b.available) - Number(a.available) || b.popularity - a.popularity,
      'most-played': (a, b) => b.popularity - a.popularity,
      newest: (a, b) => b.releasedAt.localeCompare(a.releasedAt),
      az: (a, b) => a.name.localeCompare(b.name),
    };
    return filtered.sort(sorters[sort]);
  }
}
