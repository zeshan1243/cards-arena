import { GameDefinition, GameSettings } from './table-game';
import { playThrough, testSeats } from './testing';

export interface ReplayFixture {
  slug: string;
  seed: number;
  settings: GameSettings;
  seats: { id: string; name: string; isBot: boolean }[];
  actions: { playerId: string; action: Record<string, unknown> }[];
  outcome: { id: string; position: number; result: string; score: number }[];
}

/** Bot-vs-bot games for the backend parity test (see scripts/export-replays.mjs). */
export function exportReplays(def: GameDefinition, count = 24): ReplayFixture[] {
  const out: ReplayFixture[] = [];
  for (let i = 0; i < count; i++) {
    const players = def.playerCounts[i % def.playerCounts.length];
    // Mixed-radix walk so every combination of options gets exercised.
    let rest = i;
    const settings: GameSettings = {};
    for (const o of def.setupOptions) {
      settings[o.key] = o.choices[rest % o.choices.length].value;
      rest = Math.floor(rest / o.choices.length);
    }
    const seed = (i * 2654435761 + 12345) >>> 0;
    const difficulty = (['easy', 'normal', 'hard', 'expert'] as const)[i % 4];
    const { engine } = playThrough(def, seed, { players, settings, difficulty });
    out.push({
      slug: def.slug,
      seed,
      settings,
      seats: testSeats(players).map((s) => ({ id: s.id, name: s.name, isBot: s.isBot })),
      actions: engine.actionLog().map((l) => ({ playerId: l.playerId, action: { ...l.action } })),
      outcome: engine.outcome().players,
    });
  }
  return out;
}
