import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { seededRng } from '../core/deck';
import { TrickPlay } from '../core/table-game';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './hearts.definition';
import { HeartsEngine, PassDirection } from './hearts.engine';

const c = (suit: Suit, rank: Rank): Card => ({ id: cardId(suit, rank), suit, rank });
const ids = ['you', 'bot-1', 'bot-2', 'bot-3'];
const profile = { difficulty: 'hard', personality: 'strategic' } as const;

/** Private engine state, for crafting positions in tests. */
interface Internals {
  hands: Card[][];
  phase: 'pass' | 'play';
  turn: number | null;
  trick: TrickPlay[];
  tricksPlayed: number;
  heartsBroken: boolean;
  handPoints: number[];
  heartsTaken: number[];
  queenTaker: number | null;
  totals: number[];
  pendingState: 'trick' | 'hand' | null;
  lastWinner: string | null;
  endHand(): void;
}
const inner = (e: HeartsEngine) => e as unknown as Internals;

function engine(seed = 1, target = 50) {
  const e = new HeartsEngine(testSeats(4), seed, { target });
  e.initializeGame();
  return e;
}

/** Advance with bots until hand `n` has just started (before any action in it). */
function toHand(e: HeartsEngine, n: number) {
  const rng = seededRng(99);
  while (e.getView('you').handNumber < n) {
    if (e.pending()) {
      e.resolve();
      continue;
    }
    const id = e.currentPlayerId()!;
    e.apply(id, definition.bot(e.getView(id), e.legalActions(id), e.cardSelection(id), profile, rng));
  }
}

/** Put the engine directly into the play phase with the given hands. */
function craft(hands: Card[][], opts: Partial<Internals> = {}) {
  const e = engine();
  Object.assign(inner(e), { hands, phase: 'play', trick: [], tricksPlayed: 0, heartsBroken: false, ...opts });
  if (inner(e).turn === null || opts.turn === undefined) inner(e).turn = hands.findIndex((h) => h.some((x) => x.id === 'clubs-2'));
  return e;
}

describe('Hearts engine — passing', () => {
  it('deals 13 each and asks seat 0 to pass 3 cards left', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('pass');
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    expect(v.players.every((p) => p.team === null)).toBe(true);
    expect(e.currentPlayerId()).toBe('you');
    expect(e.legalActions('you')).toEqual([]);
    expect(e.cardSelection('you')).toEqual({ count: 3, label: 'Pass 3 cards left', actionType: 'pass-cards' });
    expect(e.cardSelection('bot-1')).toBeNull();
    expect(v.phaseLabel).toBe('Choose 3 cards to pass left');
  });

  it('cycles pass direction left, right, across, hold', () => {
    const e = engine(4, 100);
    const seen: PassDirection[] = [];
    for (let n = 1; n <= 5; n++) {
      toHand(e, n);
      seen.push(e.getView('you').passDirection);
    }
    expect(seen).toEqual(['left', 'right', 'across', 'hold', 'left']);
  });

  for (const [hand, dir, offset] of [
    [1, 'left', 1],
    [2, 'right', 3],
    [3, 'across', 2],
  ] as const) {
    it(`exchanges cards ${dir} only after all four have chosen`, () => {
      const e = engine(11, 100);
      toHand(e, hand);
      expect(e.cardSelection('you')?.label).toBe(`Pass 3 cards ${dir}`);
      const chosen: string[][] = [];
      for (let s = 0; s < 4; s++) {
        expect(e.currentPlayerId()).toBe(ids[s]);
        const pick = e.getView(ids[s]).hand.slice(0, 3).map((x) => x.id);
        chosen.push(pick);
        e.apply(ids[s], { type: 'pass-cards', cardIds: pick });
        if (s < 3) {
          // Not exchanged yet: the passer no longer holds them, nobody has received them.
          expect(e.getView('you').phase).toBe('pass');
          expect(e.getView(ids[s]).players[s].badges).toContain('Passed');
          expect(e.getView(ids[(s + offset) % 4]).hand.some((x) => pick.includes(x.id))).toBe(false);
        }
      }
      expect(e.getView('you').phase).toBe('play');
      for (let s = 0; s < 4; s++) {
        const receiver = e.getView(ids[(s + offset) % 4]);
        expect(receiver.hand.length).toBe(13);
        for (const id of chosen[s]) expect(receiver.hand.some((x) => x.id === id)).toBe(true);
        expect(receiver.received!.map((x) => x.id).sort()).toEqual([...chosen[s]].sort());
        expect(e.getView(ids[s]).hand.some((x) => chosen[s].includes(x.id))).toBe(false);
      }
      expect(e.getView('you').banner?.text).toMatch(/^You received /);
    });
  }

  it('skips passing on the hold hand', () => {
    const e = engine(12, 100);
    toHand(e, 4);
    const v = e.getView('you');
    expect(v.phase).toBe('play');
    expect(v.info).toContain('No pass');
    expect(e.cardSelection(e.currentPlayerId()!)).toBeNull();
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
  });

  it('validates pass-cards actions', () => {
    const e = engine(2);
    const hand = e.getView('you').hand.map((x) => x.id);
    const other = e.getView('bot-1').hand[0].id;
    expect(() => e.apply('you', { type: 'pass-cards', cardIds: hand.slice(0, 2) })).toThrow();
    expect(() => e.apply('you', { type: 'pass-cards', cardIds: hand.slice(0, 4) })).toThrow();
    expect(() => e.apply('you', { type: 'pass-cards', cardIds: [hand[0], hand[0], hand[1]] })).toThrow();
    expect(() => e.apply('you', { type: 'pass-cards', cardIds: [hand[0], hand[1], other] })).toThrow();
    expect(() => e.apply('you', { type: 'play', cardId: hand[0] })).toThrow();
    expect(() => e.apply('bot-1', { type: 'pass-cards', cardIds: e.getView('bot-1').hand.slice(0, 3).map((x) => x.id) })).toThrow('Not your turn');
    e.apply('you', { type: 'pass-cards', cardIds: hand.slice(0, 3) });
    expect(e.currentPlayerId()).toBe('bot-1');
  });
});

describe('Hearts engine — play', () => {
  it('the 2♣ holder leads it to the first trick', () => {
    const e = engine(5);
    for (let s = 0; s < 4; s++) e.apply(ids[s], { type: 'pass-cards', cardIds: e.getView(ids[s]).hand.slice(-3).map((x) => x.id) });
    const leader = e.currentPlayerId()!;
    expect(e.getView(leader).hand.some((x) => x.id === 'clubs-2')).toBe(true);
    expect(e.legalActions(leader).map((a) => a.cardId)).toEqual(['clubs-2']);
    expect(e.getView('you').phaseLabel).toContain('2♣ leads');
  });

  it('forbids hearts and the Q♠ on the first trick unless there is nothing else', () => {
    const e = craft([
      [c('clubs', '2'), c('clubs', '3')],
      [c('hearts', 'A'), c('spades', 'Q'), c('diamonds', '5')],
      [c('hearts', '4'), c('spades', 'Q')].map((x, i) => (i === 1 ? c('hearts', '9') : x)),
      [c('clubs', 'K')],
    ]);
    e.apply('you', { type: 'play', cardId: 'clubs-2' });
    expect(e.legalActions('bot-1').map((a) => a.cardId)).toEqual(['diamonds-5']);
    expect(() => e.apply('bot-1', { type: 'play', cardId: 'spades-Q' })).toThrow();
    e.apply('bot-1', { type: 'play', cardId: 'diamonds-5' });
    // Only hearts left: they become legal.
    expect(e.legalActions('bot-2').map((a) => a.cardId).sort()).toEqual(['hearts-4', 'hearts-9']);
  });

  it('allows the Q♠ on the first trick when the hand holds only point cards', () => {
    const e = craft([[c('clubs', '2')], [c('spades', 'Q'), c('hearts', '3')], [c('clubs', '5')], [c('clubs', '6')]]);
    e.apply('you', { type: 'play', cardId: 'clubs-2' });
    expect(e.legalActions('bot-1').length).toBe(2);
  });

  it('allows discarding points after the first trick', () => {
    const e = craft([[c('clubs', '2')], [c('spades', 'Q'), c('diamonds', '3')], [c('clubs', '5')], [c('clubs', '6')]], { tricksPlayed: 1, turn: 0 });
    e.apply('you', { type: 'play', cardId: 'clubs-2' });
    expect(e.legalActions('bot-1').map((a) => a.cardId).sort()).toEqual(['diamonds-3', 'spades-Q']);
  });

  it('hearts may not be led until broken, unless the leader has only hearts', () => {
    const hands = () => [[c('hearts', '5'), c('diamonds', '7')], [c('clubs', '3')], [c('clubs', '4')], [c('clubs', '6')]];
    const a = craft(hands(), { tricksPlayed: 3, turn: 0 });
    expect(a.legalActions('you').map((x) => x.cardId)).toEqual(['diamonds-7']);
    expect(a.getView('you').phaseLabel).toContain('Hearts not broken yet');
    const b = craft(hands(), { tricksPlayed: 3, turn: 0, heartsBroken: true });
    expect(b.legalActions('you').length).toBe(2);
    const only = craft([[c('hearts', '5'), c('hearts', 'K')], [c('clubs', '3')], [c('clubs', '4')], [c('clubs', '6')]], { tricksPlayed: 3, turn: 0 });
    expect(only.legalActions('you').length).toBe(2);
  });

  it('a played heart breaks hearts', () => {
    const e = craft([[c('clubs', '7')], [c('hearts', '2')], [c('clubs', '4')], [c('clubs', '6')]], { tricksPlayed: 2, turn: 0 });
    e.apply('you', { type: 'play', cardId: 'clubs-7' });
    e.apply('bot-1', { type: 'play', cardId: 'hearts-2' });
    const v = e.getView('you');
    expect(v.heartsBroken).toBe(true);
    expect(v.banner?.text).toBe('Hearts broken!');
  });
});

describe('Hearts engine — scoring', () => {
  it('scores 1 per heart and 13 for the Q♠ to the trick winner', () => {
    const e = craft([[c('spades', 'K')], [c('spades', 'Q')], [c('hearts', '9')], [c('hearts', '2')]], { tricksPlayed: 5, turn: 0, heartsBroken: true });
    for (const [id, card] of [['you', 'spades-K'], ['bot-1', 'spades-Q'], ['bot-2', 'hearts-9'], ['bot-3', 'hearts-2']]) e.apply(id, { type: 'play', cardId: card });
    expect(e.pending()).toBe('trick');
    expect(e.getView('you').trickWinnerId).toBe('you');
    e.resolve();
    const v = e.getView('you');
    expect(v.handPoints).toEqual([15, 0, 0, 0]);
    expect(v.players[0].badges).toContain('Q♠');
    expect(v.players[0].stat).toBe('15 pts this hand');
    expect(v.banner?.text).toBe('You took the Queen of Spades');
    expect(e.currentPlayerId()).toBe('you');
  });

  it('adds hand points to totals at the end of the hand', () => {
    const e = engine();
    Object.assign(inner(e), { handPoints: [3, 13, 10, 0], heartsTaken: [3, 0, 10, 0], queenTaker: 1, totals: [0, 0, 0, 0] });
    inner(e).endHand();
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').totals).toEqual([3, 13, 10, 0]);
    expect(e.getView('you').handSummary?.lines).toContain('Q♠ taken by Bot 1');
    e.resolve();
    expect(e.isGameOver()).toBe(false);
    expect(e.getView('you').handNumber).toBe(2);
  });

  it('shooting the moon scores 0 for the shooter and 26 for everyone else', () => {
    const e = engine();
    Object.assign(inner(e), { handPoints: [0, 0, 26, 0], heartsTaken: [0, 0, 13, 0], queenTaker: 2, totals: [4, 10, 20, 0] });
    inner(e).endHand();
    const v = e.getView('you');
    expect(v.totals).toEqual([30, 36, 20, 26]);
    expect(v.handSummary?.title).toBe('Bot 2 shot the moon!');
    expect(v.banner?.text).toBe('Shot the moon!');
  });

  it('ends after the hand in which someone reaches the target; lowest total wins', () => {
    const e = engine();
    Object.assign(inner(e), { handPoints: [0, 13, 10, 3], heartsTaken: [0, 0, 10, 3], queenTaker: 1, totals: [30, 40, 20, 8] });
    inner(e).endHand();
    e.resolve();
    expect(e.isGameOver()).toBe(true);
    const out = e.outcome();
    expect(out.players.map((p) => p.score)).toEqual([30, 53, 30, 11]);
    expect(out.players.map((p) => p.position)).toEqual([2, 4, 2, 1]);
    expect(out.players.map((p) => p.result)).toEqual(['safe', 'loss', 'safe', 'win']);
    expect(out.summary).toBe('Bot 3 wins with 11 points');
  });

  it('a shared lowest total is a draw', () => {
    const e = engine();
    Object.assign(inner(e), { totals: [20, 20, 60, 55] });
    const out = e.outcome();
    expect(out.players.map((p) => p.result)).toEqual(['draw', 'draw', 'loss', 'safe']);
    expect(out.summary).toBe('You and Bot 1 tie with 20 points');
  });
});

describe('Hearts — full games', () => {
  it('bot games finish for many seeds, targets and difficulties', () => {
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let seed = 1; seed <= 32; seed++) {
      const target = seed % 2 ? 50 : 100;
      const { engine: e } = playThrough(definition, seed, { settings: { target }, difficulty: diffs[seed % 4] });
      const out = e.outcome();
      expect(Math.max(...out.players.map((p) => p.score))).toBeGreaterThanOrEqual(target);
      const best = Math.min(...out.players.map((p) => p.score));
      for (const p of out.players) if (p.score === best) expect(['win', 'draw']).toContain(p.result);
      // Every hand distributes 26 points (or 78 on a moon shot).
      const sum = out.players.reduce((n, p) => n + p.score, 0);
      expect(sum % 26).toBe(0);
    }
  });

  it('never leaks other hands in the view', () => {
    const e = engine(9);
    const v = e.getView('bot-2');
    const json = JSON.stringify(v);
    for (const card of e.getView('you').hand) expect(json.includes(`"${card.id}"`)).toBe(false);
  });

  it('action log replays to the same result', () => {
    const { engine: a } = playThrough(definition, 77, { settings: { target: 100 } });
    const b = new HeartsEngine(testSeats(4), 77, { target: 100 });
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
