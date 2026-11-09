import { Card, sortHand } from '../../shared/models/card.model';
import { createStandardDeck, dealRoundRobin, shuffle } from '../core/deck';
import {
  CardSelection,
  FloorPile,
  GameAction,
  GameOutcome,
  GameSettings,
  IllegalActionError,
  LegalAction,
  SeatConfig,
  SeatResult,
  TableGameEngine,
  TableView,
} from '../core/table-game';
import { BaseTableEngine, SUIT_GLYPH } from '../core/tricks';

/**
 * Donkey — a draw-and-match fishing game for 2 to 6 players. Each player gets 4 cards and 4 more
 * go face up on the table; the rest is the deck.
 *
 * On your turn draw a card into your hand, then play any card from your hand. If it has the same
 * rank as a table card or as the top card of any captured pile — an opponent's or your own — it
 * captures: both cards go on your pile and you draw again. Robbing an opponent takes every card
 * of that rank from the top of their pile (a captured pair of 3s goes together); matching your
 * own pile simply adds the card to it. A card that matches nothing is thrown face up on the table and
 * your turn ends.
 *
 * Once the deck is empty there is no drawing: players take turns playing one hand card each,
 * capturing or throwing as above. When every hand is empty the round ends and captured cards
 * score: 2–9 are 5 points, 10–K 10 and Aces 20 (400 in the deck). Rounds continue until someone
 * reaches the target; the highest total wins.
 */

export type DonkeyPhase = 'draw' | 'play';

export interface DonkeyView extends TableView {
  phase: DonkeyPhase;
  round: number;
  /** Face-up cards on the table. */
  table: Card[];
  /** Each player's captured cards, last captured on top. */
  piles: Card[][];
  stockCount: number;
  /** Every card captured or thrown this round (public knowledge). */
  seen: Card[];
  roundPoints: number[];
  totals: number[];
  target: number;
}

export const HAND_SIZE = 4;
export const TABLE_SIZE = 4;

/** 2–9 are 5 points, 10–K 10, Aces 20. */
export const cardValue = (c: Card) => (c.rank === 'A' ? 20 : ['10', 'J', 'Q', 'K'].includes(c.rank) ? 10 : 5);
export const pilePoints = (cards: readonly Card[]) => cards.reduce((s, c) => s + cardValue(c), 0);

const STOCK_BACK: Card = { id: 'stock-back', suit: 'spades', rank: 'A' };
const glyph = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;
const RANK_NAMES: Partial<Record<Card['rank'], string>> = { J: 'Jacks', Q: 'Queens', K: 'Kings', A: 'Aces' };
const rankName = (c: Card) => RANK_NAMES[c.rank] ?? `${c.rank}s`;

export class DonkeyEngine extends BaseTableEngine implements TableGameEngine<DonkeyView> {
  readonly slug = 'donkey';
  readonly target: number;
  private readonly n: number;

  private hands: Card[][] = [];
  private stock: Card[] = [];
  private table: Card[] = [];
  private piles: Card[][] = [];
  private drawn: Card | null = null;
  private seen: Card[] = [];
  private round = 0;
  private turn: number | null = null;
  private phase: DonkeyPhase = 'draw';
  private totals: number[];
  private pendingState: 'hand' | null = null;
  /** Seat that took a table card with the last action, for the capture animation. */
  private taker: number | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length < 2 || seats.length > 6) throw new Error('Donkey needs 2 to 6 players');
    this.n = seats.length;
    this.target = Number(settings['target'] ?? 300);
    this.totals = Array(this.n).fill(0);
  }

  initializeGame(): void {
    this.startRound();
  }

  // ------------------------------------------------------------------ flow

  private startRound(): void {
    this.round += 1;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = dealRoundRobin(deck.slice(0, HAND_SIZE * this.n), this.n);
    this.table = deck.slice(HAND_SIZE * this.n, HAND_SIZE * this.n + TABLE_SIZE);
    this.stock = deck.slice(HAND_SIZE * this.n + TABLE_SIZE);
    this.piles = Array.from({ length: this.n }, () => []);
    this.seen = [...this.table];
    this.drawn = null;
    this.summary = null;
    // The player after the dealer starts; the deal rotates each round.
    this.turn = this.round % this.n;
    this.phase = 'draw';
  }

  /** Where `card` could be paired: table card ids, then pile tops ('pile:<seat>'), your own included. */
  private targets(card: Card): string[] {
    const out = this.table.filter((t) => t.rank === card.rank).map((t) => t.id);
    this.piles.forEach((p, i) => {
      if (p.length && p[p.length - 1].rank === card.rank) out.push(`pile:${i}`);
    });
    return out;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    this.taker = null;
    if (action.type === 'draw') {
      this.drawn = this.stock.pop()!;
      this.hands[seat].push(this.drawn);
      this.phase = 'play';
      return;
    }
    const i = this.hands[seat].findIndex((c) => c.id === action.cardId);
    const card = this.hands[seat].splice(i, 1)[0];
    this.drawn = null;
    if (action.value === undefined) {
      this.table.push(card);
      this.seen.push(card);
      return this.nextTurn(seat);
    }
    this.capture(seat, card, String(action.value));
    // With cards left in the deck a capture earns another draw; afterwards it's one card a turn.
    if (this.stock.length) this.phase = 'draw';
    else this.nextTurn(seat);
  }

  private capture(seat: number, card: Card, target: string): void {
    if (target === `pile:${seat}`) {
      // Pairs with the top of your own pile: the card just joins it.
      this.piles[seat].push(card);
    } else if (target.startsWith('pile:')) {
      const from = Number(target.slice(5));
      const taken = this.topRun(from);
      this.piles[from].length -= taken.length;
      this.piles[seat].push(...taken, card);
      const what = taken.length === 1 ? glyph(taken[0]) : `${taken.length} ${rankName(card)}`;
      this.announce('success', `${this.seats[seat].name} takes ${what} from ${this.seats[from].name}’s pile!`);
    } else {
      this.piles[seat].push(this.table.splice(this.table.findIndex((c) => c.id === target), 1)[0], card);
      this.taker = seat;
    }
    this.seen.push(card);
  }

  /** The cards of the top card's rank sitting together on top of a pile. */
  private topRun(seat: number): Card[] {
    const pile = this.piles[seat];
    let i = pile.length - 1;
    while (i > 0 && pile[i - 1].rank === pile[pile.length - 1].rank) i--;
    return pile.slice(i);
  }

  private nextTurn(seat: number): void {
    if (!this.stock.length && this.hands.every((h) => !h.length)) return this.endRound();
    // Once the deck is gone, skip players with nothing left to play.
    let next = (seat + 1) % this.n;
    while (!this.stock.length && !this.hands[next].length) next = (next + 1) % this.n;
    this.turn = next;
    this.phase = this.stock.length ? 'draw' : 'play';
  }

  private endRound(): void {
    this.turn = null;
    this.pendingState = 'hand';
    const points = this.piles.map((p) => pilePoints(p));
    points.forEach((p, i) => (this.totals[i] += p));
    const best = Math.max(...points);
    const leaders = this.seats.filter((_, i) => points[i] === best).map((s) => s.name);
    this.summary = {
      title: leaders.length === 1 ? `${leaders[0]} wins the round with ${best} points` : `Round tied at ${best} points`,
      lines: this.seats.map((s, i) => `${s.name}: ${this.piles[i].length} cards, +${points[i]} (total ${this.totals[i]})`),
    };
  }

  pending(): 'trick' | 'hand' | null {
    return this.pendingState;
  }

  resolve(): void {
    if (this.pendingState !== 'hand') throw new IllegalActionError('Nothing to resolve');
    this.pendingState = null;
    if (this.totals.some((t) => t >= this.target)) {
      this.finished = true;
      return;
    }
    this.startRound();
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  /** Draw; or play a hand card — once per target it can capture, or as a throw when it matches nothing. */
  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    if (this.phase === 'draw') return [{ type: 'draw', label: 'Draw a card' }];
    const seat = this.seatIndex(playerId);
    return this.hands[seat].flatMap((c): LegalAction[] => {
      const targets = this.targets(c);
      if (!targets.length) return [{ type: 'play', cardId: c.id, label: `Throw ${glyph(c)}` }];
      return targets.map((t) => ({ type: 'play', cardId: c.id, value: t, label: this.targetLabel(seat, t) }));
    });
  }

  private targetLabel(seat: number, t: string): string {
    if (t.startsWith('pile:')) {
      const i = Number(t.slice(5));
      const top = this.piles[i][this.piles[i].length - 1];
      if (i === seat) return `Add to your pile (${glyph(top)})`;
      const n = this.topRun(i).length;
      return n === 1 ? `Take ${glyph(top)} from ${this.seats[i].name}` : `Take ${this.seats[i].name}’s ${n} ${rankName(top)}`;
    }
    return `Take ${glyph(this.table.find((c) => c.id === t)!)}`;
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    const positions = this.totals.map((t) => 1 + this.totals.filter((o) => o > t).length);
    const worst = Math.max(...positions);
    const firsts = positions.filter((p) => p === 1).length;
    const result = (p: number): SeatResult => (p === 1 ? (firsts > 1 ? 'draw' : 'win') : p === worst ? 'loss' : 'safe');
    const leaders = this.seats.filter((_, i) => positions[i] === 1).map((s) => s.name);
    const best = Math.max(...this.totals);
    return {
      players: this.seats.map((s, i) => ({ id: s.id, position: positions[i], result: result(positions[i]), score: this.totals[i] })),
      summary: leaders.length === 1 ? `${leaders[0]} wins with ${best} points` : `${leaders.join(' and ')} tie with ${best} points`,
    };
  }

  getView(viewerId: string): DonkeyView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const mine = current === viewerId;
    const legal = mine ? this.legalActions(viewerId) : [];
    // Tapping a glowing table card or pile plays the hand card that matches it.
    const action = (pred: (a: LegalAction) => boolean) => {
      const a = legal.find(pred);
      return a ? { action: { type: a.type, ...(a.cardId ? { cardId: a.cardId } : {}), ...(a.value !== undefined ? { value: a.value } : {}) } } : {};
    };
    const canCapture = legal.some((a) => a.type === 'play' && a.value !== undefined);

    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (!current) phaseLabel = 'Round over';
    else if (!mine) phaseLabel = `Waiting for ${this.seats[this.seatIndex(current)].name}…`;
    else if (this.phase === 'draw') phaseLabel = 'Draw a card from the deck';
    else if (canCapture) phaseLabel = 'You have a match! Tap a glowing card to take it — or throw a card to end your turn';
    else phaseLabel = this.stock.length ? 'No match — throw a card from your hand to end your turn' : 'Deck is empty — play a card from your hand';

    const roundPoints = this.piles.map((p) => pilePoints(p));
    // Ids follow the card, so cards glide when the table shifts.
    const floor: FloorPile[] = [
      {
        id: 'stock',
        cards: this.stock.length ? [STOCK_BACK] : [],
        label: `Deck · ${this.stock.length}`,
        faceDown: true,
        ...action((a) => a.type === 'draw'),
      },
      ...this.table.map((c) => ({ id: `c-${c.id}`, cards: [c], label: null, ...action((a) => a.value === c.id) })),
    ];

    return structuredClone({
      slug: this.slug,
      viewerId,
      phase: this.phase,
      phaseLabel,
      players: this.seats.map((s, i) => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        isBot: s.isBot,
        team: null,
        cardCount: this.hands[i].length,
        stat: `${roundPoints[i]} pts`,
        badges: (this.round - 1) % this.n === i ? ['Dealer'] : [],
        pile: { top: this.piles[i][this.piles[i].length - 1] ?? null, count: this.piles[i].length, ...action((a) => a.value === `pile:${i}`) },
      })),
      hand: sortHand(this.hands[me]),
      freshCardId: mine && this.drawn ? this.drawn.id : null,
      currentPlayerId: current,
      trick: [],
      leadSuit: null,
      trickWinnerId: null,
      trump: null,
      floor,
      floorHint: 'The table is empty',
      floorTaker: this.taker === null ? null : this.seats[this.taker].id,
      scores: {
        title: 'Scores',
        columns: ['Round', 'Total'],
        rows: this.seats.map((s, i) => ({ label: s.name, values: [roundPoints[i], this.totals[i]], highlight: i === me })),
      },
      info: [`Round ${this.round}`, `To ${this.target}`],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      round: this.round,
      table: this.table,
      piles: this.piles,
      stockCount: this.stock.length,
      seen: this.seen,
      roundPoints,
      totals: this.totals,
      target: this.target,
    } satisfies DonkeyView);
  }
}
