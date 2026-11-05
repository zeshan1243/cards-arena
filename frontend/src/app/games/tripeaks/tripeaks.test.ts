import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { LAYOUT, TriPeaksEngine, TriPeaksState, adjacent } from './tripeaks.engine';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: cardId(suit, rank), suit, rank });
/** Private state, for crafting positions in tests. */
const inner = (e: TriPeaksEngine) => e as unknown as { state: TriPeaksState };

/** Clears every slot except the ones listed, and sets the waste top. */
function position(e: TriPeaksEngine, keep: number[], waste: Card, stock: Card[] = []): TriPeaksState {
  const s = inner(e).state;
  s.slots.forEach((slot, i) => {
    slot.gone = !keep.includes(i);
    slot.up = slot.row === 3 || slot.gone;
  });
  s.waste = [waste];
  s.stock = stock;
  return s;
}

describe('Tri Peaks', () => {
  it('lays out 28 cards in rows of 3, 6, 9, 10 with each covered by two below', () => {
    expect(LAYOUT.map((l) => l.row)).toEqual([...Array(3).fill(0), ...Array(6).fill(1), ...Array(9).fill(2), ...Array(10).fill(3)]);
    LAYOUT.forEach((l) => {
      if (l.row === 3) return expect(l.coveredBy).toEqual([]);
      const [a, b] = l.coveredBy.map((i) => LAYOUT[i]);
      expect(a.row).toBe(l.row + 1);
      expect(b.row).toBe(l.row + 1);
      // The two covering cards sit half a card to either side.
      expect(a.x).toBe(l.x - 0.5);
      expect(b.x).toBe(l.x + 0.5);
    });
  });

  it('deals the bottom row face up, 23 in the stock and one on the waste', () => {
    const v = new TriPeaksEngine(1).view;
    expect(v.slots.filter((s) => s.up)).toHaveLength(10);
    expect(v.stock).toHaveLength(23);
    expect(v.waste).toHaveLength(1);
    const ids = [...v.stock, ...v.waste, ...v.slots.map((s) => s.card)].map((x) => x.id);
    expect(new Set(ids).size).toBe(52);
    expect(new TriPeaksEngine(9).view).toEqual(new TriPeaksEngine(9).view);
  });

  it('plays one rank up or down, wrapping King and Ace', () => {
    expect(adjacent(c('7'), c('8', 'hearts'))).toBe(true);
    expect(adjacent(c('7'), c('6'))).toBe(true);
    expect(adjacent(c('K'), c('A'))).toBe(true);
    expect(adjacent(c('7'), c('9'))).toBe(false);
    expect(adjacent(c('7'), c('7', 'hearts'))).toBe(false);
  });

  it('only plays free cards and turns over a card once both covers are gone', () => {
    const e = new TriPeaksEngine(1);
    const s = position(e, [9, 18, 19], c('5'));
    s.slots[9].card = c('7');
    s.slots[18].card = c('6');
    s.slots[19].card = c('8');
    expect(e.play(9)).toBe(false); // covered
    expect(e.play(18)).toBe(true); // 6 on 5
    expect(e.view.slots[9].up).toBe(false); // still covered by 19
    expect(e.play(19)).toBe(false); // 8 on 6? no
    expect(e.draw()).toBe(false); // stock empty
  });

  it('scores streaks, peak bonuses and the win bonus', () => {
    const e = new TriPeaksEngine(1);
    const s = position(e, [0, 3, 4, 9, 10, 11], c('2'), [c('Q', 'clubs'), c('J', 'clubs')]);
    // Left peak: row 2 slots 9-11, row 1 slots 3 (under 9, 10) and 4 (under 10, 11), top slot 0. Row 3 is cleared.
    [['3', 9], ['4', 10], ['5', 11], ['6', 3], ['7', 4], ['8', 0]].forEach(([r, i]) => (s.slots[i as number].card = c(r as Rank, 'hearts')));
    for (const i of [9, 10, 11, 3, 4, 0]) expect(e.play(i)).toBe(true);
    const v = e.view;
    expect(v.streak).toBe(6);
    // 1+2+…+6 = 21, peak top +15, win +30, 2 stock cards left +10.
    expect(v.score).toBe(21 + 15 + 30 + 10);
    expect(e.isWon()).toBe(true);
  });

  it('drawing resets the streak; an empty stock with no moves is stuck', () => {
    const e = new TriPeaksEngine(1);
    const s = position(e, [27], c('2'), [c('9')]);
    s.slots[27].card = c('3');
    e.play(27);
    expect(e.isWon()).toBe(true);

    const f = new TriPeaksEngine(2);
    const t = position(f, [27], c('2'), [c('9')]);
    t.slots[27].card = c('5');
    t.streak = 4;
    expect(f.hint()).toBe('draw');
    f.draw();
    expect(f.view.streak).toBe(0);
    expect(f.isStuck()).toBe(true);
    expect(f.hint()).toBeNull();
  });

  it('hint prefers the card that starts the longer chain', () => {
    const e = new TriPeaksEngine(1);
    const s = position(e, [18, 19, 20], c('5'));
    s.slots[18].card = c('4'); // dead end
    s.slots[19].card = c('6', 'hearts'); // 6 → 7
    s.slots[20].card = c('7', 'clubs');
    expect(e.hint()).toBe(19);
  });

  it('undo restores the previous position', () => {
    const e = new TriPeaksEngine(5);
    const before = e.view;
    e.draw();
    e.undo();
    expect(e.view.waste).toEqual(before.waste);
    expect(e.view.stock).toEqual(before.stock);
  });
});
