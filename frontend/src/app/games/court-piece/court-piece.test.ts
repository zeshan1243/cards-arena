import { describe, expect, it } from 'vitest';
import { Card, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { definition } from './court-piece.definition';
import { CourtPieceEngine } from './court-piece.engine';

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });

function engine(seed = 1) {
  const e = new CourtPieceEngine(testSeats(4), seed, { target: 3 });
  e.initializeGame();
  return e;
}

describe('Court Piece engine', () => {
  it('deals five cards each and asks the caller for trumps', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('trump');
    expect(v.players.map((p) => p.cardCount)).toEqual([5, 5, 5, 5]);
    expect(e.currentPlayerId()).toBe(v.callerId);
    expect(e.legalActions(v.callerId).map((a) => a.suit)).toEqual(['spades', 'hearts', 'clubs', 'diamonds']);
  });

  it('deals the rest after trumps are chosen and the caller leads', () => {
    const e = engine();
    const caller = e.getView('you').callerId;
    e.apply(caller, { type: 'trump', suit: 'hearts' });
    const v = e.getView('you');
    expect(v.players.map((p) => p.cardCount)).toEqual([13, 13, 13, 13]);
    const all = v.players.flatMap((p) => e.getView(p.id).hand.map((x) => x.id));
    expect(new Set(all).size).toBe(52);
    expect(v.trump?.suit).toBe('hearts');
    expect(e.currentPlayerId()).toBe(caller);
  });

  it('rejects out-of-turn and illegal plays', () => {
    const e = engine();
    const caller = e.getView('you').callerId;
    expect(() => e.apply(caller, { type: 'play', cardId: 'spades-2' })).toThrow();
    e.apply(caller, { type: 'trump', suit: 'hearts' });
    const other = e.getView('you').players.find((p) => p.id !== caller)!.id;
    expect(() => e.apply(other, { type: 'play', cardId: e.getView(other).hand[0].id })).toThrow('Not your turn');
  });

  it('enforces following suit', () => {
    const e = engine(3);
    const caller = e.getView('you').callerId;
    e.apply(caller, { type: 'trump', suit: 'clubs' });
    const lead = e.getView(caller).hand[0];
    e.apply(caller, { type: 'play', cardId: lead.id });
    const next = e.currentPlayerId()!;
    const hand = e.getView(next).hand;
    const legal = e.legalActions(next).map((a) => a.cardId);
    if (hand.some((x) => x.suit === lead.suit)) {
      expect(legal.every((id) => id!.startsWith(lead.suit))).toBe(true);
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
    expect(trickWinner(plays, null).playerId).toBe('b');
  });

  it('bot games always finish with a winning team at the target', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { engine: e } = playThrough(definition, seed, { settings: { target: 3 } });
      const out = e.outcome();
      const winners = out.players.filter((p) => p.result === 'win');
      expect(winners.map((p) => p.id).sort()).toHaveLength(2);
      expect(winners[0].score).toBeGreaterThanOrEqual(3);
      // Partners share the result.
      expect(out.players[0].result).toBe(out.players[2].result);
      expect(out.players[1].result).toBe(out.players[3].result);
    }
  });

  it('a hand ends when a team reaches seven tricks', () => {
    const e = engine(5);
    let sawHandEnd = false;
    const { definition: def } = { definition };
    let guard = 0;
    while (!sawHandEnd && guard++ < 500) {
      if (e.pending() === 'hand') {
        const v = e.getView('you');
        expect(Math.max(...v.tricksWon)).toBe(7);
        expect(v.handSummary).not.toBeNull();
        sawHandEnd = true;
        break;
      }
      if (e.pending()) { e.resolve(); continue; }
      const id = e.currentPlayerId()!;
      e.apply(id, def.bot(e.getView(id), e.legalActions(id), null, { difficulty: 'normal', personality: 'strategic' }, Math.random));
    }
    expect(sawHandEnd).toBe(true);
  });

  it('action log replays to the same result', () => {
    const { engine: a } = playThrough(definition, 77, { settings: { target: 3 } });
    const b = new CourtPieceEngine(testSeats(4), 77, { target: 3 });
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
