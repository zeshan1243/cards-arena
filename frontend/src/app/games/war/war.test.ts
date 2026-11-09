import { describe, expect, it } from 'vitest';
import { Card, Rank, Suit, cardId } from '../../shared/models/card.model';
import { WarEngine, WarState } from './war.engine';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({ id: cardId(suit, rank), suit, rank });
/** Private state, for crafting positions in tests. */
const inner = (e: WarEngine) => e as unknown as { state: WarState };
const total = (s: WarState) => s.decks[0].length + s.decks[1].length + s.won[0].length + s.won[1].length;

describe('War', () => {
  it('splits the deck 26–26 and is deterministic', () => {
    const v = new WarEngine(1).view;
    expect(v.decks.map((d) => d.length)).toEqual([26, 26]);
    expect(new Set([...v.decks[0], ...v.decks[1]].map((x) => x.id)).size).toBe(52);
    expect(new WarEngine(8).view).toEqual(new WarEngine(8).view);
  });

  it('the higher card takes both, Ace high', () => {
    const e = new WarEngine(1);
    inner(e).state.decks = [[c('A'), c('2')], [c('K'), c('3')]];
    const b = e.battle()!;
    expect(b.winner).toBe(0);
    expect(b.wars).toBe(0);
    expect(e.view.decks[0]).toHaveLength(3);
    expect(e.battle()!.winner).toBe(1);
  });

  it('a tie goes to war: three down, one up', () => {
    const e = new WarEngine(1);
    inner(e).state.decks = [
      [c('9'), c('2'), c('3'), c('4'), c('K'), c('5')],
      [c('9', 'hearts'), c('2', 'hearts'), c('3', 'hearts'), c('4', 'hearts'), c('Q'), c('6')],
    ];
    const b = e.battle()!;
    expect(b.wars).toBe(1);
    expect(b.winner).toBe(0);
    expect(b.table[0].map((t) => t.up)).toEqual([true, false, false, false, true]);
    expect(e.view.decks.map((d) => d.length)).toEqual([11, 1]);
  });

  it('a short war uses every card but the last, and running out loses', () => {
    const e = new WarEngine(1);
    inner(e).state.decks = [
      [c('9'), c('2'), c('K')],
      [c('9', 'hearts'), c('Q')],
    ];
    const b = e.battle()!;
    // Player 2 had one card left: no face-down cards, it goes face up.
    expect(b.table[1].map((t) => t.up)).toEqual([true, true]);
    expect(b.table[0].map((t) => t.up)).toEqual([true, false, true]);
    expect(b.winner).toBe(0);
    expect(e.result()).toBe(0);
    expect(e.battle()).toBeNull();
  });

  it('classic games end with one player holding all 52', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = new WarEngine(seed);
      while (e.battle());
      expect(total(e.view)).toBe(52);
      const r = e.result();
      expect(r).not.toBeNull();
      if (e.view.battles < 1500) expect(e.counts()).toContain(52);
    }
  });

  it('quick games end after one pass with the bigger pile winning', () => {
    const e = new WarEngine(3, 'quick');
    let n = 0;
    while (e.battle()) n++;
    expect(n).toBeLessThanOrEqual(26);
    const v = e.view;
    expect(total(v)).toBe(52);
    expect(v.decks[0].length === 0 || v.decks[1].length === 0).toBe(true);
    const [a, b] = e.counts();
    expect(e.result()).toBe(a === b ? 'draw' : a > b ? 0 : 1);
  });
});
