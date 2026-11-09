import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './donkey.definition';
import { DonkeyEngine, cardValue, pilePoints } from './donkey.engine';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: cardId(suit, rank), suit, rank });
type Inner = { hands: Card[][]; stock: Card[]; table: Card[]; piles: Card[][]; turn: number; phase: string; active: Card | null };
const inner = (e: DonkeyEngine) => e as unknown as Inner;

function setup(state: Partial<Inner>, players = 2): DonkeyEngine {
  const e = new DonkeyEngine(testSeats(players), 1, { target: 300 });
  e.initializeGame();
  Object.assign(inner(e), { turn: 0, phase: 'draw', active: null, piles: Array.from({ length: players }, () => []), ...state });
  return e;
}

describe('Donkey', () => {
  it('scores 2–9 at 5, 10–K at 10 and Aces at 20: 400 in the deck', () => {
    expect([c('2'), c('9'), c('10'), c('K'), c('A')].map(cardValue)).toEqual([5, 5, 10, 10, 20]);
    const all = (['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as Rank[]).flatMap((r) =>
      (['spades', 'hearts', 'clubs', 'diamonds'] as Suit[]).map((s) => c(r, s)),
    );
    expect(pilePoints(all)).toBe(400);
  });

  it('deals 4 cards each and 4 face up on the table', () => {
    const e = new DonkeyEngine(testSeats(3), 5, {});
    e.initializeGame();
    const v = e.getView('you');
    expect(v.hand).toHaveLength(4);
    expect(v.table).toHaveLength(4);
    expect(v.stockCount).toBe(52 - 12 - 4);
  });

  it('a drawn match takes the pair and draws again', () => {
    const e = setup({ hands: [[c('2')], [c('3')]], table: [c('7'), c('9')], stock: [c('4'), c('7', 'hearts')] });
    e.apply('you', { type: 'draw' });
    expect(e.legalActions('you').map((a) => a.value)).toEqual(['spades-7']);
    e.apply('you', { type: 'choose', value: 'spades-7' });
    const v = e.getView('you');
    expect(v.piles[0].map((x) => x.id)).toEqual(['spades-7', 'hearts-7']);
    expect(v.table.map((x) => x.id)).toEqual(['spades-9']);
    expect(e.currentPlayerId()).toBe('you');
    expect(v.phase).toBe('draw');
  });

  it('no match: throw the drawn card, or keep it and throw a hand card', () => {
    const e = setup({ hands: [[c('2'), c('K')], [c('3')]], table: [c('9')], stock: [c('5'), c('4'), c('Q', 'hearts')] });
    e.apply('you', { type: 'draw' });
    expect(e.getView('you').phase).toBe('throw');
    e.apply('you', { type: 'discard', cardId: 'spades-2' });
    const v = e.getView('you');
    expect(v.table.map((x) => x.id)).toEqual(['spades-9', 'spades-2']);
    expect(v.hand.map((x) => x.id).sort()).toEqual(['hearts-Q', 'spades-K']);
    expect(e.currentPlayerId()).toBe('bot-1');
  });

  it('steals the top card of an opponent’s pile', () => {
    const e = setup({ hands: [[c('2')], [c('3')]], table: [c('9')], stock: [c('5'), c('K', 'hearts')], piles: [[], [c('4'), c('K'), c('K', 'clubs')]] });
    e.apply('you', { type: 'draw' });
    expect(e.legalActions('you').map((a) => a.value)).toEqual(['pile:1']);
    e.apply('you', { type: 'choose', value: 'pile:1' });
    const v = e.getView('you');
    expect(v.piles[1].map((x) => x.id)).toEqual(['spades-4', 'spades-K']);
    expect(v.piles[0].map((x) => x.id)).toEqual(['clubs-K', 'hearts-K']);
  });

  it('after the deck is empty players play one hand card a turn, then the round scores', () => {
    const e = setup({ hands: [[c('A'), c('5')], [c('6')]], table: [c('A', 'hearts')], stock: [], phase: 'play' });
    e.apply('you', { type: 'play', cardId: 'spades-A' });
    e.apply('you', { type: 'choose', value: 'hearts-A' });
    expect(e.currentPlayerId()).toBe('bot-1'); // one card per turn
    e.apply('bot-1', { type: 'play', cardId: 'spades-6' });
    expect(e.getView('you').table.map((x) => x.id)).toEqual(['spades-6']);
    e.apply('you', { type: 'play', cardId: 'spades-5' });
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').totals).toEqual([40, 0]);
  });

  it('a capture that empties the deck ends the turn', () => {
    const e = setup({ hands: [[c('2')], [c('3')]], table: [c('9')], stock: [c('9', 'hearts')] });
    e.apply('you', { type: 'draw' });
    e.apply('you', { type: 'choose', value: 'spades-9' });
    expect(e.currentPlayerId()).toBe('bot-1');
    expect(e.getView('bot-1').phase).toBe('play');
  });

  it('bots finish whole games for 2 and 3 players', () => {
    for (const players of [2, 3]) {
      for (const seed of [1, 2, 3]) {
        const { engine } = playThrough(definition, seed, { players, settings: { target: 500 } });
        expect(engine.isGameOver()).toBe(true);
        const v = engine.getView('you') as unknown as { totals: number[] };
        expect(Math.max(...v.totals)).toBeGreaterThanOrEqual(500);
        expect(v.totals.reduce((a, b) => a + b, 0) % 5).toBe(0);
      }
    }
  });
});
