import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { createStandardDeck } from '../core/deck';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './seep.definition';
import { SeepEngine, cardPoints, cardValue } from './seep.engine';

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
const loose = (card: Card) => ({ cards: [card] });

function engine(seed = 1, players = 4, rounds = 1) {
  const e = new SeepEngine(testSeats(players), seed, { rounds });
  e.initializeGame();
  return e;
}

/** Engine in play phase with a hand-made position; seat 0 ("you") to play. */
function scenario(
  hands: Card[][],
  floor: { cards: Card[]; value?: number; house?: boolean; pakka?: boolean; owner?: number | null }[],
  extra: { stock?: Card[]; bid?: number; bidPlay?: boolean; players?: number } = {},
) {
  const players = extra.players ?? 2;
  const e = engine(1, players);
  const full = Array.from({ length: players }, (_, i) => hands[i] ?? []);
  e.setupForTest({ hands: full, floor, turn: 0, stock: extra.stock, bid: extra.bid, bidPlay: extra.bidPlay });
  return e;
}

const values = (e: SeepEngine, cardIdStr: string) => e.legalActions('you').filter((a) => a.cardId === cardIdStr).map((a) => a.value);

describe('Seep engine', () => {
  it('deck holds exactly 100 card points', () => {
    expect(createStandardDeck().reduce((s, x) => s + cardPoints(x), 0)).toBe(100);
    expect(cardValue(c('A', 'hearts'))).toBe(1);
    expect(cardValue(c('K', 'clubs'))).toBe(13);
  });

  it('deals four cards to the bidder, who always holds a 9–K, and bids only values held', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const e = engine(seed);
      const v = e.getView('you');
      expect(v.phase).toBe('bid');
      expect(e.currentPlayerId()).toBe(v.bidderId);
      const bidder = e.getView(v.bidderId);
      expect(bidder.hand).toHaveLength(4);
      expect(v.players.reduce((s, p) => s + p.cardCount, 0)).toBe(4);
      const held = new Set(bidder.hand.map(cardValue));
      const bids = e.legalActions(v.bidderId);
      expect(bids.length).toBeGreaterThan(0);
      for (const b of bids) {
        expect(b.type).toBe('bid');
        expect(Number(b.value)).toBeGreaterThanOrEqual(9);
        expect(held.has(Number(b.value))).toBe(true);
      }
    }
  });

  it('redeals when the bidder has no 9–K (some seed requires it)', () => {
    let sawRedeal = false;
    for (let seed = 1; seed <= 60 && !sawRedeal; seed++) {
      const e = engine(seed);
      if (e.getView('you').banner?.text.includes('redealt')) sawRedeal = true;
    }
    expect(sawRedeal).toBe(true);
  });

  it('after the bid: 4 floor cards, 12 cards each (4p) and the bidder must use the bid', () => {
    const e = engine(3);
    const bidder = e.getView('you').bidderId;
    const bid = e.legalActions(bidder)[0];
    e.apply(bidder, bid);
    const v = e.getView('you');
    expect(v.floor).toHaveLength(4);
    expect(v.players.map((p) => p.cardCount)).toEqual([12, 12, 12, 12]);
    expect(e.currentPlayerId()).toBe(bidder);
    const hand = e.getView(bidder).hand;
    for (const a of e.legalActions(bidder)) {
      const card = hand.find((x) => x.id === a.cardId)!;
      const val = String(a.value);
      if (val.startsWith('capture')) expect(cardValue(card)).toBe(bid.value);
      else if (val.startsWith('build')) expect(val.split(':')[1]).toBe(String(bid.value));
      else {
        expect(val).toBe('throw');
        expect(cardValue(card)).toBe(bid.value);
      }
    }
  });

  it('2-player deal: 12 each, then 12 more each from the stock', () => {
    const e = engine(5, 2);
    const bidder = e.getView('you').bidderId;
    e.apply(bidder, e.legalActions(bidder)[0]);
    let v = e.getView('you');
    expect(v.players.map((p) => p.cardCount)).toEqual([12, 12]);
    expect(v.stockCount).toBe(24);
    for (let i = 0; i < 24; i++) {
      const id = e.currentPlayerId()!;
      const a = e.legalActions(id)[0];
      e.apply(id, a);
    }
    v = e.getView('you');
    expect(v.players.map((p) => p.cardCount)).toEqual([12, 12]);
    expect(v.stockCount).toBe(0);
  });

  it('captures loose cards totalling the card value', () => {
    const e = scenario([[c('9', 'hearts'), c('2', 'clubs')], [c('3', 'clubs')]], [loose(c('5', 'spades')), loose(c('4', 'hearts')), loose(c('7', 'clubs'))]);
    expect(values(e, 'hearts-9')).toContain('capture:spades-5,hearts-4');
    e.apply('you', { type: 'play', cardId: 'hearts-9', value: 'capture:spades-5,hearts-4' });
    expect(e.getView('you').floor!.map((p) => p.id)).toEqual(['clubs-7']);
    expect(e.capturedCards(0).map((x) => x.id).sort()).toEqual(['hearts-4', 'hearts-9', 'spades-5']);
    expect(() => e.apply('bot-1', { type: 'play', cardId: 'clubs-3', value: 'capture:clubs-7' })).toThrow();
  });

  it('builds a house only when holding a card of its value', () => {
    const floor = [loose(c('6', 'clubs'))];
    const e = scenario([[c('5', 'hearts'), c('J', 'spades'), c('2', 'diamonds')], [c('3', 'clubs')]], floor);
    expect(values(e, 'hearts-5')).toContain('build:11:clubs-6');
    expect(values(e, 'diamonds-2')).not.toContain('build:8:clubs-6'); // below 9
    const e2 = scenario([[c('5', 'hearts'), c('Q', 'spades')], [c('3', 'clubs')]], floor);
    expect(values(e2, 'hearts-5').some((v) => String(v).startsWith('build'))).toBe(false);
    e.apply('you', { type: 'play', cardId: 'hearts-5', value: 'build:11:clubs-6' });
    const v = e.getView('you');
    expect(v.houses).toEqual([{ id: v.houses[0].id, value: 11, pakka: false, ownerId: 'you' }]);
    expect(v.floor![0].label).toBe('House 11 · kacha');
  });

  it('cements and raises houses; pakka houses cannot be raised', () => {
    const house = { cards: [c('6', 'clubs'), c('5', 'hearts')], value: 11, house: true, owner: 1 };
    const e = scenario([[c('J', 'diamonds'), c('J', 'clubs'), c('Q', 'hearts'), c('A', 'hearts')], [c('J', 'spades')]], [house, loose(c('10', 'clubs'))]);
    const hid = e.getView('you').houses[0].id;
    expect(values(e, 'diamonds-J')).toContain(`add:${hid}:11:`); // cement with a J (another J kept)
    expect(values(e, 'hearts-A')).toContain(`add:${hid}:12:`); // raise 11 -> 12 holding a Q
    expect(values(e, 'hearts-A')).toContain(`add:${hid}:11:clubs-10`); // cement with A+10
    e.apply('you', { type: 'play', cardId: 'diamonds-J', value: `add:${hid}:11:` });
    expect(e.getView('you').houses[0]).toMatchObject({ value: 11, pakka: true, ownerId: 'you' });
    // Pakka: no raise options anymore for anyone.
    const p = scenario([[c('A', 'hearts'), c('Q', 'hearts')], [c('3', 'clubs')]], [{ ...house, pakka: true }]);
    expect(values(p, 'hearts-A').filter((v) => String(v).startsWith('add'))).toEqual([]);
  });

  it('houses can only be captured with exactly their value', () => {
    const house = { cards: [c('6', 'clubs'), c('5', 'hearts')], value: 11, house: true, owner: 1 };
    const e = scenario([[c('J', 'diamonds'), c('Q', 'clubs')], [c('J', 'spades')]], [house, loose(c('A', 'clubs'))]);
    const hid = e.getView('you').houses[0].id;
    expect(values(e, 'diamonds-J')).toContain(`capture:${hid}`);
    expect(values(e, 'clubs-Q').filter((v) => String(v).startsWith('capture'))).toEqual([]); // 11 + A is not allowed
  });

  it('a player who owns a house may not throw and must keep its matching card', () => {
    const house = { cards: [c('6', 'clubs'), c('5', 'hearts')], value: 11, house: true, owner: 0 };
    const e = scenario([[c('J', 'diamonds'), c('3', 'clubs'), c('4', 'hearts')], [c('2', 'spades')]], [house, loose(c('4', 'spades'))]);
    const all = e.legalActions('you');
    expect(all.some((a) => a.value === 'throw')).toBe(false);
    // The only J must not be spent on a loose capture while the house stands.
    expect(all.filter((a) => a.cardId === 'diamonds-J').map((a) => a.value)).toEqual([`capture:${e.getView('you').houses[0].id}`]);
    const free = scenario([[c('3', 'clubs')], [c('2', 'spades')]], [loose(c('9', 'spades'))]);
    expect(values(free, 'clubs-3')).toEqual(['throw']);
  });

  it('a seep scores 50, but not on the last play of the deal', () => {
    const e = scenario([[c('9', 'hearts'), c('2', 'clubs')], [c('3', 'clubs'), c('8', 'hearts')]], [loose(c('5', 'spades')), loose(c('4', 'hearts'))]);
    const a = e.legalActions('you').find((x) => x.value === 'capture:spades-5,hearts-4')!;
    expect(a.label).toContain('Seep');
    e.apply('you', a);
    expect(e.getView('you').seeps).toEqual([1, 0]);
    expect(e.getView('you').cardPoints[0]).toBe(5);
    expect(e.getView('you').players[0].stat).toBe('55 pts · 1 seep');

    const last = scenario([[c('9', 'hearts')], []], [loose(c('5', 'spades')), loose(c('4', 'hearts'))]);
    const b = last.legalActions('you').find((x) => x.value === 'capture:spades-5,hearts-4')!;
    expect(b.label).not.toContain('Seep');
    last.apply('you', b);
    expect(last.pending()).toBe('hand');
    expect(last.getView('you').seeps).toEqual([0, 0]);
    expect(last.getView('you').totals).toEqual([5, 0]);
  });

  it('the last capturer takes the cards left on the floor', () => {
    const e = scenario([[c('9', 'hearts'), c('2', 'clubs')], [c('8', 'clubs')]], [loose(c('5', 'spades')), loose(c('4', 'hearts')), loose(c('K', 'spades'))]);
    e.apply('you', { type: 'play', cardId: 'hearts-9', value: 'capture:spades-5,hearts-4' });
    e.apply('bot-1', { type: 'play', cardId: 'clubs-8', value: 'throw' });
    e.apply('you', { type: 'play', cardId: 'clubs-2', value: 'throw' });
    expect(e.pending()).toBe('hand');
    const v = e.getView('you');
    expect(v.handSummary?.lines[0]).toContain('You takes the last 3');
    expect(v.totals).toEqual([5 + 13, 0]);
    e.resolve();
    expect(e.isGameOver()).toBe(true);
    expect(e.outcome().players.map((p) => p.result)).toEqual(['win', 'loss']);
  });

  it('bot games finish for 2 and 4 players across settings, with 100 card points per deal', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const players of [4, 2]) {
        const rounds = seed % 2 ? 1 : 2;
        const difficulty = (['easy', 'normal', 'hard', 'expert'] as const)[seed % 4];
        const { engine: e } = playThrough(definition, seed, { players, settings: { rounds }, difficulty });
        const v = e.getView('you') as ReturnType<SeepEngine['getView']>;
        expect(v.cardPoints[0] + v.cardPoints[1]).toBe(100);
        const out = e.outcome();
        expect(out.players).toHaveLength(players);
        expect(out.players.every((p, i) => p.result === out.players[i % 2].result)).toBe(true);
        expect(out.players[0].score).toBe(v.totals[0]);
        expect(out.players[1].score).toBe(v.totals[1]);
        const extra = v.totals[0] + v.totals[1] - 100 * rounds;
        expect(extra).toBeGreaterThanOrEqual(0);
        expect(extra % 50).toBe(0);
        if (out.players[0].result !== 'draw') expect(out.players[0].result).not.toBe(out.players[1].result);
      }
    }
  });

  it('action log replays to the same result', () => {
    for (const [players, rounds] of [[4, 2], [2, 2], [4, 1]]) {
      const { engine: a } = playThrough(definition, 77 + players, { players, settings: { rounds } });
      const b = new SeepEngine(testSeats(players), 77 + players, { rounds });
      b.initializeGame();
      for (const { playerId, action } of a.actionLog()) {
        while (b.pending()) b.resolve();
        b.apply(playerId, action);
      }
      while (b.pending()) b.resolve();
      expect(b.isGameOver()).toBe(true);
      expect(b.outcome()).toEqual(a.outcome());
    }
  });

  it('never leaks other hands', () => {
    const e = engine(9);
    const bidder = e.getView('you').bidderId;
    e.apply(bidder, e.legalActions(bidder)[0]);
    const mine = new Set(e.getView('you').hand.map((x) => x.id));
    for (const id of ['bot-1', 'bot-2', 'bot-3']) for (const x of e.getView(id).hand) expect(mine.has(x.id)).toBe(false);
    expect(JSON.stringify(e.getView('you'))).not.toContain(e.getView('bot-1').hand[0].id + '"');
  });
});
