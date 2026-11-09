import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './donkey.definition';
import { DonkeyEngine, cardValue, pilePoints } from './donkey.engine';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: cardId(suit, rank), suit, rank });
type Inner = { hands: Card[][]; stock: Card[]; table: Card[]; piles: Card[][]; turn: number; phase: string };
const inner = (e: DonkeyEngine) => e as unknown as Inner;

function setup(state: Partial<Inner>, players = 2): DonkeyEngine {
  const e = new DonkeyEngine(testSeats(players), 1, { target: 300 });
  e.initializeGame();
  Object.assign(inner(e), { turn: 0, phase: 'draw', piles: Array.from({ length: players }, () => []), ...state });
  return e;
}
const values = (e: DonkeyEngine, id = 'you') => e.legalActions(id).map((a) => `${a.cardId}>${a.value ?? 'throw'}`);

describe('Donkey', () => {
  it('scores 2–9 at 5, 10–K at 10 and Aces at 20: 400 in the deck', () => {
    expect([c('2'), c('9'), c('10'), c('K'), c('A')].map(cardValue)).toEqual([5, 5, 10, 10, 20]);
    const all = (['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as Rank[]).flatMap((r) =>
      (['spades', 'hearts', 'clubs', 'diamonds'] as Suit[]).map((s) => c(r, s)),
    );
    expect(pilePoints(all)).toBe(400);
  });

  it('deals 4 cards each and 4 face up on the table', () => {
    const e = new DonkeyEngine(testSeats(5), 5, {});
    e.initializeGame();
    const v = e.getView('you');
    expect(v.hand).toHaveLength(4);
    expect(v.table).toHaveLength(4);
    expect(v.stockCount).toBe(52 - 20 - 4);
  });

  it('the drawn card goes to your hand, and any hand card can capture', () => {
    const e = setup({ hands: [[c('7'), c('2')], [c('3')]], table: [c('7', 'hearts'), c('9')], stock: [c('4'), c('K')] });
    e.apply('you', { type: 'draw' });
    expect(e.getView('you').hand.map((x) => x.id)).toContain('spades-K');
    // The 7 already in hand matches the table; the others are throws.
    expect(values(e)).toEqual(['spades-7>hearts-7', 'spades-2>throw', 'spades-K>throw']);
    e.apply('you', { type: 'play', cardId: 'spades-7', value: 'hearts-7' });
    const v = e.getView('you');
    expect(v.piles[0].map((x) => x.id)).toEqual(['hearts-7', 'spades-7']);
    expect(v.table.map((x) => x.id)).toEqual(['spades-9']);
    expect(e.currentPlayerId()).toBe('you'); // a capture earns another draw
    expect(v.phase).toBe('draw');
  });

  it('a card that matches nothing is thrown and the turn ends with 4 cards in hand', () => {
    const e = setup({ hands: [[c('2'), c('3'), c('4'), c('5')], [c('6')]], table: [c('9')], stock: [c('8'), c('Q')] });
    e.apply('you', { type: 'draw' });
    e.apply('you', { type: 'play', cardId: 'spades-2' });
    const v = e.getView('you');
    expect(v.table.map((x) => x.id)).toEqual(['spades-9', 'spades-2']);
    expect(v.hand).toHaveLength(4);
    expect(e.currentPlayerId()).toBe('bot-1');
  });

  it('steals the cards of that rank from the top of an opponent’s pile', () => {
    const e = setup({ hands: [[c('2')], [c('3')]], table: [c('9')], stock: [c('5'), c('K', 'hearts')], piles: [[], [c('4'), c('K'), c('K', 'clubs')]] });
    e.apply('you', { type: 'draw' });
    expect(values(e)).toEqual(['spades-2>throw', 'hearts-K>pile:1']);
    e.apply('you', { type: 'play', cardId: 'hearts-K', value: 'pile:1' });
    const v = e.getView('you');
    // Both Kings on top of Bilal's pile come over together.
    expect(v.piles[1].map((x) => x.id)).toEqual(['spades-4']);
    expect(v.piles[0].map((x) => x.id)).toEqual(['spades-K', 'clubs-K', 'hearts-K']);
  });

  it('only the cards of that rank on top are taken, not ones buried lower', () => {
    const e = setup({ hands: [[c('3', 'hearts')], [c('2')]], table: [], stock: [c('5'), c('9')], phase: 'play', piles: [[], [c('3'), c('8'), c('3', 'clubs'), c('3', 'diamonds')]] });
    expect(e.legalActions('you').find((a) => a.value === 'pile:1')?.label).toBe('Take Bot 1’s 2 3s');
    e.apply('you', { type: 'play', cardId: 'hearts-3', value: 'pile:1' });
    expect(e.getView('you').piles[1].map((x) => x.id)).toEqual(['spades-3', 'spades-8']);
  });

  it('pairs with the top of your own pile too', () => {
    const e = setup({ hands: [[c('2')], [c('3')]], table: [c('9')], stock: [c('5'), c('Q', 'hearts')], piles: [[c('4'), c('Q')], []] });
    e.apply('you', { type: 'draw' });
    e.apply('you', { type: 'play', cardId: 'hearts-Q', value: 'pile:0' });
    expect(e.getView('you').piles[0].map((x) => x.id)).toEqual(['spades-4', 'spades-Q', 'hearts-Q']);
    expect(e.currentPlayerId()).toBe('you');
  });

  it('glowing table cards and piles play the matching hand card', () => {
    const e = setup({ hands: [[c('9', 'hearts')], [c('3')]], table: [c('9')], stock: [c('5'), c('K')], piles: [[], [c('K', 'clubs')]] });
    e.apply('you', { type: 'draw' });
    const v = e.getView('you');
    expect(v.floor!.find((p) => p.id === 'c-spades-9')?.action).toEqual({ type: 'play', cardId: 'hearts-9', value: 'spades-9' });
    expect(v.players[1].pile?.action).toEqual({ type: 'play', cardId: 'spades-K', value: 'pile:1' });
    expect(v.players[0].pile?.action).toBeUndefined();
  });

  it('after the deck is empty players play one hand card a turn, then the round scores', () => {
    const e = setup({ hands: [[c('A'), c('5')], [c('6')]], table: [c('A', 'hearts')], stock: [], phase: 'play' });
    e.apply('you', { type: 'play', cardId: 'spades-A', value: 'hearts-A' });
    expect(e.currentPlayerId()).toBe('bot-1'); // one card per turn
    expect(e.getView('you').floorTaker).toBe('you');
    e.apply('bot-1', { type: 'play', cardId: 'spades-6' });
    e.apply('you', { type: 'play', cardId: 'spades-5' });
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').totals).toEqual([40, 0]);
  });

  it('bots finish whole games for 2 to 6 players', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      for (const seed of [1, 2, 3]) {
        const { engine } = playThrough(definition, seed, { players, settings: { target: 500 } });
        expect(engine.isGameOver()).toBe(true);
        const v = engine.getView('you') as unknown as { totals: number[] };
        expect(Math.max(...v.totals)).toBeGreaterThanOrEqual(500);
      }
    }
  });
});
