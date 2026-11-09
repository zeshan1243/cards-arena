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
 * Donkey — a draw-and-match fishing game for 2 or 3 players. Each player gets 4 cards and 4 more
 * go face up on the table; the rest is the deck.
 *
 * On your turn draw from the deck. If the card has the same rank as a table card, or as the top
 * card of an opponent's captured pile, you must take the pair onto your own pile, then draw
 * again. If it matches nothing, throw it face up on the table — or keep it and throw a card
 * from your hand instead — and your turn ends.
 *
 * Once the deck is empty, players take turns playing their hand cards one at a time: a card that
 * matches captures as above, otherwise it stays on the table. When every hand is empty the round
 * ends and captured cards score: 2–9 are 5 points, 10–K 10 and Aces 20 (400 in the deck). Rounds
 * continue until someone reaches the target; the highest total wins.
 */

export type DonkeyPhase = 'draw' | 'match' | 'throw' | 'play';

export interface DonkeyView extends TableView {
  phase: DonkeyPhase;
  round: number;
  /** Face-up cards on the table. */
  table: Card[];
  /** Each player's captured cards, last captured on top. */
  piles: Card[][];
  /** Card drawn (or played) this turn that still has to be placed. */
  active: Card | null;
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

export class DonkeyEngine extends BaseTableEngine implements TableGameEngine<DonkeyView> {
  readonly slug = 'donkey';
  readonly target: number;
  private readonly n: number;

  private hands: Card[][] = [];
  private stock: Card[] = [];
  private table: Card[] = [];
  private piles: Card[][] = [];
  private active: Card | null = null;
  private seen: Card[] = [];
  private round = 0;
  private turn: number | null = null;
  private phase: DonkeyPhase = 'draw';
  private totals: number[];
  private pendingState: 'hand' | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length < 2 || seats.length > 3) throw new Error('Donkey needs 2 or 3 players');
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
    this.active = null;
    this.summary = null;
    // The player after the dealer starts; the deal rotates each round.
    this.turn = this.round % this.n;
    this.phase = 'draw';
  }

  /** Where `card` could be paired: table card ids and opponents' pile tops ('pile:<seat>'). */
  private targets(seat: number, card: Card): string[] {
    const out = this.table.filter((t) => t.rank === card.rank).map((t) => t.id);
    this.piles.forEach((p, i) => {
      if (i !== seat && p.length && p[p.length - 1].rank === card.rank) out.push(`pile:${i}`);
    });
    return out;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    switch (action.type) {
      case 'draw':
        this.active = this.stock.pop()!;
        this.phase = this.targets(seat, this.active).length ? 'match' : 'throw';
        return;
      case 'play': {
        // Deck empty: a hand card becomes the active card.
        const card = this.takeFromHand(seat, action.cardId!);
        this.active = card;
        if (this.targets(seat, card).length) this.phase = 'match';
        else this.place(card, seat);
        return;
      }
      case 'choose':
        return this.capture(seat, String(action.value));
      case 'discard': {
        const active = this.active!;
        if (action.cardId === active.id) return this.place(active, seat);
        // Keep the drawn card and throw a hand card instead.
        const thrown = this.takeFromHand(seat, action.cardId!);
        this.hands[seat].push(active);
        return this.place(thrown, seat);
      }
      default:
        throw new IllegalActionError(`Illegal action ${action.type}`);
    }
  }

  private takeFromHand(seat: number, id: string): Card {
    const i = this.hands[seat].findIndex((c) => c.id === id);
    if (i < 0) throw new IllegalActionError('You do not hold that card');
    return this.hands[seat].splice(i, 1)[0];
  }

  private capture(seat: number, target: string): void {
    const card = this.active!;
    let taken: Card;
    if (target.startsWith('pile:')) {
      const from = Number(target.slice(5));
      taken = this.piles[from].pop()!;
      this.announce('success', `${this.seats[seat].name} takes ${glyph(taken)} from ${this.seats[from].name}’s pile!`);
    } else {
      taken = this.table.splice(this.table.findIndex((c) => c.id === target), 1)[0];
    }
    this.piles[seat].push(taken, card);
    this.seen.push(card);
    this.active = null;
    // With cards left in the deck a capture earns another draw; afterwards it's one card a turn.
    if (this.stock.length) this.phase = 'draw';
    else this.nextTurn(seat);
  }

  /** The card goes face up on the table and the turn passes. */
  private place(card: Card, seat: number): void {
    this.table.push(card);
    this.seen.push(card);
    this.active = null;
    this.nextTurn(seat);
  }

  private nextTurn(seat: number): void {
    if (!this.stock.length && this.hands.every((h) => !h.length)) return this.endRound();
    // Skip players with nothing left to do once the deck is gone.
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

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    switch (this.phase) {
      case 'draw':
        return [{ type: 'draw', label: 'Draw a card' }];
      case 'match':
        return this.targets(seat, this.active!).map((t) => ({ type: 'choose', value: t, label: this.targetLabel(t) }));
      case 'throw':
        return [
          { type: 'discard', cardId: this.active!.id, label: `Throw ${glyph(this.active!)}` },
          ...this.hands[seat].map((c) => ({ type: 'discard' as const, cardId: c.id, label: `Keep ${glyph(this.active!)}, throw ${glyph(c)}` })),
        ];
      case 'play':
        return this.hands[seat].map((c) => ({ type: 'play', cardId: c.id, label: `Play ${glyph(c)}` }));
    }
  }

  private targetLabel(t: string): string {
    if (t.startsWith('pile:')) {
      const i = Number(t.slice(5));
      const top = this.piles[i][this.piles[i].length - 1];
      return `Take ${glyph(top)} from ${this.seats[i].name}`;
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
    const action = (pred: (a: LegalAction) => boolean) => {
      const a = legal.find(pred);
      return a ? { action: { type: a.type, cardId: a.cardId, value: a.value } as GameAction } : {};
    };

    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (!current) phaseLabel = 'Round over';
    else if (!mine) phaseLabel = `Waiting for ${this.seats[this.seatIndex(current)].name}…`;
    else if (this.phase === 'draw') phaseLabel = 'Draw a card from the deck';
    else if (this.phase === 'match') phaseLabel = `${glyph(this.active!)} matches! Tap the card to take`;
    else if (this.phase === 'throw') phaseLabel = `No match — throw the ${glyph(this.active!)}, or tap a hand card to throw instead`;
    else phaseLabel = 'Deck is empty — play a card from your hand';

    const roundPoints = this.piles.map((p) => pilePoints(p));
    const floor: FloorPile[] = [
      {
        id: 'stock',
        cards: this.stock.length ? [STOCK_BACK] : [],
        label: `Deck · ${this.stock.length}`,
        faceDown: true,
        ...action((a) => a.type === 'draw'),
      },
      ...(this.active
        ? [
            {
              id: `active-${this.active.id}`,
              cards: [this.active],
              label: this.phase === 'throw' && mine ? 'Tap to throw' : 'Drawn',
              from: this.seats[this.turn!].id,
              ...action((a) => a.type === 'discard' && a.cardId === this.active!.id),
            },
          ]
        : []),
      ...this.table.map((c) => ({ id: `t-${c.id}`, cards: [c], label: null, ...action((a) => a.value === c.id) })),
      ...this.piles.flatMap((p, i) =>
        p.length
          ? [
              {
                id: `pile-${i}`,
                cards: [p[p.length - 1]],
                label: `${i === me ? 'Your' : this.seats[i].name + '’s'} pile · ${p.length}`,
                owner: this.seats[i].id,
                ...action((a) => a.value === `pile:${i}`),
              },
            ]
          : [],
      ),
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
        stat: `${roundPoints[i]} pts this round`,
        badges: (this.round - 1) % this.n === i ? ['Dealer'] : [],
      })),
      hand: sortHand(this.hands[me]),
      currentPlayerId: current,
      trick: [],
      leadSuit: null,
      trickWinnerId: null,
      trump: null,
      floor,
      floorHint: 'The table is empty',
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
      active: this.active,
      stockCount: this.stock.length,
      seen: this.seen,
      roundPoints,
      totals: this.totals,
      target: this.target,
    } satisfies DonkeyView);
  }
}
