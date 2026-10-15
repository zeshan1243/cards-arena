import { describe, expect, it } from 'vitest';
import { Card, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { TrickPlay } from '../core/table-game';
import { trickWinner } from '../core/tricks';
import { estimateCall } from './call-break.bot';
import { definition } from './call-break.definition';
import { CallBreakEngine, formatTenths, legalCards, roundScore } from './call-break.engine';

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });
const t = (...cards: Card[]): TrickPlay[] => cards.map((card, i) => ({ playerId: `p${i}`, card }));
const ids = (cards: Card[]) => cards.map((x) => x.id).sort();
const profile = { difficulty: 'normal', personality: 'strategic' } as const;

function engine(seed = 1, rounds = 3) {
  const e = new CallBreakEngine(testSeats(4), seed, { rounds });
  e.initializeGame();
  return e;
}

function callAll(e: CallBreakEngine, value = 2) {
  for (let i = 0; i < 4; i++) e.apply(e.currentPlayerId()!, { type: 'bid', value });
}

describe('Call Break engine', () => {
  it('deals 13 unique cards each and starts calling after the dealer', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('bid');
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    const all = v.players.flatMap((p) => e.getView(p.id).hand.map((x) => x.id));
    expect(new Set(all).size).toBe(52);
    const dealer = v.players.findIndex((p) => p.id === v.dealerId);
    expect(e.currentPlayerId()).toBe(v.players[(dealer + 1) % 4].id);
    expect(v.players[dealer].badges).toContain('Dealer');
    expect(v.trump).toEqual({ suit: 'spades', hidden: false, label: 'Trumps ♠' });
    expect(v.players.every((p) => p.team === null)).toBe(true);
  });

  it('never leaks other hands', () => {
    const e = engine(4);
    const v = e.getView('you');
    const mine = new Set(v.hand.map((x) => x.id));
    expect(v.hand).toHaveLength(13);
    for (const p of v.players.slice(1)) for (const x of e.getView(p.id).hand) expect(mine.has(x.id)).toBe(false);
  });

  it('offers calls 1–8 and rejects others', () => {
    const e = engine();
    const id = e.currentPlayerId()!;
    const legal = e.legalActions(id);
    expect(legal.map((a) => a.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(legal[2].label).toBe('Call 3');
    expect(() => e.apply(id, { type: 'bid', value: 0 })).toThrow();
    expect(() => e.apply(id, { type: 'bid', value: 9 })).toThrow();
    expect(() => e.apply(id, { type: 'play', cardId: e.getView(id).hand[0].id })).toThrow();
  });

  it('after all four calls the player after the dealer leads', () => {
    const e = engine(2);
    const first = e.currentPlayerId()!;
    callAll(e, 3);
    const v = e.getView('you');
    expect(v.phase).toBe('play');
    expect(e.currentPlayerId()).toBe(first);
    expect(v.players.every((p) => p.stat === 'Call 3 · Won 0')).toBe(true);
    expect(() => e.apply(v.players.find((p) => p.id !== first)!.id, { type: 'play', cardId: 'spades-2' })).toThrow('Not your turn');
  });

  describe('legal plays', () => {
    it('leading: anything goes (including spades)', () => {
      const hand = [c('spades', '2'), c('hearts', '5'), c('clubs', 'A')];
      expect(ids(legalCards(hand, []))).toEqual(ids(hand));
    });

    it('must follow suit and beat the highest card of the led suit if able', () => {
      const hand = [c('hearts', '4'), c('hearts', 'Q'), c('hearts', 'A'), c('spades', 'K'), c('clubs', '3')];
      expect(ids(legalCards(hand, t(c('hearts', '10'))))).toEqual(ids([c('hearts', 'Q'), c('hearts', 'A')]));
      // Must beat the *highest* card of the led suit, not just the lead.
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('hearts', 'K'))))).toEqual(ids([c('hearts', 'A')]));
      // Off-suit non-trump cards don't count.
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('clubs', 'A'))))).toEqual(ids([c('hearts', 'Q'), c('hearts', 'A')]));
    });

    it('follows with any card of the suit when unable to beat', () => {
      const hand = [c('hearts', '4'), c('hearts', '9'), c('spades', 'A')];
      expect(ids(legalCards(hand, t(c('hearts', 'K'))))).toEqual(ids([c('hearts', '4'), c('hearts', '9')]));
    });

    it('no must-beat once a spade has trumped the trick', () => {
      const hand = [c('hearts', '4'), c('hearts', 'A')];
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('spades', '2'))))).toEqual(ids(hand));
    });

    it('spades led: must beat the highest spade', () => {
      const hand = [c('spades', '3'), c('spades', 'J'), c('hearts', 'A')];
      expect(ids(legalCards(hand, t(c('spades', '9'))))).toEqual(ids([c('spades', 'J')]));
      expect(ids(legalCards(hand, t(c('spades', 'Q'))))).toEqual(ids([c('spades', '3'), c('spades', 'J')]));
    });

    it('void in the led suit: must play a spade', () => {
      const hand = [c('spades', '3'), c('spades', 'J'), c('clubs', 'A'), c('diamonds', '2')];
      expect(ids(legalCards(hand, t(c('hearts', '10'))))).toEqual(ids([c('spades', '3'), c('spades', 'J')]));
    });

    it('void in the led suit: must over-trump if able, else any spade', () => {
      const hand = [c('spades', '3'), c('spades', 'J'), c('clubs', 'A')];
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('spades', '9'))))).toEqual(ids([c('spades', 'J')]));
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('spades', 'Q'))))).toEqual(ids([c('spades', '3'), c('spades', 'J')]));
    });

    it('void in the led suit and in spades: play anything', () => {
      const hand = [c('clubs', '3'), c('diamonds', 'K')];
      expect(ids(legalCards(hand, t(c('hearts', '10'), c('spades', '9'))))).toEqual(ids(hand));
    });

    it('engine enforces the rules on concrete hands', () => {
      const e = engine(9);
      callAll(e, 2);
      const leader = e.currentPlayerId()!;
      const seats = e.getView('you').players.map((p) => p.id);
      const li = seats.indexOf(leader);
      // Rig the hands (test-only access to private state).
      const hands: Card[][] = [[], [], [], []];
      hands[li] = [c('hearts', '10'), c('clubs', '2')];
      hands[(li + 1) % 4] = [c('hearts', '4'), c('hearts', 'Q')];
      hands[(li + 2) % 4] = [c('spades', '5'), c('diamonds', 'A')];
      hands[(li + 3) % 4] = [c('spades', '3'), c('spades', '9'), c('clubs', 'K')];
      (e as unknown as { hands: Card[][] }).hands = hands;

      e.apply(leader, { type: 'play', cardId: 'hearts-10' });
      const p1 = seats[(li + 1) % 4];
      expect(e.legalActions(p1).map((a) => a.cardId)).toEqual(['hearts-Q']);
      expect(() => e.apply(p1, { type: 'play', cardId: 'hearts-4' })).toThrow();
      e.apply(p1, { type: 'play', cardId: 'hearts-Q' });
      const p2 = seats[(li + 2) % 4];
      expect(e.legalActions(p2).map((a) => a.cardId)).toEqual(['spades-5']);
      e.apply(p2, { type: 'play', cardId: 'spades-5' });
      const p3 = seats[(li + 3) % 4];
      expect(e.legalActions(p3).map((a) => a.cardId)).toEqual(['spades-9']);
      e.apply(p3, { type: 'play', cardId: 'spades-9' });
      expect(e.pending()).toBe('trick');
      expect(e.getView('you').trickWinnerId).toBe(p3);
      e.resolve();
      expect(e.currentPlayerId()).toBe(p3);
      expect(e.getView('you').tricksWon[(li + 3) % 4]).toBe(1);
    });
  });

  it('highest spade wins, else highest of the led suit', () => {
    expect(trickWinner(t(c('hearts', '10'), c('hearts', 'A'), c('spades', '2'), c('clubs', 'A')), 'spades').playerId).toBe('p2');
    expect(trickWinner(t(c('hearts', '10'), c('hearts', 'A'), c('diamonds', 'A'), c('clubs', 'A')), 'spades').playerId).toBe('p1');
  });

  it('scores in tenths', () => {
    expect(roundScore(3, 3)).toBe(30);
    expect(roundScore(4, 5)).toBe(41);
    expect(roundScore(2, 6)).toBe(24);
    expect(roundScore(5, 4)).toBe(-50);
    expect(roundScore(1, 0)).toBe(-10);
    expect(formatTenths(41)).toBe('4.1');
    expect(formatTenths(-30)).toBe('-3');
    expect(formatTenths(0)).toBe('0');
    expect(formatTenths(-29)).toBe('-2.9');
  });

  it('dealer rotates clockwise each round and the game ends after the last round', () => {
    const e = engine(11, 5);
    const seats = e.getView('you').players.map((p) => p.id);
    const dealers: number[] = [seats.indexOf(e.getView('you').dealerId)];
    let guard = 0;
    while (!e.isGameOver() && guard++ < 2000) {
      if (e.pending() === 'hand') {
        const v = e.getView('you');
        expect(v.handSummary).not.toBeNull();
        expect(v.handSummary!.lines).toHaveLength(5);
        // Round scores add up to the totals.
        for (let i = 0; i < 4; i++) expect(v.roundScores.reduce((n, r) => n + r[i], 0)).toBe(v.totals[i]);
        e.resolve();
        if (!e.isGameOver()) dealers.push(seats.indexOf(e.getView('you').dealerId));
        continue;
      }
      if (e.pending()) { e.resolve(); continue; }
      const id = e.currentPlayerId()!;
      e.apply(id, definition.bot(e.getView(id), e.legalActions(id), null, profile, Math.random));
    }
    expect(e.isGameOver()).toBe(true);
    expect(dealers).toHaveLength(5);
    for (let i = 1; i < 5; i++) expect(dealers[i]).toBe((dealers[i - 1] + 1) % 4);
    expect(e.getView('you').scores.columns).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'Total']);
  });

  it('bot calls are in range and sensible', () => {
    const strong = [c('spades', 'A'), c('spades', 'K'), c('spades', 'Q'), c('spades', 'J'), c('spades', '10'), c('hearts', 'A'), c('clubs', 'A'), c('diamonds', 'A'),
      c('hearts', '2'), c('clubs', '2'), c('diamonds', '2'), c('hearts', '3'), c('clubs', '3')];
    const weak = [c('hearts', '2'), c('hearts', '3'), c('hearts', '4'), c('hearts', '5'), c('clubs', '2'), c('clubs', '3'), c('clubs', '4'),
      c('diamonds', '2'), c('diamonds', '3'), c('diamonds', '4'), c('diamonds', '5'), c('diamonds', '6'), c('spades', '2')];
    expect(estimateCall(strong)).toBeGreaterThanOrEqual(7);
    expect(estimateCall(weak)).toBe(1);
  });

  it('bot games always finish, across settings and difficulties', () => {
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let seed = 1; seed <= 30; seed++) {
      const rounds = seed % 2 ? 3 : 5;
      const { engine: e } = playThrough(definition, seed, { settings: { rounds }, difficulty: diffs[seed % 4] });
      const out = e.outcome();
      const v = e.getView('you');
      expect(v.roundScores).toHaveLength(rounds);
      expect(out.players.map((p) => p.score)).toEqual(v.totals);
      const best = Math.max(...v.totals);
      for (const p of out.players) {
        expect(Number.isInteger(p.score)).toBe(true);
        expect(p.position).toBe(1 + out.players.filter((o) => o.score > p.score).length);
        if (p.score === best) expect(['win', 'draw']).toContain(p.result);
      }
      expect(out.players.filter((p) => p.result === 'win').length).toBeLessThanOrEqual(1);
    }
  });

  it('action log replays to the same result', () => {
    for (const seed of [77, 78]) {
      const { engine: a } = playThrough(definition, seed, { settings: { rounds: 5 } });
      const b = new CallBreakEngine(testSeats(4), seed, { rounds: 5 });
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
});
