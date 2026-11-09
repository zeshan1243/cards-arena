import { Card, rankValue } from '../../shared/models/card.model';
import { Rng, createStandardDeck, seededRng, shuffle } from '../core/deck';

/**
 * War, you against the computer. The deck is split 26–26. Each battle both players turn their
 * top card and the higher rank (Ace high) takes both. On a tie it's war: each lays three cards
 * face down and one face up, and the higher new card takes the whole pot; ties repeat the war.
 *
 * Classic: winnings go to the bottom of the winner's deck and the game runs until one player
 * has all 52 cards (or can't finish a war). Quick: winnings go aside, and once either deck runs
 * out the player holding more cards wins.
 */

export type WarMode = 'classic' | 'quick';
export type Side = 0 | 1;

/** Classic games almost always end well before this; it stops a rare endless loop. */
export const MAX_BATTLES = 1500;

export interface TableCard {
  card: Card;
  up: boolean;
}

export interface Battle {
  /** Cards each side put down this battle, in order. */
  table: [TableCard[], TableCard[]];
  winner: Side;
  /** How many wars the battle went through. */
  wars: number;
}

export interface WarState {
  decks: [Card[], Card[]];
  /** Quick mode winnings, set aside. Always empty in Classic. */
  won: [Card[], Card[]];
  battles: number;
  wars: number;
}

export class WarEngine {
  private state: WarState;
  private readonly rng: Rng;

  constructor(
    readonly seed: number,
    readonly mode: WarMode = 'classic',
  ) {
    this.rng = seededRng(seed);
    const deck = shuffle(createStandardDeck(), this.rng);
    this.state = { decks: [deck.slice(0, 26), deck.slice(26)], won: [[], []], battles: 0, wars: 0 };
  }

  get view(): WarState {
    return structuredClone(this.state);
  }

  /** Cards each side holds in total. */
  counts(): [number, number] {
    const s = this.state;
    return [s.decks[0].length + s.won[0].length, s.decks[1].length + s.won[1].length];
  }

  /** The winner, 'draw', or null while the game goes on. */
  result(): Side | 'draw' | null {
    const [a, b] = this.state.decks.map((d) => d.length);
    const ended = this.mode === 'quick' ? !a || !b : !a || !b || this.state.battles >= MAX_BATTLES;
    if (!ended) return null;
    const [ca, cb] = this.counts();
    return ca === cb ? 'draw' : ca > cb ? 0 : 1;
  }

  /** Play one battle, including any wars. */
  battle(): Battle | null {
    if (this.result() !== null) return null;
    const s = this.state;
    const table: [TableCard[], TableCard[]] = [[], []];
    let wars = 0;
    let winner: Side | null = null;
    for (;;) {
      const a = s.decks[0].shift();
      const b = s.decks[1].shift();
      if (a) table[0].push({ card: a, up: true });
      if (b) table[1].push({ card: b, up: true });
      // Someone couldn't turn a card (only possible mid-war): they lose the pot.
      if (!a || !b) {
        winner = a ? 0 : 1;
        break;
      }
      const diff = rankValue(a.rank) - rankValue(b.rank);
      if (diff) {
        winner = diff > 0 ? 0 : 1;
        break;
      }
      wars += 1;
      // Three face down each, keeping one card back to turn face up.
      for (const side of [0, 1] as const) {
        const n = Math.min(3, Math.max(0, s.decks[side].length - 1));
        table[side].push(...s.decks[side].splice(0, n).map((card) => ({ card, up: false })));
      }
    }
    // Shuffling the pot keeps Classic games from cycling forever.
    const pot = shuffle([...table[0], ...table[1]].map((t) => t.card), this.rng);
    if (this.mode === 'classic') s.decks[winner].push(...pot);
    else s.won[winner].push(...pot);
    s.battles += 1;
    s.wars += wars;
    return { table, winner, wars };
  }
}
