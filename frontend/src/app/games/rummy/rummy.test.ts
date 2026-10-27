import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { IllegalActionError } from '../core/table-game';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './rummy.definition';
import { RummyEngine } from './rummy.engine';
import { Meld, bestMelds, classifyMeld, handPoints, layOff } from './rummy.rules';

const S: Record<string, Suit> = { s: 'spades', c: 'clubs', d: 'diamonds', h: 'hearts' };
const cards = (spec: string): Card[] =>
  spec.split(' ').filter(Boolean).map((t) => {
    const suit = S[t.slice(-1)];
    const rank = t.slice(0, -1) as Rank;
    return { id: cardId(suit, rank), suit, rank };
  });
const ids = (spec: string) => cards(spec).map((c) => c.id);

interface Internals {
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  melds: { owner: number; meld: Meld }[];
  turn: number | null;
  phase: 'draw' | 'play';
}
const inner = (e: RummyEngine) => e as unknown as Internals;

function staged(hands: string[], discard = 'Kh', stock = '2c 3c 4c 5c 6c') {
  const e = new RummyEngine(testSeats(hands.length), 1, { target: 100 });
  e.initializeGame();
  Object.assign(inner(e), { hands: hands.map(cards), discard: cards(discard), stock: cards(stock), melds: [], turn: 0, phase: 'draw' });
  return e;
}

describe('Rummy melds', () => {
  it('recognises sets and Ace-low runs', () => {
    expect(classifyMeld(cards('8s 8h 8d'))?.type).toBe('set');
    expect(classifyMeld(cards('8s 8h 8d 8c'))?.type).toBe('set');
    expect(classifyMeld(cards('Ah 2h 3h'))?.type).toBe('run');
    expect(classifyMeld(cards('9c Jc 10c'))?.type).toBe('run');
    expect(classifyMeld(cards('Qh Kh Ah'))).toBeNull();
    expect(classifyMeld(cards('4h 5h 6c'))).toBeNull();
    expect(classifyMeld(cards('8s 8h'))).toBeNull();
  });

  it('lays off onto either end of a run and onto sets', () => {
    const run = classifyMeld(cards('5d 6d 7d'))!;
    expect(layOff(run, cards('4d'))?.cards.map((c) => c.rank)).toEqual(['4', '5', '6', '7']);
    expect(layOff(run, cards('8d 9d'))?.cards).toHaveLength(5);
    expect(layOff(run, cards('9d'))).toBeNull();
    expect(layOff(classifyMeld(cards('Qs Qh Qd'))!, cards('Qc'))?.type).toBe('set');
    expect(layOff(classifyMeld(cards('5s 5h 5d'))!, cards('6s'))).toBeNull();
  });

  it('scores leftover cards: Ace 1, faces 10', () => {
    expect(handPoints(cards('As 7d Kc Qh'))).toBe(28);
  });

  it('finds the melds that cover the most cards', () => {
    const best = bestMelds(cards('7h 7s 7d 4h 5h 6h 2c'));
    expect(best.flat().length).toBe(6);
  });
});

describe('Rummy engine', () => {
  it('deals 10 cards for two players and 7 for three or four', () => {
    for (const [n, size] of [[2, 10], [3, 7], [4, 7]]) {
      const e = new RummyEngine(testSeats(n), 3, {});
      e.initializeGame();
      const v = e.getView('you');
      expect(v.players.every((p) => p.cardCount === size)).toBe(true);
      expect(v.discardCount).toBe(1);
      expect(v.stockCount).toBe(52 - n * size - 1);
    }
  });

  it('draws, melds, lays off and discards in order', () => {
    const e = staged(['7h 7s 7d 4c Kd', '2s 3s']);
    expect(() => e.apply('you', { type: 'discard', cardId: 'clubs-4' })).toThrow(IllegalActionError); // draw first
    e.apply('you', { type: 'draw', value: 'stock' });
    expect(e.getView('you').hand.map((c) => c.id)).toContain('clubs-6');
    e.apply('you', { type: 'meld', cardIds: ids('7h 7s 7d') });
    expect(() => e.apply('you', { type: 'meld', cardIds: ids('4c Kd') })).toThrow(/meld/);
    e.apply('you', { type: 'discard', cardId: 'diamonds-K' });
    expect(e.currentPlayerId()).toBe('bot-1');
    expect(e.getView('you').discardTop?.id).toBe('diamonds-K');
    e.apply('bot-1', { type: 'draw', value: 'discard' });
    expect(() => e.apply('bot-1', { type: 'discard', cardId: 'diamonds-K' })).toThrow(/throw back/);
    expect(() => e.apply('bot-1', { type: 'lay-off', cardIds: ids('2s') })).toThrow(/fit/);
  });

  it('lays off onto any player’s meld', () => {
    const e = staged(['7h 7s 7d 9c', '7c 5h']);
    e.apply('you', { type: 'draw', value: 'stock' });
    e.apply('you', { type: 'meld', cardIds: ids('7h 7s 7d') });
    e.apply('you', { type: 'discard', cardId: 'clubs-9' });
    e.apply('bot-1', { type: 'draw', value: 'stock' });
    e.apply('bot-1', { type: 'lay-off', cardIds: ids('7c') });
    expect(e.getView('you').melds[0].cards).toHaveLength(4);
  });

  it('scores the other hands when someone goes out', () => {
    const e = staged(['7h 7s 7d', 'Kc Qd 3h']);
    e.apply('you', { type: 'draw', value: 'stock' }); // draws 6♣
    e.apply('you', { type: 'meld', cardIds: ids('7h 7s 7d') });
    e.apply('you', { type: 'discard', cardId: 'clubs-6' });
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').totals).toEqual([23, 0]);
  });

  it('shuffles the discard pile into a new stock when the stock runs out', () => {
    const e = staged(['9h 2d', '3s 4d'], '5s 6s 7s 8s', '');
    e.apply('you', { type: 'draw', value: 'stock' });
    expect(inner(e).discard.map((c) => c.id)).toEqual(['spades-8']);
    expect(inner(e).stock).toHaveLength(2);
  });

  it('plays whole games with bots at every table size and difficulty', () => {
    for (const players of [2, 3, 4]) {
      for (const difficulty of ['easy', 'normal', 'hard', 'expert'] as const) {
        for (let seed = 1; seed <= 5; seed++) {
          const { engine: e } = playThrough(definition, seed * 104729 + players, { players, difficulty });
          const out = e.outcome();
          expect(out.players).toHaveLength(players);
          expect(Math.max(...out.players.map((p) => p.score))).toBeGreaterThanOrEqual(100);
        }
      }
    }
  });

  it('action log replays to the same result', () => {
    const { engine: e } = playThrough(definition, 777, { players: 3 });
    const replay = new RummyEngine(testSeats(3), 777, { target: 100 });
    replay.initializeGame();
    for (const { playerId, action } of e.actionLog()) {
      while (replay.pending()) replay.resolve();
      replay.apply(playerId, action);
    }
    while (replay.pending()) replay.resolve();
    expect(replay.isGameOver()).toBe(true);
    expect(replay.outcome()).toEqual(e.outcome());
  });
});
