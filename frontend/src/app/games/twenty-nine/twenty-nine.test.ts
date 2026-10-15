import { describe, expect, it } from 'vitest';
import { Card, Suit, cardId } from '../../shared/models/card.model';
import { playThrough, testSeats } from '../core/testing';
import { createShortDeck, trickWinner } from '../core/tricks';
import { definition } from './twenty-nine.definition';
import { TWENTY_NINE_ORDER, TwentyNineEngine, cardPoints } from './twenty-nine.engine';

const c = (suit: Suit, rank: Card['rank']): Card => ({ id: cardId(suit, rank), suit, rank });
const IDS = ['you', 'bot-1', 'bot-2', 'bot-3'];

function engine(seed = 1, settings: Record<string, number | string> = { target: 3, pair: 'on' }) {
  const e = new TwentyNineEngine(testSeats(4), seed, settings);
  e.initializeGame();
  return e;
}

/** Internal state access for scenario tests. */
const S = (e: TwentyNineEngine) => e as unknown as Record<string, any>;

/** Finish bidding: first bidder bids 16, everyone else passes. Returns bidder id. */
function quickBid(e: TwentyNineEngine): string {
  const bidder = e.currentPlayerId()!;
  e.apply(bidder, { type: 'bid', value: 16 });
  while (e.getView('you').phase === 'bid') e.apply(e.currentPlayerId()!, { type: 'pass' });
  return bidder;
}

/** Put the engine into play phase with given hands, trump and leader. */
function setupPlay(e: TwentyNineEngine, hands: Card[][], opts: { trump: Suit; bidder: number; leader: number; target?: number }) {
  const s = S(e);
  s.hands = hands.map((h) => [...h]);
  s.undealt = [];
  s.phase = 'play';
  s.trump = opts.trump;
  s.bidder = opts.bidder;
  s.highBid = opts.target ?? 16;
  s.target = opts.target ?? 16;
  s.turn = opts.leader;
  s.trick = [];
  s.tricksPlayed = 8 - hands[0].length;
}

describe('29 engine', () => {
  it('uses a 32-card deck worth 28 points with J 9 A 10 K Q 8 7 ranking', () => {
    const deck = createShortDeck();
    expect(deck).toHaveLength(32);
    expect(deck.reduce((n, x) => n + cardPoints(x), 0)).toBe(28);
    expect([...TWENTY_NINE_ORDER].reverse()).toEqual(['J', '9', 'A', '10', 'K', 'Q', '8', '7']);
    const plays = [
      { playerId: 'a', card: c('hearts', 'A') },
      { playerId: 'b', card: c('hearts', '9') },
      { playerId: 'c', card: c('hearts', 'K') },
      { playerId: 'd', card: c('spades', 'J') },
    ];
    expect(trickWinner(plays, null, TWENTY_NINE_ORDER).playerId).toBe('b');
    expect(trickWinner(plays, 'spades', TWENTY_NINE_ORDER).playerId).toBe('d');
    expect(trickWinner([plays[0], { playerId: 'x', card: c('hearts', '10') }], null, TWENTY_NINE_ORDER).playerId).toBe('a');
  });

  it('deals 4 cards each, then 8 each after trump, covering all 32 cards', () => {
    const e = engine();
    const v = e.getView('you');
    expect(v.phase).toBe('bid');
    expect(v.players.map((p) => p.cardCount)).toEqual([4, 4, 4, 4]);
    const bidder = quickBid(e);
    expect(e.getView('you').phase).toBe('trump');
    e.apply(bidder, { type: 'trump', suit: 'hearts' });
    const after = e.getView('you');
    expect(after.players.map((p) => p.cardCount)).toEqual([8, 8, 8, 8]);
    expect(new Set(IDS.flatMap((id) => e.getView(id).hand.map((x) => x.id))).size).toBe(32);
    // The player after the dealer leads.
    expect(e.currentPlayerId()).toBe(IDS[(IDS.indexOf(after.dealerId) + 1) % 4]);
  });

  it('bidding: starts after the dealer, 16–28, must exceed, passers are out', () => {
    const e = engine(4);
    const dealer = IDS.indexOf(e.getView('you').dealerId);
    const first = IDS[(dealer + 1) % 4];
    expect(e.currentPlayerId()).toBe(first);
    const legal = e.legalActions(first);
    expect(legal.filter((a) => a.type === 'bid').map((a) => a.value)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
    expect(legal.some((a) => a.type === 'pass')).toBe(true);
    expect(() => e.apply(first, { type: 'bid', value: 15 })).toThrow();
    expect(() => e.apply(first, { type: 'bid', value: 29 })).toThrow();
    e.apply(first, { type: 'bid', value: 18 });
    const second = IDS[(dealer + 2) % 4];
    expect(() => e.apply(second, { type: 'bid', value: 18 })).toThrow();
    expect(e.legalActions(second).filter((a) => a.type === 'bid')[0].value).toBe(19);
    e.apply(second, { type: 'pass' });
    const third = IDS[(dealer + 3) % 4];
    e.apply(third, { type: 'bid', value: 20 });
    const fourth = IDS[dealer];
    e.apply(fourth, { type: 'pass' });
    // Second passed, so it's back to the first bidder.
    expect(e.currentPlayerId()).toBe(first);
    expect(e.getView(first).phaseLabel).toBe(`Bid or pass — current bid 20 by ${e.getView(first).players[(dealer + 3) % 4].name}`);
    expect(e.getView(first).players.map((p) => p.stat)[(dealer + 2) % 4]).toBe('Passed');
    e.apply(first, { type: 'pass' });
    const v = e.getView('you');
    expect(v.phase).toBe('trump');
    expect(v.bidderId).toBe(third);
    expect(v.highBid).toBe(20);
    expect(e.currentPlayerId()).toBe(third);
  });

  it('forces the dealer to bid when the first three pass', () => {
    const e = engine(9);
    const dealer = e.getView('you').dealerId;
    for (let i = 0; i < 3; i++) e.apply(e.currentPlayerId()!, { type: 'pass' });
    expect(e.currentPlayerId()).toBe(dealer);
    const legal = e.legalActions(dealer);
    expect(legal.some((a) => a.type === 'pass')).toBe(false);
    expect(legal[0]).toMatchObject({ type: 'bid', value: 16 });
    expect(() => e.apply(dealer, { type: 'pass' })).toThrow();
    e.apply(dealer, { type: 'bid', value: 16 });
    expect(e.getView('you').bidderId).toBe(dealer);
  });

  it('keeps the trump hidden from everyone but the bidder until revealed', () => {
    const e = engine(2);
    const bidder = quickBid(e);
    e.apply(bidder, { type: 'trump', suit: 'clubs' });
    for (const id of IDS) {
      const t = e.getView(id).trump!;
      if (id === bidder) expect(t.suit).toBe('clubs');
      else expect(t).toEqual({ suit: null, hidden: true, label: 'Trump hidden' });
    }
  });

  it('reveal trump: only when void, then the revealer must play a trump; trumps count retroactively', () => {
    const e = engine(3);
    // Seat 1 (bidder) leads hearts. Seat 2 is void in hearts and holds a spade trump.
    setupPlay(
      e,
      [
        [c('hearts', 'J'), c('clubs', '7')],
        [c('hearts', '7'), c('clubs', '8')],
        [c('spades', '7'), c('diamonds', 'J')],
        [c('spades', '8'), c('clubs', 'A')],
      ],
      { trump: 'spades', bidder: 1, leader: 1 },
    );
    e.apply('bot-1', { type: 'play', cardId: 'hearts-7' });
    const legal2 = e.legalActions('bot-2');
    expect(legal2.map((a) => a.type)).toContain('reveal-trump');
    expect(legal2.find((a) => a.type === 'reveal-trump')!.label).toBe('Reveal trump');
    expect(e.getView('bot-2').phaseLabel).toBe("You can't follow suit: reveal trump or play any card");
    e.apply('bot-2', { type: 'reveal-trump' });
    expect(e.currentPlayerId()).toBe('bot-2');
    expect(e.legalActions('bot-2').map((a) => a.cardId)).toEqual(['spades-7']);
    expect(e.getView('you').trump).toMatchObject({ suit: 'spades', hidden: false });
    e.apply('bot-2', { type: 'play', cardId: 'spades-7' });
    // seat 3 void too; reveal no longer offered.
    expect(e.legalActions('bot-3').some((a) => a.type === 'reveal-trump')).toBe(false);
    e.apply('bot-3', { type: 'play', cardId: 'clubs-A' });
    // seat 0 must follow hearts
    expect(e.legalActions('you').map((a) => a.cardId)).toEqual(['hearts-J']);
    e.apply('you', { type: 'play', cardId: 'hearts-J' });
    expect(e.pending()).toBe('trick');
    expect(e.getView('you').trickWinnerId).toBe('bot-2');
  });

  it('a void player may play any card without revealing; un-revealed trump does not win', () => {
    const e = engine(3);
    setupPlay(
      e,
      [
        [c('hearts', '8'), c('clubs', '7')],
        [c('hearts', '7'), c('clubs', '8')],
        [c('spades', 'J'), c('diamonds', 'J')],
        [c('hearts', 'Q'), c('clubs', 'A')],
      ],
      { trump: 'spades', bidder: 1, leader: 1 },
    );
    e.apply('bot-1', { type: 'play', cardId: 'hearts-7' });
    e.apply('bot-2', { type: 'play', cardId: 'spades-J' });
    e.apply('bot-3', { type: 'play', cardId: 'hearts-Q' });
    e.apply('you', { type: 'play', cardId: 'hearts-8' });
    expect(e.getView('you').trickWinnerId).toBe('bot-3');
  });

  it('pair declared by the bidding team lowers the target by 4 (min 16); by opponents raises it (max 28)', () => {
    const run = (bidder: number, target: number) => {
      const e = engine(5);
      setupPlay(
        e,
        [
          [c('hearts', 'J'), c('spades', 'K'), c('spades', 'Q')],
          [c('hearts', '7'), c('clubs', '8'), c('clubs', '9')],
          [c('hearts', '8'), c('diamonds', '7'), c('diamonds', '8')],
          [c('hearts', 'Q'), c('clubs', 'A'), c('clubs', '10')],
        ],
        { trump: 'spades', bidder, leader: 0, target },
      );
      S(e).trumpRevealed = true;
      for (const [id, card] of [['you', 'hearts-J'], ['bot-1', 'hearts-7'], ['bot-2', 'hearts-8'], ['bot-3', 'hearts-Q']]) e.apply(id, { type: 'play', cardId: card });
      e.resolve();
      return e.getView('you');
    };
    expect(run(0, 22).target).toBe(18);
    expect(run(0, 18).target).toBe(16);
    expect(run(1, 20).target).toBe(24);
    expect(run(1, 26).target).toBe(28);
    expect(run(1, 20).pairTeam).toBe(0);
  });

  it('no pair when the rule is off or trump is not revealed', () => {
    for (const [pair, revealed] of [['off', true], ['on', false]] as const) {
      const e = engine(5, { target: 3, pair });
      setupPlay(
        e,
        [
          [c('hearts', 'J'), c('spades', 'K'), c('spades', 'Q')],
          [c('hearts', '7'), c('clubs', '8'), c('clubs', '9')],
          [c('hearts', '8'), c('diamonds', '7'), c('diamonds', '8')],
          [c('hearts', 'Q'), c('clubs', 'A'), c('clubs', '10')],
        ],
        { trump: 'spades', bidder: 0, leader: 0, target: 20 },
      );
      S(e).trumpRevealed = revealed;
      for (const [id, card] of [['you', 'hearts-J'], ['bot-1', 'hearts-7'], ['bot-2', 'hearts-8'], ['bot-3', 'hearts-Q']]) e.apply(id, { type: 'play', cardId: card });
      e.resolve();
      expect(e.getView('you').target).toBe(20);
    }
  });

  it('scores +1 to the bidding team when they make the target, −1 otherwise', () => {
    const lastTrick = (pointsBefore: [number, number], target: number) => {
      const e = engine(6);
      setupPlay(e, [[c('hearts', 'J')], [c('hearts', '9')], [c('hearts', 'A')], [c('hearts', '7')]], { trump: 'spades', bidder: 0, leader: 0, target });
      S(e).cardPts = pointsBefore;
      for (const [id, card] of [['you', 'hearts-J'], ['bot-1', 'hearts-9'], ['bot-2', 'hearts-A'], ['bot-3', 'hearts-7']]) e.apply(id, { type: 'play', cardId: card });
      e.resolve();
      expect(e.pending()).toBe('hand');
      const v = e.getView('bot-1');
      expect(v.handSummary).not.toBeNull();
      expect(v.trump?.suit).toBe('spades'); // trump is public once the hand is over
      return v;
    };
    // trick worth 3+2+1 = 6 to team 0
    expect(lastTrick([10, 12], 16).gamePoints).toEqual([1, 0]);
    expect(lastTrick([9, 13], 16).gamePoints).toEqual([-1, 0]);
  });

  it('the match ends at +target or −target game points', () => {
    const e = engine(6, { target: 3, pair: 'on' });
    S(e).gamePts = [-2, 0];
    setupPlay(e, [[c('hearts', '7')], [c('hearts', '9')], [c('hearts', '8')], [c('hearts', 'Q')]], { trump: 'spades', bidder: 0, leader: 0, target: 16 });
    for (const [id, card] of [['you', 'hearts-7'], ['bot-1', 'hearts-9'], ['bot-2', 'hearts-8'], ['bot-3', 'hearts-Q']]) e.apply(id, { type: 'play', cardId: card });
    e.resolve();
    e.resolve();
    expect(e.isGameOver()).toBe(true);
    const out = e.outcome();
    expect(out.players.map((p) => p.result)).toEqual(['loss', 'win', 'loss', 'win']);
    expect(out.players.map((p) => p.score)).toEqual([-3, 0, -3, 0]);
    expect(out.summary).toBe('Bot 1 & Bot 3 win — You & Bot 2 fell to −3');
  });

  it('bot games always finish across settings and difficulties', () => {
    const settings = [
      { target: 3, pair: 'on' },
      { target: 3, pair: 'off' },
      { target: 6, pair: 'on' },
      { target: 6, pair: 'off' },
    ];
    const diffs = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let seed = 1; seed <= 32; seed++) {
      const s = settings[seed % 4];
      const { engine: e } = playThrough(definition, seed, { settings: s, difficulty: diffs[(seed >> 2) % 4] });
      const out = e.outcome();
      expect(out.players[0].result).toBe(out.players[2].result);
      expect(out.players[1].result).toBe(out.players[3].result);
      expect(out.players.filter((p) => p.result === 'win')).toHaveLength(2);
      const pts = (e.getView('you') as ReturnType<TwentyNineEngine['getView']>).gamePoints;
      expect(pts.some((p) => p >= s.target || p <= -s.target)).toBe(true);
    }
  });

  it('action log replays to the same result', () => {
    for (const seed of [77, 78]) {
      const { engine: a } = playThrough(definition, seed, { settings: { target: 6, pair: 'on' } });
      const b = new TwentyNineEngine(testSeats(4), seed, { target: 6, pair: 'on' });
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
