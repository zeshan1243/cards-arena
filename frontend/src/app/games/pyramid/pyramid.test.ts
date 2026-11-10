import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { PyramidEngine, PyramidState, Slot, indexOf } from './pyramid.engine';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: cardId(suit, rank), suit, rank });
const inner = (e: PyramidEngine) => e as unknown as { state: PyramidState };

/** A pyramid where only the listed slots are still live: [row, col, card]. */
function layout(e: PyramidEngine, live: [number, number, Card][], stock: Card[] = [], waste: Card[] = []): void {
  const slots: Slot[] = [];
  let filler = 0;
  for (let row = 0; row < 7; row++)
    for (let col = 0; col <= row; col++) {
      const hit = live.find(([r, k]) => r === row && k === col);
      slots.push({ card: hit ? hit[2] : { id: `x-${filler++}`, suit: 'clubs', rank: '2' }, row, col, gone: !hit });
    }
  Object.assign(inner(e).state, { slots, stock, waste });
}

describe('Pyramid Solitaire', () => {
  it('deals 28 face-up cards in seven rows and 24 to the stock', () => {
    const v = new PyramidEngine(1).view;
    expect(v.slots).toHaveLength(28);
    expect(v.slots.filter((s) => s.row === 6)).toHaveLength(7);
    expect(v.stock).toHaveLength(24);
    expect(new PyramidEngine(1).free()).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });

  it('removes free pairs adding to 13 and Kings alone', () => {
    const e = new PyramidEngine(1);
    layout(e, [[6, 0, c('5')], [6, 1, c('8', 'hearts')], [6, 2, c('K')], [6, 3, c('Q')], [5, 0, c('A')]]);
    expect(e.canRemove(['spades-5', 'hearts-8'])).toBe(true);
    expect(e.canRemove(['spades-5', 'spades-Q'])).toBe(false);
    expect(e.canRemove(['spades-Q'])).toBe(false);
    expect(e.remove(['spades-K'])).toBe(true);
    expect(e.remove(['spades-5', 'hearts-8'])).toBe(true);
    // Both covers gone: the Ace is free and pairs with the Queen.
    expect(e.free()).toContain(indexOf(5, 0));
    expect(e.remove(['spades-A', 'spades-Q'])).toBe(true);
    expect(e.isWon()).toBe(true);
  });

  it('a covered card cannot be used, but may pair with its last cover', () => {
    const e = new PyramidEngine(1);
    // The 4 (row 5) is covered by the 9 and the Jack; once the Jack is gone, 4 + 9 pairs.
    layout(e, [[5, 0, c('4')], [6, 0, c('9')], [6, 1, c('J')], [6, 2, c('2')]]);
    expect(e.canRemove(['spades-4', 'spades-9'])).toBe(false);
    e.remove(['spades-J', 'spades-2']);
    expect(e.canRemove(['spades-4', 'spades-9'])).toBe(true);
  });

  it('pairs with the waste top and turns the stock over', () => {
    const e = new PyramidEngine(1);
    layout(e, [[6, 0, c('6')], [6, 1, c('3')]], [c('10'), c('7')], []);
    expect(e.moves()).toEqual([]);
    e.draw();
    expect(e.wasteTop()?.id).toBe('spades-7');
    expect(e.remove(['spades-6', 'spades-7'])).toBe(true);
    e.draw();
    expect(e.remove(['spades-3', 'spades-10'])).toBe(true);
    expect(e.isWon()).toBe(true);
  });

  it('allows three passes through the stock by default, then you are stuck', () => {
    const e = new PyramidEngine(1, 3);
    layout(e, [[6, 0, c('2')]], [c('5')]);
    for (let pass = 1; pass <= 3; pass++) {
      expect(e.draw()).toBe(true); // turn the card
      if (pass < 3) expect(e.draw()).toBe(true); // recycle
    }
    expect(e.view.pass).toBe(3);
    expect(e.draw()).toBe(false);
    expect(e.isStuck()).toBe(true);
    const one = new PyramidEngine(1, 1);
    layout(one, [[6, 0, c('2')]], [c('5')]);
    one.draw();
    expect(one.draw()).toBe(false);
  });

  it('scores pairs, cleared rows and the clear bonus; undo restores', () => {
    const e = new PyramidEngine(1);
    layout(e, [[6, 0, c('K')], [6, 1, c('K', 'hearts')]], [c('3'), c('4')]);
    e.remove(['spades-K']);
    expect(e.view.score).toBe(5);
    e.remove(['hearts-K']);
    // +5 for the King, +25 for the bottom row, +250 for the pyramid, +10 for each card left.
    expect(e.view.score).toBe(5 + 5 + 25 + 250 + 20); // the upper rows were already empty
    e.undo();
    expect(e.view.score).toBe(5);
    expect(e.isWon()).toBe(false);
  });

  it('following hints plays deals to the end, and some are won', () => {
    let won = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const e = new PyramidEngine(seed, 3);
      for (let n = 0; n < 500 && !e.isWon() && !e.isStuck(); n++) {
        const h = e.hint();
        if (h === 'draw') expect(e.draw()).toBe(true);
        else if (h) expect(e.remove(h)).toBe(true);
      }
      expect(e.isWon() || e.isStuck()).toBe(true);
      if (e.isWon()) won++;
    }
    expect(won).toBeGreaterThan(10); // about half the deals, with three passes
  });
});
