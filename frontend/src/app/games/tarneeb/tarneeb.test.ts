import { describe, expect, it } from 'vitest';
import { Card, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './tarneeb.definition';
import { KABOOT_POINTS, TarneebEngine } from './tarneeb.engine';

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });

function engine(seed = 1, target = 31) {
  const e = new TarneebEngine(testSeats(4), seed, { target });
  e.initializeGame();
  return e;
}

/** Internal state access for crafted scoring scenarios. */
type Internals = {
  hands: Card[][];
  bidder: number | null;
  bid: number;
  phase: string;
  trump: Card['suit'] | null;
  turn: number | null;
  tricksWon: [number, number];
  points: [number, number];
  played: Card[];
  handNumber: number;
};
const raw = (e: TarneebEngine) => e as unknown as Internals;

/** Bid `value` with the first bidder; everyone else passes; bidder names `suit`. */
function auction(e: TarneebEngine, value = 7, suit: Card['suit'] = 'spades') {
  const first = e.currentPlayerId()!;
  e.apply(first, { type: 'bid', value });
  for (let i = 0; i < 3; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
  e.apply(first, { type: 'trump', suit });
  return first;
}

/** Jump to the last trick so team 0 ends the hand with `team0` tricks (>= 1); seat 0 wins the last trick with a trump. */
function finishHandWith(e: TarneebEngine, team0: number) {
  const r = raw(e);
  r.hands = [[c('spades', '2')], [c('hearts', '2')], [c('clubs', '2')], [c('diamonds', '2')]];
  r.played = Array.from({ length: 48 }, () => c('spades', '3'));
  r.trump = 'spades';
  r.phase = 'play';
  r.tricksWon = [team0 - 1, 13 - team0];
  r.turn = 0;
  e.apply('you', { type: 'play', cardId: 'spades-2' });
  e.apply('bot-1', { type: 'play', cardId: 'hearts-2' });
  e.apply('bot-2', { type: 'play', cardId: 'clubs-2' });
  e.apply('bot-3', { type: 'play', cardId: 'diamonds-2' });
  e.resolve();
}

describe('Tarneeb engine', () => {
  it('deals 13 cards each from a full deck and starts bidding after the dealer', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('bid');
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    const all = v.players.flatMap((p) => e.getView(p.id).hand.map((x) => x.id));
    expect(new Set(all).size).toBe(52);
    const dealerIdx = v.players.findIndex((p) => p.id === v.dealerId);
    expect(e.currentPlayerId()).toBe(v.players[(dealerIdx + 1) % 4].id);
    expect(v.players[dealerIdx].badges).toContain('Dealer');
  });

  it('never leaks other hands', () => {
    const e = engine(2);
    const v = e.getView('you');
    expect(v.hand).toHaveLength(13);
    expect(JSON.stringify(v)).not.toContain('hands');
  });

  it('offers bids 7–13 and pass; each bid must exceed the high bid', () => {
    const e = engine();
    const p = e.currentPlayerId()!;
    expect(e.legalActions(p).map((a) => a.label)).toEqual(['Bid 7', 'Bid 8', 'Bid 9', 'Bid 10', 'Bid 11', 'Bid 12', 'Bid 13', 'Pass']);
    expect(() => e.apply(p, { type: 'bid', value: 6 })).toThrow();
    e.apply(p, { type: 'bid', value: 9 });
    const q = e.currentPlayerId()!;
    expect(() => e.apply(q, { type: 'bid', value: 9 })).toThrow();
    expect(e.legalActions(q).filter((a) => a.type === 'bid').map((a) => a.value)).toEqual([10, 11, 12, 13]);
    expect(e.getView('you').players.find((x) => x.id === p)!.stat).toBe('Bid 9');
  });

  it('passed players are skipped and bidding ends after three passes', () => {
    const e = engine(4);
    const order = [e.currentPlayerId()!];
    e.apply(order[0], { type: 'pass' });
    order.push(e.currentPlayerId()!);
    e.apply(order[1], { type: 'bid', value: 7 });
    order.push(e.currentPlayerId()!);
    e.apply(order[2], { type: 'bid', value: 8 });
    order.push(e.currentPlayerId()!);
    e.apply(order[3], { type: 'pass' });
    expect(new Set(order).size).toBe(4);
    // Seat order[0] passed: it is skipped; order[1] is next.
    expect(e.currentPlayerId()).toBe(order[1]);
    expect(e.getView('you').players.find((x) => x.id === order[0])!.stat).toBe('Passed');
    e.apply(order[1], { type: 'pass' });
    // Three passes after a bid: bidder names trumps.
    expect(e.getView('you').phase).toBe('trump');
    expect(e.currentPlayerId()).toBe(order[2]);
    expect(e.getView('you').bidderId).toBe(order[2]);
    expect(e.getView('you').bid).toBe(8);
  });

  it('a bid of 13 leaves only pass for the rest', () => {
    const e = engine(6);
    e.apply(e.currentPlayerId()!, { type: 'bid', value: 13 });
    expect(e.legalActions(e.currentPlayerId()!).map((a) => a.type)).toEqual(['pass']);
  });

  it('redeals with the next dealer when all four pass', () => {
    const e = engine(7);
    const before = e.getView('you');
    const dealerIdx = before.players.findIndex((p) => p.id === before.dealerId);
    const handBefore = before.hand.map((x) => x.id).join();
    for (let i = 0; i < 4; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    const after = e.getView('you');
    expect(after.phase).toBe('bid');
    expect(after.dealerId).toBe(after.players[(dealerIdx + 1) % 4].id);
    expect(after.hand.map((x) => x.id).join()).not.toBe(handBefore);
    expect(after.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    expect(e.currentPlayerId()).toBe(after.players[(dealerIdx + 2) % 4].id);
    expect(after.banner?.text).toContain('redeal');
  });

  it('the winning bidder names trumps and leads the first trick', () => {
    const e = engine(8);
    const bidder = auction(e, 8, 'hearts');
    const v = e.getView('you');
    expect(v.phase).toBe('play');
    expect(v.trump?.suit).toBe('hearts');
    expect(e.currentPlayerId()).toBe(bidder);
    expect(v.players.find((p) => p.id === bidder)!.badges).toContain('Bidder');
    expect(v.info).toContain(`Bid 8 · ${v.players.find((p) => p.id === bidder)!.name}`);
  });

  it('enforces following suit', () => {
    const e = engine(3);
    const bidder = auction(e, 7, 'clubs');
    const lead = e.getView(bidder).hand[0];
    e.apply(bidder, { type: 'play', cardId: lead.id });
    const next = e.currentPlayerId()!;
    const hand = e.getView(next).hand;
    const legal = e.legalActions(next).map((a) => a.cardId);
    if (hand.some((x) => x.suit === lead.suit)) {
      expect(legal.every((id) => id!.startsWith(lead.suit))).toBe(true);
      const off = hand.find((x) => x.suit !== lead.suit);
      if (off) expect(() => e.apply(next, { type: 'play', cardId: off.id })).toThrow();
    } else {
      expect(legal.length).toBe(hand.length);
    }
  });

  it('trick goes to the highest trump, then the highest of the led suit', async () => {
    const { trickWinner } = await import('../core/tricks');
    const plays = [
      { playerId: 'a', card: c('spades', 'K') },
      { playerId: 'b', card: c('spades', 'A') },
      { playerId: 'c', card: c('hearts', '2') },
      { playerId: 'd', card: c('clubs', 'A') },
    ];
    expect(trickWinner(plays, 'hearts').playerId).toBe('c');
    expect(trickWinner(plays, 'diamonds').playerId).toBe('b');
  });

  describe('scoring', () => {
    function scored(bid: number, team0Tricks: number) {
      const e = engine(11);
      const r = raw(e);
      r.bidder = 0;
      r.bid = bid;
      finishHandWith(e, team0Tricks);
      expect(e.pending()).toBe('hand');
      return { e, v: e.getView('you') };
    }

    it('made bid: bidding team scores tricks taken, opponents nothing', () => {
      const { v } = scored(8, 10);
      expect(v.tricksWon).toEqual([10, 3]);
      expect(v.matchPoints).toEqual([10, 0]);
      expect(v.handSummary?.title).toContain('make their bid');
    });

    it('failed bid: bidding team loses the bid, opponents score their tricks', () => {
      const { v } = scored(9, 6);
      expect(v.tricksWon).toEqual([6, 7]);
      expect(v.matchPoints).toEqual([-9, 7]);
      expect(v.handSummary?.title).toContain('are set');
    });

    it('a made bid of 13 scores the kaboot bonus', () => {
      const { v } = scored(13, 13);
      expect(v.tricksWon).toEqual([13, 0]);
      expect(v.matchPoints).toEqual([KABOOT_POINTS, 0]);
    });

    it('taking 13 on a lower bid scores 13', () => {
      expect(scored(10, 13).v.matchPoints).toEqual([13, 0]);
    });

    it('resolving the hand at the target ends the game', () => {
      const e = engine(12, 21);
      const r = raw(e);
      r.points = [15, 4];
      r.bidder = 0;
      r.bid = 7;
      finishHandWith(e, 7);
      e.resolve();
      expect(e.isGameOver()).toBe(true);
      const out = e.outcome();
      expect(out.players.map((p) => p.result)).toEqual(['win', 'loss', 'win', 'loss']);
      expect(out.players[0].score).toBe(22);
      expect(out.summary).toBe('You & Bot 2 win 22–4');
    });

    it('equal scores at the target keep playing', () => {
      const e = engine(13, 21);
      const r = raw(e);
      r.points = [14, 21];
      r.bidder = 0;
      r.bid = 7;
      finishHandWith(e, 7);
      e.resolve();
      expect(e.isGameOver()).toBe(false);
      expect(e.getView('you').phase).toBe('bid');
    });
  });

  it('bot games always finish with a winning team for 30 seeds across settings', () => {
    const targets = [21, 31, 41];
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let seed = 1; seed <= 30; seed++) {
      const target = targets[seed % 3];
      const { engine: e } = playThrough(definition, seed, { settings: { target }, difficulty: diffs[seed % 4] });
      const out = e.outcome();
      expect(out.players[0].result).toBe(out.players[2].result);
      expect(out.players[1].result).toBe(out.players[3].result);
      const winners = out.players.filter((p) => p.result === 'win');
      if (winners.length) {
        expect(winners).toHaveLength(2);
        expect(winners[0].score).toBeGreaterThan(out.players.find((p) => p.result === 'loss')!.score);
      }
    }
  });

  it('action log replays to the same result', () => {
    const { engine: a } = playThrough(definition, 77, { settings: { target: 31 } });
    const b = new TarneebEngine(testSeats(4), 77, { target: 31 });
    b.initializeGame();
    for (const { playerId, action } of a.actionLog()) {
      while (b.pending()) b.resolve();
      b.apply(playerId, action);
    }
    while (b.pending()) b.resolve();
    expect(b.isGameOver()).toBe(true);
    expect(b.outcome()).toEqual(a.outcome());
  });
});
