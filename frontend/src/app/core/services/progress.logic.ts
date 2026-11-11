/**
 * Player progress kept on this device: games played and won per game, win streaks, a daily
 * play streak and achievements. Pure functions so they can be tested without Angular.
 */

/** How a finished game went for you. 'done' = finished without a win or loss (solo games, safe in Bhabhi). */
export type Outcome = 'win' | 'loss' | 'draw' | 'done';

export interface GameRecord {
  played: number;
  won: number;
  drawn: number;
  /** Wins in a row right now (a loss resets it; draws and solo finishes leave it alone). */
  streak: number;
  bestStreak: number;
  /** Local date (YYYY-MM-DD) of the last finished game. */
  last: string;
}

export interface Progress {
  games: Record<string, GameRecord>;
  /** Days in a row with at least one finished game. */
  days: { current: number; best: number; last: string };
  /** Achievement id → local date unlocked. */
  achievements: Record<string, string>;
}

export const EMPTY_PROGRESS: Progress = { games: {}, days: { current: 0, best: 0, last: '' }, achievements: {} };
const EMPTY_RECORD: GameRecord = { played: 0, won: 0, drawn: 0, streak: 0, bestStreak: 0, last: '' };

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayBefore(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** The daily streak as it stands today: it lapses once a whole day goes by without a game. */
export function liveDays(p: Progress, today: string): number {
  return p.days.last === today || p.days.last === dayBefore(today) ? p.days.current : 0;
}

/** Progress after finishing a game of `slug`. */
export function recordGame(p: Progress, slug: string, outcome: Outcome, today: string): Progress {
  const g = { ...EMPTY_RECORD, ...p.games[slug] };
  g.played++;
  if (outcome === 'win') {
    g.won++;
    g.streak++;
    g.bestStreak = Math.max(g.bestStreak, g.streak);
  } else if (outcome === 'loss') g.streak = 0;
  else if (outcome === 'draw') g.drawn++;
  g.last = today;

  let { current, best, last } = p.days;
  if (last !== today) {
    current = last === dayBefore(today) ? current + 1 : 1;
    last = today;
    best = Math.max(best, current);
  }
  return { ...p, games: { ...p.games, [slug]: g }, days: { current, best, last } };
}

export interface Totals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gamesPlayed: number;
  gamesWon: number;
  bestStreak: number;
}

export function totals(p: Progress): Totals {
  const list = Object.values(p.games);
  const played = list.reduce((t, g) => t + g.played, 0);
  const won = list.reduce((t, g) => t + g.won, 0);
  const drawn = list.reduce((t, g) => t + g.drawn, 0);
  return {
    played,
    won,
    drawn,
    lost: Math.max(0, played - won - drawn),
    gamesPlayed: list.filter((g) => g.played > 0).length,
    gamesWon: list.filter((g) => g.won > 0).length,
    bestStreak: list.reduce((t, g) => Math.max(t, g.bestStreak), 0),
  };
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** Earned from your totals; achievements without it are unlocked by a game directly. */
  earned?: (p: Progress, t: Totals, allGames: string[]) => boolean;
}

const SOLITAIRES = ['solitaire', 'spider-solitaire', 'tripeaks', 'pyramid-solitaire'];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-game', icon: '🎴', title: 'First deal', description: 'Finish your first game.', earned: (_, t) => t.played >= 1 },
  { id: 'first-win', icon: '🏅', title: 'First win', description: 'Win any game.', earned: (_, t) => t.won >= 1 },
  { id: 'wins-10', icon: '🥉', title: 'Winner', description: 'Win 10 games.', earned: (_, t) => t.won >= 10 },
  { id: 'wins-50', icon: '🥈', title: 'Champion', description: 'Win 50 games.', earned: (_, t) => t.won >= 50 },
  { id: 'wins-100', icon: '🥇', title: 'Legend', description: 'Win 100 games.', earned: (_, t) => t.won >= 100 },
  { id: 'played-25', icon: '🃏', title: 'Regular', description: 'Finish 25 games.', earned: (_, t) => t.played >= 25 },
  { id: 'played-100', icon: '💯', title: 'Centurion', description: 'Finish 100 games.', earned: (_, t) => t.played >= 100 },
  { id: 'streak-3', icon: '🔥', title: 'On fire', description: 'Win 3 games in a row in one game.', earned: (_, t) => t.bestStreak >= 3 },
  { id: 'streak-5', icon: '⚡', title: 'Unstoppable', description: 'Win 5 in a row in one game.', earned: (_, t) => t.bestStreak >= 5 },
  { id: 'streak-10', icon: '👑', title: 'Untouchable', description: 'Win 10 in a row in one game.', earned: (_, t) => t.bestStreak >= 10 },
  { id: 'days-3', icon: '📅', title: 'Habit', description: 'Play 3 days in a row.', earned: (p) => p.days.best >= 3 },
  { id: 'days-7', icon: '🗓️', title: 'Week warrior', description: 'Play 7 days in a row.', earned: (p) => p.days.best >= 7 },
  { id: 'days-30', icon: '🌟', title: 'Devoted', description: 'Play 30 days in a row.', earned: (p) => p.days.best >= 30 },
  { id: 'explorer', icon: '🧭', title: 'Explorer', description: 'Play 5 different games.', earned: (_, t) => t.gamesPlayed >= 5 },
  { id: 'all-rounder', icon: '🎯', title: 'All-rounder', description: 'Win 5 different games.', earned: (_, t) => t.gamesWon >= 5 },
  {
    id: 'globetrotter',
    icon: '🌍',
    title: 'Globetrotter',
    description: 'Play every game on CardArena.',
    earned: (p, _, all) => all.length > 0 && all.every((s) => (p.games[s]?.played ?? 0) > 0),
  },
  { id: 'patience', icon: '🧩', title: 'Patience', description: 'Win Solitaire, Spider, Tri Peaks and Pyramid.', earned: (p) => SOLITAIRES.every((s) => (p.games[s]?.won ?? 0) > 0) },
  { id: 'marathon', icon: '🏃', title: 'Marathon', description: 'Clear 3 boards in one Endless run of Tri Peaks or Pyramid.' },
  { id: 'yacht', icon: '🎲', title: 'Yacht!', description: 'Roll five of a kind in Yacht Dice.' },
  { id: 'big-turn', icon: '💰', title: 'High roller', description: 'Bank 2,000 points in one Farkle turn.' },
  { id: 'grandmaster', icon: '♛', title: 'Grandmaster', description: 'Beat the Expert computer at Checkers.' },
  { id: 'checkmate', icon: '♚', title: 'Checkmate!', description: 'Beat the Expert computer at Chess.' },
];

/** Achievements newly earned from totals (not yet in `p.achievements`). */
export function newlyEarned(p: Progress, allGames: string[]): Achievement[] {
  const t = totals(p);
  return ACHIEVEMENTS.filter((a) => a.earned && !p.achievements[a.id] && a.earned(p, t, allGames));
}

/** Seed from the per-game stats saved before progress tracking existed. */
export function migrate(p: Progress, old: Record<string, { played?: number; won?: number; drawn?: number } | undefined>): Progress {
  const games = { ...p.games };
  for (const [slug, s] of Object.entries(old)) {
    if (!s || games[slug] || !s.played) continue;
    games[slug] = { ...EMPTY_RECORD, played: s.played, won: s.won ?? 0, drawn: s.drawn ?? 0 };
  }
  return { ...p, games };
}
