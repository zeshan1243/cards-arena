import { describe, expect, it } from 'vitest';
import { Card, RANKS, Suit, cardId } from '../../shared/models/card.model';
import { seededRng } from '../core/deck';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './hokm.definition';
import { HokmEngine, handPoints, nextHakem } from './hokm.engine';

const suitCards = (suit: Suit): Card[] => RANKS.map((rank) => ({ id: cardId(suit, rank), suit, rank }));

function engine(seed = 1, target = 5) {
  const e = new HokmEngine(testSeats(4), seed, { target });
  e.initializeGame();
  return e;
}

const profile = { difficulty: 'normal', personality: 'strategic' } as const;

/** Bot-play one step (resolving trick pendings), stopping at a hand end. */
function playUntilHandEnd(e: HokmEngine, rng = seededRng(9)) {
  let guard = 0;
  while (e.pending() !== 'hand') {
    if (++guard > 1000) throw new Error('hand did not end');
    if (e.pending()) {
      e.resolve();
      continue;
    }
    const id = e.currentPlayerId()!;
    e.apply(id, definition.bot(e.getView(id), e.legalActions(id), null, profile, rng));
  }
}

/** After trumps are called, give the given team all spades + hearts and the other team clubs + diamonds. */
function rigHands(e: HokmEngine, strongTeam: number) {
  const strong = [...suitCards('spades'), ...suitCards('hearts')];
  const weak = [...suitCards('clubs'), ...suitCards('diamonds')];
  const hands: Card[][] = [[], [], [], []];
  for (let s = 0; s < 4; s++) {
    const pool = s % 2 === strongTeam ? strong : weak;
    hands[s] = pool.slice(s < 2 ? 0 : 13, s < 2 ? 13 : 26);
  }
  (e as unknown as { hands: Card[][] }).hands = hands;
}

describe('Hokm engine', () => {
  it('deals five cards each starting with the Hakem and asks the Hakem for trumps', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('trump');
    expect(v.players.map((p) => p.cardCount)).toEqual([5, 5, 5, 5]);
    expect(e.currentPlayerId()).toBe(v.hakemId);
    expect(v.players.find((p) => p.id === v.hakemId)!.badges).toContain('Hakem');
    expect(e.legalActions(v.hakemId).map((a) => a.suit)).toEqual(['spades', 'hearts', 'clubs', 'diamonds']);
    expect(e.legalActions(v.hakemId)[0].label).toBe('♠ Spades');
    expect(v.trump?.suit).toBeNull();
  });

  it('picks the first Hakem at random', () => {
    const hakems = new Set(Array.from({ length: 30 }, (_, s) => engine(s + 1).getView('you').hakemId));
    expect(hakems.size).toBeGreaterThan(1);
  });

  it('deals the rest after trumps are chosen: 13 each, 52 unique, Hakem leads', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const e = engine(seed);
      const hakem = e.getView('you').hakemId;
      const first5 = e.getView(hakem).hand.map((c) => c.id);
      e.apply(hakem, { type: 'trump', suit: 'hearts' });
      const v = e.getView('you');
      expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
      const all = v.players.flatMap((p) => e.getView(p.id).hand.map((x) => x.id));
      expect(new Set(all).size).toBe(52);
      expect(e.getView(hakem).hand.map((c) => c.id)).toEqual(expect.arrayContaining(first5));
      expect(v.trump?.suit).toBe('hearts');
      expect(v.phase).toBe('play');
      expect(e.currentPlayerId()).toBe(hakem);
      expect(v.banner?.text).toContain('Hearts');
    }
  });

  it('never leaks other players’ hands', () => {
    const e = engine(4);
    const v = e.getView('you');
    expect(v.hand.length).toBe(5);
    expect(JSON.stringify(v)).not.toContain('undealt');
  });

  it('rejects out-of-turn and illegal actions', () => {
    const e = engine();
    const hakem = e.getView('you').hakemId;
    const card = e.getView(hakem).hand[0].id;
    expect(() => e.apply(hakem, { type: 'play', cardId: card })).toThrow();
    const other = e.getView('you').players.find((p) => p.id !== hakem)!.id;
    expect(() => e.apply(other, { type: 'trump', suit: 'spades' })).toThrow('Not your turn');
    e.apply(hakem, { type: 'trump', suit: 'hearts' });
    expect(() => e.apply(hakem, { type: 'trump', suit: 'spades' })).toThrow();
    expect(() => e.apply(other, { type: 'play', cardId: e.getView(other).hand[0].id })).toThrow('Not your turn');
  });

  it('enforces following suit', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const e = engine(seed);
      const hakem = e.getView('you').hakemId;
      e.apply(hakem, { type: 'trump', suit: 'clubs' });
      const lead = e.getView(hakem).hand[0];
      e.apply(hakem, { type: 'play', cardId: lead.id });
      const next = e.currentPlayerId()!;
      const hand = e.getView(next).hand;
      const legal = e.legalActions(next).map((a) => a.cardId!);
      const offSuit = hand.find((x) => x.suit !== lead.suit);
      if (hand.some((x) => x.suit === lead.suit)) {
        expect(legal.every((id) => id.startsWith(lead.suit))).toBe(true);
        if (offSuit) expect(() => e.apply(next, { type: 'play', cardId: offSuit.id })).toThrow();
      } else {
        expect(legal.length).toBe(hand.length);
      }
    }
  });

  it('awards the trick to the highest trump, else the highest of the led suit', () => {
    const e = engine(2);
    const hakem = e.getView('you').hakemId;
    e.apply(hakem, { type: 'trump', suit: 'spades' });
    rigHands(e, 1 - (e.getView('you').players.findIndex((p) => p.id === hakem) % 2));
    // Hakem leads clubs/diamonds; opponents must trump (they hold only spades/hearts).
    const rng = seededRng(3);
    for (let i = 0; i < 4; i++) {
      const id = e.currentPlayerId()!;
      e.apply(id, definition.bot(e.getView(id), e.legalActions(id), null, profile, rng));
    }
    const v = e.getView('you');
    expect(e.pending()).toBe('trick');
    const spades = v.trick.filter((p) => p.card.suit === 'spades');
    const best = spades.sort((a, b) => RANKS.indexOf(b.card.rank) - RANKS.indexOf(a.card.rank))[0];
    expect(v.trickWinnerId).toBe(best ? best.playerId : null);
  });

  it('scoring helpers: 1 point, Kot 2, Hakem Kot 3', () => {
    expect(handPoints(0, 3, 0)).toBe(1);
    expect(handPoints(1, 6, 0)).toBe(1);
    expect(handPoints(0, 0, 0)).toBe(2);
    expect(handPoints(1, 0, 1)).toBe(2);
    expect(handPoints(1, 0, 0)).toBe(3);
    expect(handPoints(0, 0, 1)).toBe(3);
  });

  it('Hakem rotation: stays on a win, passes to the next seat on a loss', () => {
    expect(nextHakem(0, 0)).toBe(0);
    expect(nextHakem(2, 0)).toBe(2);
    expect(nextHakem(0, 1)).toBe(1);
    expect(nextHakem(3, 0)).toBe(0);
    expect(nextHakem(3, 1)).toBe(3);
  });

  it('Kot by the Hakem’s team scores 2 and the Hakem stays', () => {
    const e = engine(6);
    const hakem = e.getView('you').hakemId;
    const hakemTeam = e.getView('you').players.findIndex((p) => p.id === hakem) % 2;
    e.apply(hakem, { type: 'trump', suit: 'spades' });
    rigHands(e, hakemTeam);
    playUntilHandEnd(e);
    const v = e.getView('you');
    expect(v.tricksWon[hakemTeam]).toBe(7);
    expect(v.tricksWon[1 - hakemTeam]).toBe(0);
    expect(v.matchPoints[hakemTeam]).toBe(2);
    expect(v.handSummary?.title).toContain('Kot');
    e.resolve();
    expect(e.getView('you').hakemId).toBe(hakem);
    expect(e.getView('you').info).toContain('Hand 2');
  });

  it('Kot against the Hakem’s team scores 3 and the Hakem passes on', () => {
    const e = engine(8);
    const hakem = e.getView('you').hakemId;
    const hakemSeat = e.getView('you').players.findIndex((p) => p.id === hakem);
    e.apply(hakem, { type: 'trump', suit: 'spades' });
    rigHands(e, 1 - (hakemSeat % 2));
    playUntilHandEnd(e);
    const v = e.getView('you');
    expect(v.tricksWon[1 - (hakemSeat % 2)]).toBe(7);
    expect(v.tricksWon[hakemSeat % 2]).toBe(0);
    expect(v.matchPoints[1 - (hakemSeat % 2)]).toBe(3);
    expect(v.handSummary?.title).toContain('Hakem Kot');
    e.resolve();
    expect(e.getView('you').hakemId).toBe(testSeats(4)[(hakemSeat + 1) % 4].id);
  });

  it('every bot hand ends at 7 tricks with correct points and Hakem rotation', () => {
    let normal = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const e = engine(seed, 7);
      const rng = seededRng(seed);
      while (!e.isGameOver()) {
        const before = e.getView('you');
        const hakemSeat = before.players.findIndex((p) => p.id === before.hakemId);
        const pts = [...before.matchPoints];
        playUntilHandEnd(e, rng);
        const v = e.getView('you');
        const win = v.tricksWon[0] === 7 ? 0 : 1;
        expect(v.tricksWon[win]).toBe(7);
        expect(v.tricksWon[1 - win]).toBeLessThan(7);
        const gained = v.matchPoints[win] - pts[win];
        expect(gained).toBe(handPoints(win, v.tricksWon[1 - win], hakemSeat % 2));
        expect(v.matchPoints[1 - win]).toBe(pts[1 - win]);
        if (gained === 1) normal++;
        e.resolve();
        if (!e.isGameOver()) {
          const nv = e.getView('you');
          expect(nv.players.findIndex((p) => p.id === nv.hakemId)).toBe(nextHakem(hakemSeat, win));
          expect(nv.phase).toBe('trump');
        }
      }
      expect(e.getView('you').status).toBe('finished');
    }
    expect(normal).toBeGreaterThan(0);
  });

  it('bot games always finish with a winning team at the target (all targets, 25+ seeds)', () => {
    for (const target of [3, 5, 7]) {
      for (let seed = 1; seed <= 25; seed++) {
        const difficulty = (['easy', 'normal', 'hard', 'expert'] as const)[seed % 4];
        const { engine: e } = playThrough(definition, seed, { settings: { target }, difficulty });
        const out = e.outcome();
        const winners = out.players.filter((p) => p.result === 'win');
        expect(winners).toHaveLength(2);
        expect(winners[0].score).toBeGreaterThanOrEqual(target);
        expect(out.players.filter((p) => p.result === 'loss')[0].score).toBeLessThan(target);
        expect(out.players[0].result).toBe(out.players[2].result);
        expect(out.players[1].result).toBe(out.players[3].result);
        expect(out.summary).toMatch(/win \d+–\d+/);
      }
    }
  });

  it('action log replays to the same result', () => {
    for (const seed of [77, 123, 9001]) {
      const { engine: a } = playThrough(definition, seed, { settings: { target: 5 } });
      const b = new HokmEngine(testSeats(4), seed, { target: 5 });
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
