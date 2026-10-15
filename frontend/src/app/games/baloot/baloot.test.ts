import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { createShortDeck } from '../core/tricks';
import { definition } from './baloot.definition';
import {
  BalootEngine,
  balootTrickWinner,
  buyerGamePoints,
  cardPoints,
  legalCards,
  scoreContract,
} from './baloot.engine';

const c = (suit: Suit, rank: Rank): Card => ({ id: cardId(suit, rank), suit, rank });
const ids = (cards: Card[]) => cards.map((x) => x.id).sort();
const SEATS = ['you', 'bot-1', 'bot-2', 'bot-3'];

function engine(seed = 1, target = 101) {
  const e = new BalootEngine(testSeats(4), seed, { target });
  e.initializeGame();
  return e;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priv = (e: BalootEngine) => e as any;

describe('Baloot deal and bidding', () => {
  it('deals 5 each, turns up a buyer card and starts bidding after the dealer', () => {
    const e = engine(3);
    const v = e.getView('you');
    expect(v.phase).toBe('bid');
    expect(v.players.map((p) => p.cardCount)).toEqual([5, 5, 5, 5]);
    expect(v.buyerCard).not.toBeNull();
    expect(v.info).toContain(`Buyer card: ${v.buyerCard!.rank}${{ spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' }[v.buyerCard!.suit]}`);
    const dealer = SEATS.indexOf(v.dealerId);
    expect(e.currentPlayerId()).toBe(SEATS[(dealer + 1) % 4]);
    expect(e.legalActions(e.currentPlayerId()!).map((a) => a.label)).toEqual(['Sun', `Hokm ${v.trump!.label.slice(-1)}`, 'Pass']);
    // Never leak other hands.
    expect(v.hand).toHaveLength(5);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(e.getView('bot-1').hand[0]));
  });

  it('the buyer gets the face-up card + 2, others +3 (8 each, 32 distinct)', () => {
    const e = engine(5);
    const v = e.getView('you');
    const first = e.currentPlayerId()!;
    const buyerCard = v.buyerCard!;
    e.apply(first, { type: 'choose', value: 'sun' });
    const after = e.getView(first);
    expect(after.contract).toBe('sun');
    expect(after.buyerId).toBe(first);
    expect(after.players.map((p) => p.cardCount)).toEqual([8, 8, 8, 8]);
    expect(after.hand.map((x) => x.id)).toContain(buyerCard.id);
    expect(after.trump).toEqual({ suit: null, hidden: false, label: 'Sun (no trumps)' });
    const all = SEATS.flatMap((id) => e.getView(id).hand.map((x) => x.id));
    expect(new Set(all).size).toBe(32);
    expect(e.currentPlayerId()).toBe(first); // seat after the dealer leads
    expect(after.players.find((p) => p.id === first)!.badges).toContain('Buyer');
  });

  it('a later Sun overtakes a Hokm, and Hokm can only be chosen once', () => {
    const e = engine(7);
    const p1 = e.currentPlayerId()!;
    e.apply(p1, { type: 'choose', value: 'hokm' });
    const p2 = e.currentPlayerId()!;
    expect(e.legalActions(p2).map((a) => a.label)).toEqual(['Sun', 'Pass']);
    e.apply(p2, { type: 'choose', value: 'sun' });
    const v = e.getView('you');
    expect(v.phase).toBe('play');
    expect(v.contract).toBe('sun');
    expect(v.buyerId).toBe(p2);
  });

  it('an unchallenged Hokm buys with the buyer card suit as trumps', () => {
    const e = engine(8);
    const suit = e.getView('you').buyerCard!.suit;
    const p1 = e.currentPlayerId()!;
    e.apply(p1, { type: 'pass' });
    const p2 = e.currentPlayerId()!;
    e.apply(p2, { type: 'choose', value: 'hokm' });
    e.apply(e.currentPlayerId()!, { type: 'pass' });
    e.apply(e.currentPlayerId()!, { type: 'pass' });
    expect(e.getView('you').phase).toBe('play');
    expect(e.getView('you').phase).toBe('play');
    const v = e.getView('you');
    expect(v.contract).toBe('hokm');
    expect(v.trumpSuit).toBe(suit);
    expect(v.buyerId).toBe(p2);
    // p1 already passed and gets no second chance.
    expect(e.currentPlayerId()).toBe(p1);
  });

  it('round 2 offers Hokm in the other three suits; a second all-pass redeals', () => {
    const e = engine(9);
    const v0 = e.getView('you');
    const suit = v0.buyerCard!.suit;
    for (let i = 0; i < 4; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    const v = e.getView('you');
    expect(v.bidRound).toBe(2);
    const legal = e.legalActions(e.currentPlayerId()!);
    expect(legal.filter((a) => a.type === 'trump').map((a) => a.suit)).toHaveLength(3);
    expect(legal.some((a) => a.suit === suit)).toBe(false);
    expect(legal.find((a) => a.type === 'trump')!.label).toMatch(/^Hokm [♠♥♣♦]$/);
    for (let i = 0; i < 4; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    const r = e.getView('you');
    expect(r.phase).toBe('bid');
    expect(r.bidRound).toBe(1);
    expect(SEATS.indexOf(r.dealerId)).toBe((SEATS.indexOf(v0.dealerId) + 1) % 4);
    expect(r.players.map((p) => p.cardCount)).toEqual([5, 5, 5, 5]);
  });

  it('round 2 Hokm uses the named suit', () => {
    const e = engine(10);
    const suit = e.getView('you').buyerCard!.suit;
    for (let i = 0; i < 4; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    const other = (['spades', 'hearts', 'clubs', 'diamonds'] as Suit[]).find((s) => s !== suit)!;
    const p = e.currentPlayerId()!;
    expect(() => e.apply(p, { type: 'trump', suit })).toThrow();
    e.apply(p, { type: 'trump', suit: other });
    for (let i = 0; i < 3; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    expect(e.getView('you').trumpSuit).toBe(other);
    expect(e.getView('you').trump!.label).toBe(`Hokm ${{ spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' }[other]}`);
  });
});

describe('Baloot points and scoring', () => {
  it('card points total 120 (Sun) / 152 (Hokm), +10 last trick = 130 / 162', () => {
    const deck = createShortDeck();
    const sun = deck.reduce((n, x) => n + cardPoints(x, null), 0);
    const hokm = deck.reduce((n, x) => n + cardPoints(x, 'hearts'), 0);
    expect(sun).toBe(120);
    expect(hokm).toBe(152);
    expect(sun + 10).toBe(130);
    expect(hokm + 10).toBe(162);
  });

  it('conversion always sums to 26 (Sun) and 16 (Hokm)', () => {
    for (let raw = 0; raw <= 130; raw++) {
      const r = scoreContract(raw, 'sun');
      expect(r.buyer + r.defenders).toBe(26);
    }
    for (let raw = 0; raw <= 162; raw++) {
      const r = scoreContract(raw, 'hokm');
      expect(r.buyer + r.defenders).toBe(16);
    }
    expect(buyerGamePoints(130, 'sun')).toBe(26);
    expect(buyerGamePoints(162, 'hokm')).toBe(16);
    expect(buyerGamePoints(67, 'sun')).toBe(13); // 13.4
    expect(buyerGamePoints(68, 'sun')).toBe(14); // 13.6
    expect(buyerGamePoints(84, 'hokm')).toBe(8);
    expect(buyerGamePoints(85, 'hokm')).toBe(9); // half-up
  });

  it('the buyers fail with half or less: defenders take everything', () => {
    expect(scoreContract(67, 'sun')).toEqual({ buyer: 0, defenders: 26, made: false });
    expect(scoreContract(68, 'sun')).toEqual({ buyer: 14, defenders: 12, made: true });
    expect(scoreContract(84, 'hokm')).toEqual({ buyer: 0, defenders: 16, made: false });
    expect(scoreContract(100, 'hokm')).toEqual({ buyer: 10, defenders: 6, made: true });
  });

  it('a failed contract still keeps the Baloot bonus', () => {
    const e = engine(11);
    const p = priv(e);
    Object.assign(p, { contract: 'hokm', trump: 'hearts', buyer: 0, raw: [70, 92], balootTeams: [0] });
    p.scoreHand();
    expect(e.pending()).toBe('hand');
    expect(e.getView('you').matchPoints).toEqual([2, 16]);
    expect(e.getView('you').handSummary!.lines.join(' ')).toContain('Baloot');
  });

  it('declares Baloot when the second of K/Q of trumps is played', () => {
    const e = engine(12);
    const p = priv(e);
    Object.assign(p, {
      phase: 'play', contract: 'hokm', trump: 'hearts', buyer: 1, buyerCard: null, turn: 0,
      hands: [
        [c('hearts', 'K'), c('hearts', 'Q')],
        [c('spades', '7'), c('spades', '8')],
        [c('clubs', '7'), c('clubs', '8')],
        [c('diamonds', '7'), c('diamonds', '8')],
      ],
    });
    e.apply('you', { type: 'play', cardId: 'hearts-K' });
    expect(e.getView('you').banner?.text ?? '').not.toContain('Baloot');
    e.apply('bot-1', { type: 'play', cardId: 'spades-7' });
    e.apply('bot-2', { type: 'play', cardId: 'clubs-7' });
    e.apply('bot-3', { type: 'play', cardId: 'diamonds-7' });
    expect(e.getView('you').trickWinnerId).toBe('you');
    e.resolve();
    e.apply('you', { type: 'play', cardId: 'hearts-Q' });
    expect(e.getView('you').banner!.text).toContain('Baloot');
    expect(p.balootTeams).toEqual([0]);
  });

  it('a full hand awards the last-trick bonus and totals 162 raw in Hokm', () => {
    const e = engine(13);
    let guard = 0;
    while (e.pending() !== 'hand' && guard++ < 500) {
      if (e.pending()) { e.resolve(); continue; }
      const id = e.currentPlayerId()!;
      e.apply(id, definition.bot(e.getView(id), e.legalActions(id), null, { difficulty: 'normal', personality: 'strategic' }, () => 0.5));
    }
    const v = e.getView('you');
    expect(v.handRaw[0] + v.handRaw[1]).toBe(v.contract === 'sun' ? 130 : 162);
    expect(v.handSummary).not.toBeNull();
    const total = v.contract === 'sun' ? 26 : 16;
    expect(v.matchPoints[0] + v.matchPoints[1]).toBeGreaterThanOrEqual(total);
  });
});

describe('Baloot play rules', () => {
  const T: Suit = 'hearts';
  const trick = (...cards: Card[]) => cards.map((card, i) => ({ playerId: `p${i}`, card }));

  it('ranks trumps J 9 A 10 K Q 8 7 and plain A 10 K Q J 9 8 7', () => {
    expect(balootTrickWinner(trick(c(T, 'A'), c(T, '9'), c(T, '10'), c(T, 'K')), T).playerId).toBe('p1');
    expect(balootTrickWinner(trick(c(T, '9'), c(T, 'J')), T).playerId).toBe('p1');
    expect(balootTrickWinner(trick(c('spades', 'K'), c('spades', '10'), c('spades', 'J')), T).playerId).toBe('p1');
    expect(balootTrickWinner(trick(c('spades', 'A'), c(T, '7')), T).playerId).toBe('p1');
    expect(balootTrickWinner(trick(c('spades', 'J'), c('spades', '9')), null).playerId).toBe('p0');
  });

  it('follow suit first', () => {
    const hand = [c('spades', '7'), c(T, 'J'), c('clubs', 'A')];
    expect(ids(legalCards(hand, trick(c('spades', 'A')), T, false))).toEqual(['spades-7']);
  });

  it('must trump when void, unless partner is winning', () => {
    const hand = [c(T, '7'), c(T, 'J'), c('clubs', 'A')];
    expect(ids(legalCards(hand, trick(c('spades', 'A')), T, false))).toEqual(['hearts-7', 'hearts-J']);
    expect(ids(legalCards(hand, trick(c('spades', 'A')), T, true))).toEqual(ids(hand));
  });

  it('must over-trump when possible', () => {
    const hand = [c(T, '7'), c(T, 'A'), c(T, 'J'), c('clubs', 'A')];
    // Opponent trumped with the 9: only the J beats it.
    expect(ids(legalCards(hand, trick(c('spades', 'A'), c(T, '9')), T, false))).toEqual(['hearts-J']);
    // Cannot beat the J: any trump.
    const weak = [c(T, '7'), c(T, 'A'), c('clubs', 'A')];
    expect(ids(legalCards(weak, trick(c('spades', 'A'), c(T, 'J')), T, false))).toEqual(['hearts-7', 'hearts-A']);
    // Trumps led: must go higher if possible.
    expect(ids(legalCards(hand, trick(c(T, '10')), T, false))).toEqual(['hearts-A', 'hearts-J']);
    // Partner winning with a trump: discard freely, but a trump must still over-trump.
    expect(ids(legalCards(hand, trick(c('spades', 'A'), c(T, '9')), T, true))).toEqual(['clubs-A', 'hearts-J']);
  });

  it('Sun has no trump obligations', () => {
    const hand = [c(T, '7'), c('clubs', 'A')];
    expect(ids(legalCards(hand, trick(c('spades', 'A')), null, false))).toEqual(ids(hand));
  });

  it('engine applies the partner exemption', () => {
    const e = engine(14);
    const p = priv(e);
    Object.assign(p, {
      phase: 'play', contract: 'hokm', trump: T, buyer: 0, buyerCard: null, turn: 0,
      hands: [
        [c('spades', 'A'), c('spades', '8')],
        [c('spades', '7'), c('clubs', '8')],
        [c(T, '7'), c('clubs', '7')],
        [c(T, '8'), c('diamonds', '7')],
      ],
    });
    e.apply('you', { type: 'play', cardId: 'spades-A' });
    e.apply('bot-1', { type: 'play', cardId: 'spades-7' });
    // bot-2's partner (you) is winning: may discard instead of trumping.
    expect(e.legalActions('bot-2').map((a) => a.cardId).sort()).toEqual(['clubs-7', 'hearts-7']);
    e.apply('bot-2', { type: 'play', cardId: 'clubs-7' });
    // bot-3's partner is not winning: must trump.
    expect(e.legalActions('bot-3').map((a) => a.cardId)).toEqual(['hearts-8']);
    expect(() => e.apply('bot-3', { type: 'play', cardId: 'diamonds-7' })).toThrow();
  });
});

describe('Baloot full games', () => {
  it('bot games finish with a winning team at the target', () => {
    const targets = [52, 101, 152];
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let seed = 1; seed <= 30; seed++) {
      const target = targets[seed % 3];
      const { engine: e } = playThrough(definition, seed, { settings: { target }, difficulty: diffs[seed % 4] });
      const out = e.outcome();
      const winners = out.players.filter((p) => p.result === 'win');
      expect(winners).toHaveLength(2);
      expect(winners[0].score).toBeGreaterThanOrEqual(target);
      expect(winners[0].score).toBeGreaterThan(out.players.find((p) => p.result === 'loss')!.score);
      expect(out.players[0].result).toBe(out.players[2].result);
      expect(out.players[1].result).toBe(out.players[3].result);
      expect(out.summary).toMatch(/win \d+–\d+$/);
    }
  });

  it('action log replays to the same result', () => {
    const { engine: a } = playThrough(definition, 77, { settings: { target: 52 } });
    const b = new BalootEngine(testSeats(4), 77, { target: 52 });
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
