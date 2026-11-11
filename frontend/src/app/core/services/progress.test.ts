import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, liveDays, migrate, newlyEarned, recordGame, totals } from './progress.logic';

describe('Progress', () => {
  it('counts games, wins and win streaks per game', () => {
    let p = EMPTY_PROGRESS;
    for (const o of ['win', 'win', 'draw', 'win', 'loss', 'win'] as const) p = recordGame(p, 'war', o, '2026-11-10');
    expect(p.games['war']).toMatchObject({ played: 6, won: 4, drawn: 1, streak: 1, bestStreak: 3 });
    expect(totals(p)).toMatchObject({ played: 6, won: 4, drawn: 1, lost: 1, gamesPlayed: 1 });
  });

  it('keeps a daily streak across consecutive days, including month ends', () => {
    let p = EMPTY_PROGRESS;
    for (const d of ['2026-10-30', '2026-10-31', '2026-10-31', '2026-11-01']) p = recordGame(p, 'war', 'done', d);
    expect(p.days).toMatchObject({ current: 3, best: 3 });
    expect(liveDays(p, '2026-11-02')).toBe(3); // still alive the next day
    expect(liveDays(p, '2026-11-03')).toBe(0); // a whole day missed
    p = recordGame(p, 'war', 'done', '2026-11-05');
    expect(p.days).toMatchObject({ current: 1, best: 3 });
  });

  it('earns achievements from totals once', () => {
    let p = recordGame(EMPTY_PROGRESS, 'checkers', 'win', '2026-11-10');
    const ids = newlyEarned(p, ['checkers', 'war']).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-game', 'first-win']));
    expect(ids).not.toContain('globetrotter');
    p = { ...p, achievements: Object.fromEntries(ids.map((i) => [i, 'x'])) };
    p = recordGame(p, 'war', 'loss', '2026-11-10');
    expect(newlyEarned(p, ['checkers', 'war']).map((a) => a.id)).toEqual(['globetrotter']);
  });

  it('imports old per-game stats without overwriting', () => {
    const p = migrate(recordGame(EMPTY_PROGRESS, 'war', 'win', '2026-11-10'), { war: { played: 9, won: 5 }, tripeaks: { played: 4, won: 1 }, farkle: undefined });
    expect(p.games['war'].played).toBe(1);
    expect(p.games['tripeaks']).toMatchObject({ played: 4, won: 1 });
    expect(p.games['farkle']).toBeUndefined();
  });
});
