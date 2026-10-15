/**
 * Generates bot-vs-bot games with the TypeScript engine and writes them as a
 * fixture for the backend parity test (backend/tests/test_engine_parity.py).
 *
 *   npm run export-replays
 */
import { writeFileSync } from 'node:fs';
import { seededRng } from '../src/app/games/core/deck';
import { botsFor, chooseCard } from '../src/app/games/bhabhi-thulla/engine/bhabhi-thulla.bot';
import { BhabhiThullaEngine, SeatConfig } from '../src/app/games/bhabhi-thulla/engine/bhabhi-thulla.engine';
import { BhabhiVariant, createRules } from '../src/app/games/bhabhi-thulla/engine/bhabhi-thulla.rules';

const games = [];
const variants: BhabhiVariant[] = ['pakistan', 'india', 'custom'];
for (let i = 0; i < 36; i++) {
  const players = 3 + (i % 4);
  const variant = variants[i % 3];
  const seed = (i * 2654435761) >>> 0;
  const bots = botsFor(players, (['easy', 'normal', 'hard', 'expert'] as const)[i % 4]);
  const seats: SeatConfig[] = bots.map((b, n) => ({ id: n === 0 ? 'you' : b.id, name: b.name, avatar: b.avatar, isBot: n !== 0 }));
  const engine = new BhabhiThullaEngine(seats, { seed, rules: createRules(variant, players) });
  engine.initializeGame();
  const rng = seededRng(seed ^ 0x5bd1e995);
  while (!engine.isGameOver()) {
    const s = engine.getState();
    if (s.awaitingResolution) {
      engine.resolveTrick();
      continue;
    }
    const id = s.currentPlayerId!;
    const seat = s.players.findIndex((p) => p.id === id);
    engine.playCard(id, chooseCard(engine.getPlayerView(id), bots[seat], rng, engine.getValidMoves(id)).id);
  }
  const s = engine.getState();
  games.push({
    seed,
    variant,
    seats: seats.map((x) => ({ id: x.id, name: x.name, isBot: x.isBot })),
    moves: s.events.flatMap((e) => (e.type === 'play' ? [{ playerId: e.playerId, cardId: e.card.id }] : [])),
    finishOrder: s.finishOrder,
    bhabhiId: s.bhabhiId,
    tricks: s.trickNumber,
    scores: engine.calculateScore(),
  });
}
const out = process.argv[2] ?? '../backend/tests/fixtures/ts_replays.json';
writeFileSync(out, JSON.stringify(games, null, 1));
console.log(`Wrote ${games.length} games to ${out}`);
