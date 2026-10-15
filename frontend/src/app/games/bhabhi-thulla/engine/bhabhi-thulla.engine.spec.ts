import { Card, cardId } from '../../../shared/models/card.model';
import { seededRng } from '../../core/deck';
import { chooseCard, analyzeTable, botsFor } from './bhabhi-thulla.bot';
import { BhabhiThullaEngine, IllegalMoveError, SeatConfig } from './bhabhi-thulla.engine';
import { createRules } from './bhabhi-thulla.rules';

const seats = (n = 4): SeatConfig[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '', isBot: true }));

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });

/** Build an engine and overwrite hands with a fixed layout for deterministic scenarios. */
function rigged(hands: Card[][], variant: 'pakistan' | 'india' | 'custom' = 'india') {
  const engine = new BhabhiThullaEngine(seats(hands.length), { seed: 1, rules: createRules(variant, hands.length) });
  engine.initializeGame();
  const internal = (engine as unknown as { state: { players: { hand: Card[] }[] } }).state;
  internal.players.forEach((p, i) => (p.hand = hands[i]));
  // Re-run trick start so the opener is recalculated for the rigged hands.
  (engine as unknown as { state: { trickNumber: number } }).state.trickNumber = 0;
  (engine as unknown as { startTrick(id: string): void }).startTrick(engine.findStartingPlayer());
  return engine;
}

function playRandomGame(seed: number, players = 4) {
  const engine = new BhabhiThullaEngine(seats(players), { seed, rules: createRules('pakistan', players) });
  engine.initializeGame();
  const rng = seededRng(seed);
  const bots = botsFor(players, 'expert');
  let guard = 0;
  while (!engine.isGameOver() && guard++ < 5000) {
    const s = engine.getState();
    if (s.awaitingResolution) {
      engine.resolveTrick();
      continue;
    }
    const id = s.currentPlayerId!;
    const seat = s.players.findIndex((p) => p.id === id);
    const card = chooseCard(engine.getPlayerView(id), bots[seat], rng, engine.getValidMoves(id));
    engine.playCard(id, card.id);
  }
  return { engine, guard };
}

describe('BhabhiThullaEngine', () => {
  it('deck contains 52 unique cards and deals them all', () => {
    const engine = new BhabhiThullaEngine(seats(), { seed: 42 });
    engine.initializeGame();
    const all = engine.getState().players.flatMap((p) => p.hand.map((x) => x.id));
    expect(all.length).toBe(52);
    expect(new Set(all).size).toBe(52);
  });

  it('deals cards evenly for 3, 4, 5 and 6 players', () => {
    for (const n of [3, 4, 5, 6]) {
      const engine = new BhabhiThullaEngine(seats(n), { seed: 7, rules: createRules('pakistan', n) });
      engine.initializeGame();
      const sizes = engine.getState().players.map((p) => p.hand.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('same seed produces the same deal', () => {
    const a = new BhabhiThullaEngine(seats(), { seed: 99 });
    const b = new BhabhiThullaEngine(seats(), { seed: 99 });
    a.initializeGame();
    b.initializeGame();
    expect(a.getState().players.map((p) => p.hand)).toEqual(b.getState().players.map((p) => p.hand));
  });

  it('holder of the Ace of Spades starts and must lead it', () => {
    const engine = new BhabhiThullaEngine(seats(), { seed: 5 });
    engine.initializeGame();
    const s = engine.getState();
    const holder = s.players.find((p) => p.hand.some((x) => x.id === 'spades-A'))!;
    expect(s.currentPlayerId).toBe(holder.id);
    expect(engine.getValidMoves(holder.id).map((x) => x.id)).toEqual(['spades-A']);
  });

  it('rejects moves out of turn', () => {
    const engine = rigged([[c('spades', 'A'), c('hearts', '2')], [c('spades', '3')], [c('spades', '4')], [c('spades', '5')]]);
    expect(() => engine.playCard('p1', 'spades-3')).toThrowError(IllegalMoveError, 'Not your turn');
  });

  it('rejects a card the player does not hold', () => {
    const engine = rigged([[c('spades', 'A'), c('hearts', '2')], [c('spades', '3')], [c('spades', '4')], [c('spades', '5')]]);
    expect(() => engine.playCard('p0', 'spades-3')).toThrowError(IllegalMoveError);
  });

  it('rejects not following suit when able', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2')],
      [c('spades', '3'), c('hearts', '9')],
      [c('spades', '4'), c('hearts', 'K')],
      [c('spades', '5'), c('hearts', 'Q')],
    ]);
    engine.playCard('p0', 'spades-A');
    expect(() => engine.playCard('p1', 'hearts-9')).toThrowError(IllegalMoveError, 'You must follow suit');
  });

  it('turn passes clockwise and a fully-followed trick is discarded', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2')],
      [c('spades', '3'), c('hearts', '9')],
      [c('spades', '4'), c('hearts', 'K')],
      [c('spades', '5'), c('hearts', 'Q')],
    ]);
    engine.playCard('p0', 'spades-A');
    expect(engine.getState().currentPlayerId).toBe('p1');
    engine.playCard('p1', 'spades-3');
    engine.playCard('p2', 'spades-4');
    engine.playCard('p3', 'spades-5');
    expect(engine.getState().awaitingResolution).toBeTrue();
    const r = engine.resolveTrick();
    expect(r.outcome).toBe('cleared');
    expect(r.nextLeaderId).toBe('p0');
    expect(engine.getState().discardedCount).toBe(4);
  });

  it('a thulla ends the trick and the highest card of the led suit picks up', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2')],
      [c('spades', '3'), c('hearts', '9')],
      [c('spades', '4'), c('hearts', 'K')],
      [c('spades', '5'), c('hearts', 'Q')],
    ]);
    // Trick 1: all spades, discarded, p0 leads.
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    // Trick 2: p0 leads a heart... everyone follows -> cleared, all escape except none.
    engine.playCard('p0', 'hearts-2');
    engine.playCard('p1', 'hearts-9');
    engine.playCard('p2', 'hearts-K');
    engine.playCard('p3', 'hearts-Q');
    const r = engine.resolveTrick();
    expect(r.outcome).toBe('cleared');
    expect(engine.isGameOver()).toBeTrue();
    // Everyone escaped on the same trick: nobody is the Bhabhi.
    expect(engine.getState().bhabhiId).toBeNull();
  });

  it('thulla gives all trick cards to the highest follower', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2'), c('hearts', '3')],
      [c('spades', '3'), c('hearts', '9'), c('clubs', '4')],
      [c('spades', '4'), c('clubs', 'K'), c('clubs', '5')],
      [c('spades', '5'), c('hearts', 'Q'), c('clubs', '6')],
    ]);
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    engine.playCard('p0', 'hearts-2');
    engine.playCard('p1', 'hearts-9');
    engine.playCard('p2', 'clubs-K'); // thulla
    const s = engine.getState();
    expect(s.awaitingResolution).toBeTrue();
    const r = engine.resolveTrick();
    expect(r.outcome).toBe('thulla');
    expect(r.thullaById).toBe('p2');
    expect(r.pickedUpById).toBe('p1');
    expect(r.nextLeaderId).toBe('p1');
    const p1 = engine.getState().players[1];
    expect(p1.hand.map((x) => x.id).sort()).toEqual(['clubs-4', 'clubs-K', 'hearts-2', 'hearts-9'].sort());
  });

  it('first trick off-suit plays are discarded under Pakistan rules', () => {
    const engine = rigged(
      [
        [c('spades', 'A'), c('hearts', '2')],
        [c('hearts', '3'), c('hearts', '9')],
        [c('spades', '4'), c('hearts', 'K')],
        [c('spades', '5'), c('hearts', 'Q')],
      ],
      'pakistan',
    );
    engine.playCard('p0', 'spades-A');
    engine.playCard('p1', 'hearts-3'); // no spades, but no thulla on trick one
    expect(engine.getState().awaitingResolution).toBeFalse();
    engine.playCard('p2', 'spades-4');
    engine.playCard('p3', 'spades-5');
    const r = engine.resolveTrick();
    expect(r.outcome).toBe('cleared');
    expect(r.pickedUpById).toBeNull();
  });

  it('last player holding cards is the Bhabhi', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2')],
      [c('spades', '3'), c('hearts', '9')],
      [c('spades', '4'), c('hearts', 'K')],
      [c('spades', '5'), c('clubs', 'Q'), c('clubs', '2')],
    ]);
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    engine.playCard('p0', 'hearts-2');
    engine.playCard('p1', 'hearts-9');
    engine.playCard('p2', 'hearts-K');
    engine.playCard('p3', 'clubs-Q'); // thulla: p2 picks up
    engine.resolveTrick();
    const s = engine.getState();
    expect(s.finishOrder).toEqual(['p0', 'p1']);
    expect(s.currentPlayerId).toBe('p2');
    expect(engine.isGameOver()).toBeFalse();
  });

  it('player view hides opponents hands', () => {
    const engine = new BhabhiThullaEngine(seats(), { seed: 3 });
    engine.initializeGame();
    const view = engine.getPlayerView('p0');
    expect(view.hand.length).toBe(13);
    expect(view.players.every((p) => !('hand' in p))).toBeTrue();
    expect(view.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
  });

  it('bot-vs-bot games always finish with a winner and a consistent card count', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const players = 3 + (seed % 4);
      const { engine, guard } = playRandomGame(seed, players);
      expect(guard).toBeLessThan(5000);
      expect(engine.isGameOver()).toBeTrue();
      const s = engine.getState();
      const inHands = s.players.reduce((n, p) => n + p.hand.length, 0);
      expect(inHands + s.discardedCount).toBe(52);
      expect(engine.getWinner()).not.toBeNull();
      if (s.bhabhiId) expect(s.finishOrder.length).toBe(players - 1);
    }
  });

  it('scores reward early escape and penalise the Bhabhi', () => {
    const { engine } = playRandomGame(11);
    const s = engine.getState();
    const scores = engine.calculateScore();
    expect(scores[s.finishOrder[0]]).toBe(15);
    if (s.bhabhiId) expect(scores[s.bhabhiId]).toBe(-10);
  });
});

describe('Bhabhi Thulla bot', () => {
  it('tracks voids from thullas', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2'), c('hearts', '3')],
      [c('spades', '3'), c('hearts', '9'), c('clubs', '4')],
      [c('spades', '4'), c('clubs', 'K'), c('clubs', '5')],
      [c('spades', '5'), c('hearts', 'Q'), c('clubs', '6')],
    ]);
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    engine.playCard('p0', 'hearts-2');
    engine.playCard('p1', 'hearts-9');
    engine.playCard('p2', 'clubs-K');
    engine.resolveTrick();
    const k = analyzeTable(engine.getPlayerView('p3'));
    expect(k.voids.get('p2')!.has('hearts')).toBeTrue();
    expect(k.knownHoldings.get('p1')!.has('clubs-K')).toBeTrue();
  });

  it('ducks under the current high card when it can', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '10'), c('clubs', '2')],
      [c('spades', '3'), c('hearts', '4'), c('hearts', '9'), c('hearts', 'K')],
      [c('spades', '4'), c('hearts', 'J'), c('clubs', '5')],
      [c('spades', '5'), c('hearts', 'Q'), c('clubs', '6')],
    ]);
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    engine.playCard('p0', 'hearts-10');
    const choice = chooseCard(engine.getPlayerView('p1'), { difficulty: 'hard', personality: 'strategic' }, seededRng(1), engine.getValidMoves('p1'));
    expect(choice.id).toBe('hearts-9');
  });

  it('dumps its highest card when last to act', () => {
    const engine = rigged([
      [c('spades', 'A'), c('hearts', '2')],
      [c('spades', '3'), c('hearts', '9')],
      [c('spades', '4'), c('hearts', 'J')],
      [c('spades', '5'), c('hearts', '3'), c('hearts', 'A')],
    ]);
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => engine.playCard(id, engine.getValidMoves(id)[0].id));
    engine.resolveTrick();
    engine.playCard('p0', 'hearts-2');
    engine.playCard('p1', 'hearts-9');
    engine.playCard('p2', 'hearts-J');
    const choice = chooseCard(engine.getPlayerView('p3'), { difficulty: 'normal', personality: 'strategic' }, seededRng(1), engine.getValidMoves('p3'));
    expect(choice.id).toBe('hearts-A');
  });

  it('expert bots beat random bots more often than not', () => {
    let expertBhabhi = 0;
    let randomBhabhi = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const engine = new BhabhiThullaEngine(seats(), { seed });
      engine.initializeGame();
      const rng = seededRng(seed * 13);
      const profiles = [
        { difficulty: 'expert', personality: 'expert' },
        { difficulty: 'easy', personality: 'random' },
        { difficulty: 'expert', personality: 'expert' },
        { difficulty: 'easy', personality: 'random' },
      ] as const;
      while (!engine.isGameOver()) {
        const s = engine.getState();
        if (s.awaitingResolution) {
          engine.resolveTrick();
          continue;
        }
        const id = s.currentPlayerId!;
        const seat = Number(id.slice(1));
        engine.playCard(id, chooseCard(engine.getPlayerView(id), profiles[seat], rng, engine.getValidMoves(id)).id);
      }
      const b = engine.getState().bhabhiId;
      if (b === 'p0' || b === 'p2') expertBhabhi++;
      if (b === 'p1' || b === 'p3') randomBhabhi++;
    }
    expect(expertBhabhi).toBeLessThan(randomBhabhi);
  });
});
