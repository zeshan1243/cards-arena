import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { SolitaireEngine, SolitaireState } from './solitaire.engine';

const c = (rank: Rank, suit: Suit): Card => ({ id: cardId(suit, rank), suit, rank });
/** Private state, for crafting positions in tests. */
const inner = (e: SolitaireEngine) => e as unknown as { state: SolitaireState };
const empty = (): SolitaireState => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  score: 0,
  moves: 0,
  recycles: 0,
});

describe('Solitaire', () => {
  it('deals 1…7 cards with the top card face up and 24 in the stock', () => {
    const v = new SolitaireEngine(1).view;
    v.tableau.forEach((col, i) => {
      expect(col).toHaveLength(i + 1);
      expect(col.map((t) => t.up)).toEqual(col.map((_, k) => k === i));
    });
    expect(v.stock).toHaveLength(24);
    const all = [...v.stock, ...v.tableau.flat().map((t) => t.card)].map((x) => x.id);
    expect(new Set(all).size).toBe(52);
  });

  it('is deterministic for a seed', () => {
    expect(new SolitaireEngine(42).view).toEqual(new SolitaireEngine(42).view);
    expect(new SolitaireEngine(42).view).not.toEqual(new SolitaireEngine(43).view);
  });

  it('draws one or three cards and recycles the waste', () => {
    const one = new SolitaireEngine(5, 1);
    const top = one.view.stock[23];
    one.draw();
    expect(one.view.waste).toEqual([top]);

    const three = new SolitaireEngine(5, 3);
    const stock = three.view.stock;
    three.draw();
    // The packet is turned over: the third card from the top ends up showing.
    expect(three.view.waste.map((x) => x.id)).toEqual([stock[23], stock[22], stock[21]].map((x) => x.id));
    for (let i = 0; i < 7; i++) three.draw();
    expect(three.view.stock).toHaveLength(0);
    const before = three.view.waste;
    three.draw();
    expect(three.view.waste).toHaveLength(0);
    expect(three.view.stock.map((x) => x.id)).toEqual([...before].reverse().map((x) => x.id));
    expect(three.view.recycles).toBe(1);
  });

  it('builds foundations up by suit from the Ace', () => {
    const e = new SolitaireEngine(1);
    const s = empty();
    s.waste = [c('2', 'hearts'), c('A', 'hearts')];
    inner(e).state = s;
    expect(e.canMove({ from: 'waste', index: 0, to: 'f0' })).toBe(false); // not the top card
    expect(e.move({ from: 'waste', index: 1, to: 'f0' })).toBe(true);
    expect(e.canMove({ from: 'waste', index: 0, to: 'f1' })).toBe(false); // 2 needs its Ace
    expect(e.move({ from: 'waste', index: 0, to: 'f0' })).toBe(true);
    expect(e.view.score).toBe(20);
  });

  it('builds tableau down in alternating colours, Kings only on empty columns', () => {
    const e = new SolitaireEngine(1);
    const s = empty();
    s.tableau[0] = [{ card: c('9', 'spades'), up: true }];
    s.tableau[1] = [{ card: c('5', 'clubs'), up: false }, { card: c('8', 'hearts'), up: true }, { card: c('7', 'clubs'), up: true }];
    s.waste = [c('K', 'diamonds')];
    inner(e).state = s;
    expect(e.canMove({ from: 't1', index: 2, to: 't0' })).toBe(false); // 7♣ on 9♠
    expect(e.move({ from: 't1', index: 1, to: 't0' })).toBe(true); // 8♥ 7♣ onto 9♠
    expect(e.view.tableau[0].map((t) => t.card.id)).toEqual(['spades-9', 'hearts-8', 'clubs-7']);
    expect(e.view.tableau[1][0].up).toBe(true); // revealed
    expect(e.view.score).toBe(5);
    expect(e.canMove({ from: 'waste', index: 0, to: 't2' })).toBe(true);
    expect(e.canMove({ from: 't0', index: 2, to: 't2' })).toBe(false);
  });

  it('undoes moves and draws', () => {
    const e = new SolitaireEngine(9);
    const start = e.view;
    e.draw();
    e.draw();
    expect(e.undo()).toBe(true);
    expect(e.undo()).toBe(true);
    expect(e.view.stock).toEqual(start.stock);
    expect(e.view.waste).toEqual([]);
    expect(e.undo()).toBe(false);
  });

  it('auto-finishes once everything is face up', () => {
    const e = new SolitaireEngine(1);
    const s = empty();
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks: Rank[] = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
    suits.forEach((suit, i) => (s.tableau[i] = ranks.map((rank) => ({ card: c(rank, suit), up: true }))));
    inner(e).state = s;
    expect(e.canAutoFinish()).toBe(true);
    let steps = 0;
    while (e.autoFinishStep()) steps++;
    expect(steps).toBe(52);
    expect(e.isWon()).toBe(true);
  });

  it('wins some deals by following its own hints', () => {
    let won = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const e = new SolitaireEngine(seed, 1);
      for (let i = 0; i < 3000 && !e.isWon(); i++) {
        if (e.canAutoFinish()) {
          while (e.autoFinishStep());
          break;
        }
        const h = e.hint();
        if (!h || (h === 'draw' && e.view.recycles > 3)) break;
        if (h === 'draw') e.draw();
        else expect(e.move(h)).toBe(true);
      }
      if (e.isWon()) won++;
    }
    expect(won).toBeGreaterThan(0);
  });
});
