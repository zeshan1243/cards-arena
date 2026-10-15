import { describe, expect, it } from 'vitest';
import { Card, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { estimateTricks, nilCandidate } from './spades.bot';
import { definition } from './spades.definition';
import { MAX_HANDS, SpadesEngine, matchResult, scoreTeam } from './spades.engine';

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });

function engine(seed = 1, target = 300) {
  const e = new SpadesEngine(testSeats(4), seed, { target });
  e.initializeGame();
  return e;
}

/** Everyone bids in turn. */
function bidAll(e: SpadesEngine, values: number[]) {
  for (const v of values) e.apply(e.currentPlayerId()!, { type: 'bid', value: v });
}

/** Internal state access for scenario tests. */
type Internals = { hands: Card[][]; broken: boolean; turn: number; dealer: number; scores: [number, number]; bags: [number, number] };
const internals = (e: SpadesEngine) => e as unknown as Internals;

describe('Spades engine', () => {
  it('deals 13 unique cards each and starts bidding left of the dealer', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('bid');
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    const all = v.players.flatMap((p) => e.getView(p.id).hand.map((x) => x.id));
    expect(new Set(all).size).toBe(52);
    const dealer = v.players.findIndex((p) => p.id === v.dealerId);
    expect(e.currentPlayerId()).toBe(v.players[(dealer + 1) % 4].id);
    expect(v.trump).toEqual({ suit: 'spades', hidden: false, label: 'Trumps ♠' });
    expect(v.players[dealer].badges).toContain('Dealer');
  });

  it('never leaks other hands', () => {
    const e = engine(4);
    const v = e.getView('you');
    expect(v.hand).toHaveLength(13);
    for (const p of ['bot-1', 'bot-2', 'bot-3']) {
      const theirs = new Set(e.getView(p).hand.map((x) => x.id));
      expect(v.hand.some((x) => theirs.has(x.id))).toBe(false);
    }
  });

  it('offers bids 0–13 with Nil label and enforces turn order', () => {
    const e = engine();
    const id = e.currentPlayerId()!;
    const legal = e.legalActions(id);
    expect(legal.map((a) => a.value)).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(legal[0].label).toBe('Nil');
    expect(legal[13].label).toBe('Bid 13');
    expect(() => e.apply(id, { type: 'bid', value: 14 })).toThrow();
    const other = e.getView('you').players.find((p) => p.id !== id)!.id;
    expect(() => e.apply(other, { type: 'bid', value: 3 })).toThrow('Not your turn');
    e.apply(id, { type: 'bid', value: 0 });
    const seat = e.getView('you').players.find((p) => p.id === id)!;
    expect(seat.stat).toBe('Nil · Won 0');
    expect(seat.badges).toContain('Nil');
  });

  it('after bidding, the player left of the dealer leads', () => {
    const e = engine(2);
    const first = e.currentPlayerId();
    bidAll(e, [3, 3, 3, 3]);
    expect(e.getView('you').phase).toBe('play');
    expect(e.currentPlayerId()).toBe(first);
    expect(e.getView('you').players.every((p) => p.stat === 'Bid 3 · Won 0')).toBe(true);
  });

  it('spades may not be led until broken, unless the leader holds only spades', () => {
    const e = engine(3);
    bidAll(e, [3, 3, 3, 3]);
    const leader = e.currentPlayerId()!;
    const seat = testSeats(4).findIndex((s) => s.id === leader);
    const st = internals(e);
    st.hands[seat] = [c('spades', 'A'), c('hearts', '2'), c('clubs', '3')];
    expect(e.legalActions(leader).map((a) => a.cardId)).toEqual(['hearts-2', 'clubs-3']);
    expect(e.getView(leader).phaseLabel).toContain('spades not broken yet');
    st.hands[seat] = [c('spades', 'A'), c('spades', '2')];
    expect(e.legalActions(leader).map((a) => a.cardId)).toEqual(['spades-A', 'spades-2']);
    st.hands[seat] = [c('spades', 'A'), c('hearts', '2')];
    st.broken = true;
    expect(e.legalActions(leader).map((a) => a.cardId).sort()).toEqual(['hearts-2', 'spades-A']);
  });

  it('a spade discard breaks spades and the highest spade wins', () => {
    const e = engine(5);
    bidAll(e, [3, 3, 3, 3]);
    const st = internals(e);
    const lead = st.turn;
    st.hands = [[], [], [], []];
    st.hands[lead] = [c('hearts', 'K'), c('clubs', '2')];
    st.hands[(lead + 1) % 4] = [c('hearts', 'A'), c('clubs', '3')];
    st.hands[(lead + 2) % 4] = [c('spades', '2'), c('clubs', '4')];
    st.hands[(lead + 3) % 4] = [c('hearts', '3'), c('clubs', '5')];
    const ids = testSeats(4).map((s) => s.id);
    e.apply(ids[lead], { type: 'play', cardId: 'hearts-K' });
    // follow suit enforced
    expect(e.legalActions(ids[(lead + 1) % 4]).map((a) => a.cardId)).toEqual(['hearts-A']);
    e.apply(ids[(lead + 1) % 4], { type: 'play', cardId: 'hearts-A' });
    expect(e.legalActions(ids[(lead + 2) % 4]).map((a) => a.cardId).sort()).toEqual(['clubs-4', 'spades-2']);
    e.apply(ids[(lead + 2) % 4], { type: 'play', cardId: 'spades-2' });
    expect(e.getView('you').spadesBroken).toBe(true);
    expect(e.getView('you').banner?.text).toBe('Spades broken!');
    e.apply(ids[(lead + 3) % 4], { type: 'play', cardId: 'hearts-3' });
    expect(e.pending()).toBe('trick');
    expect(e.getView('you').trickWinnerId).toBe(ids[(lead + 2) % 4]);
    e.resolve();
    expect(e.currentPlayerId()).toBe(ids[(lead + 2) % 4]);
    expect(e.getView('you').info).toContain('Spades broken');
  });

  it('scores made contracts, overtricks and sets', () => {
    // seats 0 & 2 bid 3 + 2; took 4 + 2
    const made = scoreTeam([3, 4, 2, 4], [4, 1, 2, 6], [0, 2], 0);
    expect(made).toMatchObject({ contract: 5, tricks: 6, made: true, newBags: 1, contractPoints: 51, delta: 51, bags: 1 });
    const exact = scoreTeam([3, 4, 2, 4], [3, 1, 2, 7], [0, 2], 0);
    expect(exact.delta).toBe(50);
    const set = scoreTeam([3, 4, 2, 4], [4, 1, 2, 6], [1, 3], 0);
    expect(set).toMatchObject({ contract: 8, tricks: 7, made: false, contractPoints: -80, delta: -80, newBags: 0 });
  });

  it('scores nil success and failure (nil tricks count toward the team)', () => {
    // seat 0 nil and takes nothing, partner bids 4 takes 5
    const ok = scoreTeam([0, 4, 4, 5], [0, 4, 5, 4], [0, 2], 0);
    expect(ok).toMatchObject({ nilMade: 1, nilPoints: 100, contractPoints: 41, delta: 141 });
    // nil fails with 2 tricks; partner's 3 + nil's 2 = 5 ≥ 4
    const bad = scoreTeam([0, 4, 4, 5], [2, 4, 3, 4], [0, 2], 0);
    expect(bad).toMatchObject({ nilFailed: 1, nilPoints: -100, contractPoints: 41, delta: -59, newBags: 1 });
    // double nil: no contract, no bags
    const dbl = scoreTeam([0, 6, 0, 7], [0, 6, 1, 6], [0, 2], 3);
    expect(dbl).toMatchObject({ contract: 0, contractPoints: 0, nilPoints: 0, newBags: 0, bags: 3, delta: 0 });
  });

  it('applies the bag penalty every 10 bags', () => {
    const r = scoreTeam([2, 1, 2, 1], [5, 1, 5, 2], [0, 2], 8);
    expect(r).toMatchObject({ newBags: 6, contractPoints: 46, bagPenalties: 1, bags: 4, delta: -54 });
  });

  it('match end: target, −200 floor, ties play on, hard cap', () => {
    expect(matchResult([250, 100], [0, 0], 300, 5)).toBeNull();
    expect(matchResult([310, 100], [0, 0], 300, 5)).toBe(0);
    expect(matchResult([310, 320], [0, 0], 300, 5)).toBe(1);
    expect(matchResult([50, -200], [0, 0], 300, 5)).toBe(0);
    expect(matchResult([-210, -250], [0, 0], 300, 5)).toBe(0);
    expect(matchResult([300, 300], [0, 0], 300, 5)).toBeNull();
    expect(matchResult([100, 100], [3, 1], 300, MAX_HANDS)).toBe(1);
    expect(matchResult([100, 100], [2, 2], 300, MAX_HANDS)).toBe('draw');
  });

  it('a hand ends with a summary and scores update', () => {
    const e = engine(9);
    let guard = 0;
    while (e.pending() !== 'hand' && guard++ < 200) {
      if (e.pending()) { e.resolve(); continue; }
      const id = e.currentPlayerId()!;
      e.apply(id, definition.bot(e.getView(id), e.legalActions(id), null, { difficulty: 'normal', personality: 'strategic' }, Math.random));
    }
    const v = e.getView('you');
    expect(v.tricksTaken.reduce((a, b) => a + b, 0)).toBe(13);
    expect(v.handSummary?.lines.length).toBeGreaterThan(2);
    expect(v.players.every((p) => p.cardCount === 0)).toBe(true);
  });

  it('bot nil heuristics', () => {
    const weak = [c('spades', '2'), c('spades', '5'), c('hearts', '3'), c('hearts', '6'), c('hearts', '9'), c('clubs', '2'), c('clubs', '4'), c('clubs', '7'), c('clubs', '10'), c('diamonds', '3'), c('diamonds', '5'), c('diamonds', '8'), c('diamonds', 'J')];
    expect(nilCandidate(weak)).toBe(true);
    expect(estimateTricks(weak)).toBe(0);
    const strong = [c('spades', 'A'), c('spades', 'K'), c('spades', 'Q'), c('spades', '9'), c('spades', '5'), c('hearts', 'A'), c('hearts', '6'), c('clubs', 'K'), c('clubs', '4'), c('diamonds', '3'), c('diamonds', '5'), c('diamonds', '8'), c('diamonds', 'J')];
    expect(nilCandidate(strong)).toBe(false);
    expect(estimateTricks(strong)).toBeGreaterThanOrEqual(6);
  });

  it('bot games always finish with a valid winner across settings and difficulties', () => {
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    const targets = [200, 300, 500];
    let nils = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const target = targets[seed % 3];
      const { engine: e } = playThrough(definition, seed, { settings: { target }, difficulty: diffs[seed % 4] });
      nils += e.actionLog().filter((l) => l.action.type === 'bid' && l.action.value === 0).length;
      const out = e.outcome();
      expect(out.players[0].result).toBe(out.players[2].result);
      expect(out.players[1].result).toBe(out.players[3].result);
      const v = e.getView('you');
      if (out.players[0].result !== 'draw') {
        const w = out.players.find((p) => p.result === 'win')!;
        const l = out.players.find((p) => p.result === 'loss')!;
        expect(w.score).toBeGreaterThan(l.score);
        const reached = w.score >= target || l.score <= -200 || v.handNumber >= MAX_HANDS;
        expect(reached).toBe(true);
        expect(out.summary).toMatch(/win -?\d+–-?\d+/);
      }
      expect(v.status).toBe('finished');
    }
    expect(nils).toBeGreaterThan(0);
  });

  it('action log replays to the same result', () => {
    const { engine: a } = playThrough(definition, 77, { settings: { target: 200 } });
    const b = new SpadesEngine(testSeats(4), 77, { target: 200 });
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
