import { seededRng } from './deck';
import { GameDefinition, GameSettings, SeatConfig, TableGameEngine, TableView } from './table-game';
import { Difficulty } from '../../shared/models/game.model';

export function testSeats(n: number): SeatConfig[] {
  return Array.from({ length: n }, (_, i) => ({ id: i === 0 ? 'you' : `bot-${i}`, name: i === 0 ? 'You' : `Bot ${i}`, avatar: '', isBot: i !== 0 }));
}

/**
 * Play a whole game with bots in every seat (including seat 0).
 * Asserts the engine never offers an empty action list to the player on turn.
 */
export function playThrough<V extends TableView>(
  def: GameDefinition<V>,
  seed: number,
  opts: { players?: number; settings?: GameSettings; difficulty?: Difficulty; maxSteps?: number } = {},
): { engine: TableGameEngine<V>; steps: number } {
  const players = opts.players ?? def.playerCounts[0];
  const settings: GameSettings = { ...Object.fromEntries(def.setupOptions.map((o) => [o.key, o.default])), ...opts.settings };
  const engine = def.create(testSeats(players), seed, settings);
  engine.initializeGame();
  const rng = seededRng(seed ^ 0x9e3779b9);
  const profile = { difficulty: opts.difficulty ?? 'hard', personality: 'strategic' } as const;
  let steps = 0;
  const max = opts.maxSteps ?? 20000;
  while (!engine.isGameOver()) {
    if (++steps > max) throw new Error(`Game did not finish in ${max} steps`);
    if (engine.pending()) {
      engine.resolve();
      continue;
    }
    const id = engine.currentPlayerId();
    if (!id) throw new Error('No current player, nothing pending, and game not over');
    const legal = engine.legalActions(id);
    const selection = engine.cardSelection(id);
    if (!legal.length && !selection) throw new Error(`No legal actions for ${id} in phase ${engine.getView(id).phase}`);
    engine.apply(id, def.bot(engine.getView(id), legal, selection, profile, rng));
  }
  return { engine, steps };
}
