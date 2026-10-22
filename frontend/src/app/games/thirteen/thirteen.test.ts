import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { IllegalActionError } from '../core/table-game';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './thirteen.definition';
import { ThirteenEngine } from './thirteen.engine';
import { beats, classify, enumeratePlays } from './thirteen.rules';

const S: Record<string, Suit> = { s: 'spades', c: 'clubs', d: 'diamonds', h: 'hearts' };
/** `cards('3s 3h 4d')` */
const cards = (spec: string): Card[] =>
  spec.split(' ').map((t) => {
    const suit = S[t.slice(-1)];
    const rank = t.slice(0, -1) as Rank;
    return { id: cardId(suit, rank), suit, rank };
  });
const combo = (spec: string) => classify(cards(spec))!;

/** Private engine state, for crafting positions in tests. */
interface Internals {
  hands: Card[][];
  turn: number | null;
  mustInclude: string | null;
  table: unknown;
  passed: boolean[];
}
const inner = (e: ThirteenEngine) => e as unknown as Internals;

function engine(players = 4, seed = 1, target = 10) {
  const e = new ThirteenEngine(testSeats(players), seed, { target });
  e.initializeGame();
  return e;
}

/** Give each seat a fixed hand and seat 0 the lead with no opening constraint. */
function staged(hands: string[]) {
  const e = engine(hands.length);
  inner(e).hands = hands.map(cards);
  inner(e).turn = 0;
  inner(e).mustInclude = null;
  return e;
}
const ids = (spec: string) => cards(spec).map((c) => c.id);

describe('Thirteen combinations', () => {
  it('classifies singles, sets, runs and runs of pairs', () => {
    expect(combo('7d').type).toBe('single');
    expect(combo('7d 7s').type).toBe('pair');
    expect(combo('7d 7s 7h').type).toBe('triple');
    expect(combo('7d 7s 7h 7c').type).toBe('quad');
    expect(combo('5s 6h 7d').type).toBe('run');
    expect(combo('Qs Kh Ad').type).toBe('run');
    expect(combo('4s 4h 5s 5d 6c 6h').type).toBe('pairs-run');
  });

  it('rejects runs through 2 and other non-combinations', () => {
    expect(classify(cards('Ks As 2h'))).toBeNull();
    expect(classify(cards('As 2h 3d'))).toBeNull();
    expect(classify(cards('5s 6h'))).toBeNull();
    expect(classify(cards('5s 7h 8d'))).toBeNull();
    expect(classify(cards('4s 4h 5s 5d'))).toBeNull(); // only two pairs
  });

  it('orders 3 low, 2 high, and suits ♠ < ♣ < ♦ < ♥', () => {
    expect(beats(combo('4s'), combo('3h'))).toBe(true);
    expect(beats(combo('2s'), combo('Ah'))).toBe(true);
    expect(beats(combo('9h'), combo('9d'))).toBe(true);
    expect(beats(combo('9c'), combo('9d'))).toBe(false);
    expect(beats(combo('8s 8h'), combo('8c 8d'))).toBe(true);
  });

  it('only beats the same shape and size', () => {
    expect(beats(combo('9s 9h'), combo('8d'))).toBe(false);
    expect(beats(combo('6s 7s 8s 9s'), combo('3s 4s 5s'))).toBe(false);
    expect(beats(combo('4s 5s 6h'), combo('3s 4s 5d'))).toBe(true);
  });

  it('lets bombs beat 2s', () => {
    expect(beats(combo('3s 3h 3c 3d'), combo('2h'))).toBe(true);
    expect(beats(combo('3s 3h 4s 4h 5s 5h'), combo('2h'))).toBe(true);
    expect(beats(combo('3s 3h 4s 4h 5s 5h'), combo('2s 2h'))).toBe(false);
    expect(beats(combo('3s 3h 4s 4h 5s 5h 6s 6h'), combo('2s 2h'))).toBe(true);
    expect(beats(combo('3s 3h 4s 4h 5s 5h 6s 6h 7s 7h'), combo('2s 2h 2c'))).toBe(true);
    expect(beats(combo('3s 3h 3c 3d'), combo('5s 5h 6s 6h 7s 7h'))).toBe(true);
    expect(beats(combo('3s 3h 4s 4h 5s 5h 6s 6h'), combo('Ks Kh Kc Kd'))).toBe(true);
    expect(beats(combo('3s 3h 3c 3d'), combo('Ah'))).toBe(false);
  });

  it('enumerates every beating shape from a hand', () => {
    const hand = cards('3s 4h 5d 5h 6c 9s 9d 2c');
    const plays = enumeratePlays(hand, combo('8h'));
    const singles = plays.filter((p) => p.length === 1).map((p) => p[0].id);
    expect(singles.sort()).toEqual(ids('9s 9d 2c').sort());
    expect(enumeratePlays(hand, combo('3c 4c 5c')).map((p) => p.map((c) => c.id))).toContainEqual(ids('4h 5d 6c'));
    expect(enumeratePlays(hand, null, 'spades-3').every((p) => p.some((c) => c.id === 'spades-3'))).toBe(true);
  });
});

describe('Thirteen engine', () => {
  it('deals 13 cards each and makes the lowest card holder open with it', () => {
    const e = engine(4, 7);
    const v = e.getView('you');
    expect(v.players.every((p) => p.cardCount === 13)).toBe(true);
    expect(v.mustInclude).toBe('spades-3');
    const opener = e.currentPlayerId()!;
    const view = e.getView(opener);
    expect(view.hand.some((c) => c.id === 'spades-3')).toBe(true);
    const other = view.hand.find((c) => c.id !== 'spades-3')!;
    expect(() => e.apply(opener, { type: 'play', cardIds: [other.id] })).toThrow(IllegalActionError);
    e.apply(opener, { type: 'play', cardIds: ['spades-3'] });
    expect(e.getView('you').table?.cards.map((c) => c.id)).toEqual(['spades-3']);
  });

  it('opens with the lowest card dealt when 3♠ is not in play', () => {
    for (let seed = 1; seed < 30; seed++) {
      const e = engine(2, seed);
      const must = e.getView('you').mustInclude!;
      const dealt = e.getView('you').hand.concat(e.getView('bot-1').hand);
      expect(dealt.some((c) => c.id === must)).toBe(true);
    }
  });

  it('rejects plays that do not beat the table and allows passing', () => {
    const e = staged(['5s 9h Ks', '4s 6h Qd', '3c 7d Ad', '3d 8s Kd']);
    expect(e.legalActions('you')).toEqual([]); // can't pass when leading
    e.apply('you', { type: 'play', cardIds: ids('9h') });
    expect(() => e.apply('bot-1', { type: 'play', cardIds: ids('6h') })).toThrow(/doesn’t beat/);
    expect(() => e.apply('bot-1', { type: 'play', cardIds: ids('4s 6h') })).toThrow(/combination/);
    e.apply('bot-1', { type: 'play', cardIds: ids('Qd') });
    e.apply('bot-2', { type: 'pass' });
    e.apply('bot-3', { type: 'play', cardIds: ids('Kd') });
    expect(e.currentPlayerId()).toBe('you');
  });

  it('tells a player with nothing that beats the table to pass', () => {
    const e = staged(['5s 9h', '4s 6h', '3c 7d', '3d 8s']);
    e.apply('you', { type: 'play', cardIds: ids('9h') });
    expect(e.cardSelection('bot-1')).toBeNull();
    expect(e.legalActions('bot-1').map((a) => a.type)).toEqual(['pass']);
    expect(e.getView('bot-1').phaseLabel).toMatch(/you have to pass/);
  });

  it('skips players who passed and gives the lead to the last player', () => {
    const e = staged(['5s 9h Ks', '4s 6h Qd', '3c 7d Ad', '3d 8s Kd']);
    e.apply('you', { type: 'play', cardIds: ids('9h') });
    e.apply('bot-1', { type: 'pass' });
    e.apply('bot-2', { type: 'play', cardIds: ids('Ad') });
    e.apply('bot-3', { type: 'pass' });
    e.apply('you', { type: 'pass' });
    expect(e.pending()).toBe('trick');
    e.resolve();
    expect(e.currentPlayerId()).toBe('bot-2');
    expect(e.getView('you').table).toBeNull();
    expect(e.getView('you').passed).toEqual([]);
  });

  it('passes the lead on when the round winner has gone out', () => {
    const e = staged(['5s', '4s 6h', '3c 7d', '3d 8s']);
    e.apply('you', { type: 'play', cardIds: ids('5s') });
    expect(e.getView('you').finishOrder).toEqual(['you']);
    e.apply('bot-1', { type: 'pass' });
    e.apply('bot-2', { type: 'pass' });
    e.apply('bot-3', { type: 'pass' });
    e.resolve();
    expect(e.currentPlayerId()).toBe('bot-1');
  });

  it('scores by finishing order and lets the hand winner lead next', () => {
    const e = staged(['5s', '4s', '3c', '3d 8s']);
    e.apply('you', { type: 'play', cardIds: ids('5s') }); // out 1st
    e.apply('bot-1', { type: 'pass' });
    e.apply('bot-2', { type: 'pass' });
    e.apply('bot-3', { type: 'play', cardIds: ids('8s') }); // everyone left has passed
    expect(e.pending()).toBe('trick');
    e.resolve();
    e.apply('bot-3', { type: 'play', cardIds: ids('3d') }); // out 2nd
    e.apply('bot-1', { type: 'play', cardIds: ids('4s') }); // out 3rd, bot-2 last
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').totals).toEqual([3, 1, 0, 2]);
    e.resolve();
    expect(e.getView('you').handNumber).toBe(2);
    expect(e.currentPlayerId()).toBe('you');
    expect(e.getView('you').mustInclude).toBeNull();
  });

  it('plays whole games with bots at every table size and difficulty', () => {
    for (const players of [2, 3, 4]) {
      for (const difficulty of ['easy', 'normal', 'hard', 'expert'] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const { engine: e } = playThrough(definition, seed * 7919 + players, { players, difficulty });
          const out = e.outcome();
          expect(out.players).toHaveLength(players);
          expect(Math.max(...out.players.map((p) => p.score))).toBeGreaterThanOrEqual(10);
          expect(out.players.some((p) => p.position === 1)).toBe(true);
        }
      }
    }
  });

  it('action log replays to the same result', () => {
    const { engine: e } = playThrough(definition, 4242, { players: 4 });
    const replay = new ThirteenEngine(testSeats(4), 4242, { target: 10 });
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
