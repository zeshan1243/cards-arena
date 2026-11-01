import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit } from '../../shared/models/card.model';
import { SpiderEngine, SpiderState, TableauCard, spiderDeck } from './spider.engine';

let n = 0;
const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: `${suit}-${rank}-x${n++}`, suit, rank });
const up = (card: Card): TableauCard => ({ card, up: true });
const down = (card: Card): TableauCard => ({ card, up: false });
/** Private state, for crafting positions in tests. */
const inner = (e: SpiderEngine) => e as unknown as { state: SpiderState };
const empty = (): SpiderState => ({ stock: [], tableau: Array.from({ length: 10 }, () => []), completed: [], score: 500, moves: 0 });
const KING_TO_ACE: Rank[] = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];

describe('Spider', () => {
  it('builds 104 unique cards over the chosen suits', () => {
    for (const s of [1, 2, 4] as const) {
      const deck = spiderDeck(s);
      expect(deck).toHaveLength(104);
      expect(new Set(deck.map((x) => x.id)).size).toBe(104);
      expect(new Set(deck.map((x) => x.suit)).size).toBe(s);
    }
  });

  it('deals 6,6,6,6,5… with the top card face up and 50 in the stock', () => {
    const v = new SpiderEngine(1, 4).view;
    expect(v.tableau.map((col) => col.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    v.tableau.forEach((col) => expect(col.map((t) => t.up)).toEqual(col.map((_, k) => k === col.length - 1)));
    expect(v.stock).toHaveLength(50);
    expect(v.score).toBe(500);
  });

  it('is deterministic for a seed', () => {
    expect(new SpiderEngine(42, 2).view).toEqual(new SpiderEngine(42, 2).view);
    expect(new SpiderEngine(42, 2).view).not.toEqual(new SpiderEngine(43, 2).view);
  });

  it('places any suit one rank lower but only moves same-suit runs', () => {
    const e = new SpiderEngine(1);
    const s = empty();
    s.tableau[0] = [down(c('K')), up(c('9', 'hearts')), up(c('8', 'spades'))];
    s.tableau[1] = [up(c('10', 'clubs'))];
    s.tableau[2] = [up(c('9', 'clubs'))];
    inner(e).state = s;
    expect(e.pickUp(0, 1)).toBeNull(); // 9♥ 8♠ is mixed
    expect(e.canMove({ from: 0, index: 2, to: 2 })).toBe(true); // 8♠ on 9♣
    expect(e.canMove({ from: 0, index: 1, to: 1 })).toBe(false);
    expect(e.move({ from: 0, index: 2, to: 2 })).toBe(true);
    expect(e.move({ from: 0, index: 1, to: 1 })).toBe(true);
    expect(e.view.tableau[0]).toEqual([up(s.tableau[0][0].card)]); // turned face up
    expect(e.view.score).toBe(498);
  });

  it('any card fills an empty column, but dealing needs every column filled', () => {
    const e = new SpiderEngine(1);
    const s = empty();
    s.stock = Array.from({ length: 10 }, () => c('5'));
    s.tableau = s.tableau.map(() => [up(c('2'))]);
    s.tableau[9] = [];
    s.tableau[0] = [up(c('K')), up(c('7', 'hearts'))];
    inner(e).state = s;
    expect(e.canDeal()).toBe(false);
    expect(e.deal()).toBe(false);
    expect(e.move({ from: 0, index: 1, to: 9 })).toBe(true);
    expect(e.canDeal()).toBe(true);
    expect(e.deal()).toBe(true);
    expect(e.view.stock).toHaveLength(0);
    expect(e.view.tableau.every((col) => col[col.length - 1].card.rank === '5' && col[col.length - 1].up)).toBe(true);
  });

  it('clears a finished King-to-Ace run and wins with eight', () => {
    const e = new SpiderEngine(1);
    const s = empty();
    const run = KING_TO_ACE.map((r) => up(c(r, 'hearts')));
    s.tableau[0] = [down(c('3')), ...run.slice(0, 12)];
    s.tableau[1] = [run[12]];
    s.completed = Array.from({ length: 7 }, () => []);
    inner(e).state = s;
    expect(e.move({ from: 1, index: 0, to: 0 })).toBe(true);
    const v = e.view;
    expect(v.completed).toHaveLength(8);
    expect(v.completed[7].map((x) => x.rank)).toEqual(KING_TO_ACE);
    expect(v.tableau[0]).toHaveLength(1);
    expect(v.tableau[0][0].up).toBe(true);
    expect(v.score).toBe(500 + 100 - 1);
    expect(e.isWon()).toBe(true);
  });

  it('a mixed-suit King-to-Ace stack is not cleared', () => {
    const e = new SpiderEngine(1);
    const s = empty();
    s.tableau[0] = KING_TO_ACE.slice(0, 12).map((r, i) => up(c(r, i === 5 ? 'hearts' : 'spades')));
    s.tableau[1] = [up(c('A'))];
    inner(e).state = s;
    e.move({ from: 1, index: 0, to: 0 });
    expect(e.view.completed).toHaveLength(0);
  });

  it('undo restores the position and costs a move', () => {
    const e = new SpiderEngine(7);
    const before = e.view;
    e.deal();
    expect(e.undo()).toBe(true);
    const v = e.view;
    expect(v.tableau).toEqual(before.tableau);
    expect(v.moves).toBe(1); // back to 0, plus 1 for the undo
    expect(v.score).toBe(499);
  });

  it('tap prefers the same suit; hints skip pointless moves', () => {
    const e = new SpiderEngine(1);
    const s = empty();
    s.tableau[0] = [up(c('6', 'hearts'))];
    s.tableau[1] = [up(c('7', 'spades'))];
    s.tableau[2] = [up(c('7', 'hearts'))];
    s.tableau[3] = [up(c('8', 'clubs')), up(c('7', 'clubs'))];
    s.tableau.slice(4).forEach((_, i) => (s.tableau[4 + i] = [up(c('A', 'diamonds'))]));
    inner(e).state = s;
    expect(e.bestTarget(0, 0)).toBe(2);
    // 7♣ already sits on 8♣; the only useful move is 6♥ onto 7♥.
    expect(e.hint()).toEqual({ from: 0, index: 0, to: 2 });
  });

  it('a random 1-suit game played by hints never breaks the deck', () => {
    const e = new SpiderEngine(3, 1);
    for (let i = 0; i < 400; i++) {
      const h = e.hint();
      if (!h) break;
      if (h === 'deal') e.deal();
      else expect(e.move(h)).toBe(true);
    }
    const v = e.view;
    const ids = [...v.stock, ...v.tableau.flat().map((t) => t.card), ...v.completed.flat()].map((x) => x.id);
    expect(ids).toHaveLength(104);
    expect(new Set(ids).size).toBe(104);
  });
});
