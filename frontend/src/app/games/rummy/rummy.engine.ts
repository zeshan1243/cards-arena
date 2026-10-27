import { Card } from '../../shared/models/card.model';
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
import { Meld, bySuitRank, classifyMeld, handPoints, layOff, meldLabel } from './rummy.rules';

/**
 * Classic Rummy — 2 to 4 players, every player for themselves. 2 players get 10 cards, 3–4 get 7.
 * The rest is the stock; its top card starts the discard pile. The player left of the dealer
 * starts, and the deal rotates each hand.
 *
 * On your turn: draw the top card of the stock or of the discard pile; then lay down any sets
 * (3–4 of a rank) or runs (3+ in a row in one suit, Ace low) and lay off cards onto any meld on
 * the table; then discard one card. You may not discard the card you just took from the discard
 * pile (unless it is your last card). You go out when your hand is empty — by discarding your
 * last card or by melding everything.
 *
 * The player who goes out scores the cards left in everyone else's hand (Ace 1, 2–10 face value,
 * J/Q/K 10). When the stock runs out the discard pile (minus its top card) is shuffled into a
 * new stock; after 3 reshuffles the hand ends with no score. After a hand in which someone
 * reaches the target the game ends; most points wins.
 */

export type RummyPhase = 'draw' | 'play';

export interface RummyView extends TableView {
  phase: RummyPhase;
  handNumber: number;
  melds: { owner: string; type: Meld['type']; cards: Card[] }[];
  discardTop: Card | null;
  discardCount: number;
  stockCount: number;
  /** Card taken from the discard pile this turn (it may not go straight back). */
  takenFromDiscard: string | null;
  /** Every card thrown on the discard pile this hand (public). */
  discarded: Card[];
  totals: number[];
  target: number;
}

const MAX_RESHUFFLES = 3;
/** Placeholder shown face down for the stock. */
const STOCK_BACK: Card = { id: 'stock-back', suit: 'spades', rank: 'A' };
const glyph = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;

export class RummyEngine extends BaseTableEngine implements TableGameEngine<RummyView> {
  readonly slug = 'rummy';
  readonly target: number;
  private readonly n: number;

  private hands: Card[][] = [];
  private stock: Card[] = [];
  private discard: Card[] = [];
  private melds: { owner: number; meld: Meld }[] = [];
  private discarded: Card[] = [];
  private handNumber = 0;
  private turn: number | null = null;
  private phase: RummyPhase = 'draw';
  private takenFromDiscard: string | null = null;
  private reshuffles = 0;
  private totals: number[];
  private pendingState: 'hand' | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length < 2 || seats.length > 4) throw new Error('Rummy needs 2 to 4 players');
    this.n = seats.length;
    this.target = Number(settings['target'] ?? 100);
    this.totals = Array(this.n).fill(0);
  }

  initializeGame(): void {
    this.startHand();
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    const size = this.n === 2 ? 10 : 7;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = dealRoundRobin(deck.slice(0, size * this.n), this.n);
    this.stock = deck.slice(size * this.n);
    this.discard = [this.stock.pop()!];
    this.discarded = [...this.discard];
    this.melds = [];
    this.reshuffles = 0;
    this.summary = null;
    const dealer = (this.handNumber - 1) % this.n;
    this.turn = (dealer + 1) % this.n;
    this.phase = 'draw';
    this.takenFromDiscard = null;
  }

  private canDrawStock(): boolean {
    return this.stock.length > 0 || (this.discard.length > 1 && this.reshuffles < MAX_RESHUFFLES);
  }

  protected override validate(playerId: string, action: GameAction): void {
    if (action.type === 'draw') return super.validate(playerId, action);
    if (this.phase !== 'play') throw new IllegalActionError('Draw a card first');
    const hand = this.hands[this.seatIndex(playerId)];
    const ids = action.type === 'discard' ? [action.cardId ?? ''] : (action.cardIds ?? []);
    if (!ids.length || new Set(ids).size !== ids.length || !ids.every((id) => hand.some((c) => c.id === id))) {
      throw new IllegalActionError('Choose cards from your hand');
    }
    const cards = ids.map((id) => hand.find((c) => c.id === id)!);
    if (action.type === 'meld') {
      if (!classifyMeld(cards)) throw new IllegalActionError('A meld is 3–4 cards of one rank, or 3+ cards in a row of one suit');
    } else if (action.type === 'lay-off') {
      if (this.layOffTarget(cards) < 0) throw new IllegalActionError('Those cards don’t fit any meld on the table');
    } else if (action.type === 'discard') {
      if (ids[0] === this.takenFromDiscard && hand.length > 1) throw new IllegalActionError('You can’t throw back the card you just picked up');
    } else {
      throw new IllegalActionError(`Illegal action ${action.type}`);
    }
  }

  /** First meld on the table the cards can be added to, or -1. */
  private layOffTarget(cards: readonly Card[]): number {
    return this.melds.findIndex((m) => layOff(m.meld, cards) !== null);
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'draw') {
      if (action.value === 'discard') {
        const card = this.discard.pop()!;
        this.hands[seat].push(card);
        this.takenFromDiscard = card.id;
      } else {
        if (!this.stock.length) this.reshuffle();
        this.hands[seat].push(this.stock.pop()!);
        this.takenFromDiscard = null;
      }
      this.phase = 'play';
      return;
    }
    const ids = action.type === 'discard' ? [action.cardId!] : action.cardIds!;
    const cards = ids.map((id) => this.hands[seat].find((c) => c.id === id)!);
    this.hands[seat] = this.hands[seat].filter((c) => !ids.includes(c.id));
    if (action.type === 'meld') {
      this.melds.push({ owner: seat, meld: classifyMeld(cards)! });
    } else if (action.type === 'lay-off') {
      const i = this.layOffTarget(cards);
      this.melds[i] = { owner: this.melds[i].owner, meld: layOff(this.melds[i].meld, cards)! };
    } else {
      this.discard.push(cards[0]);
      this.discarded.push(cards[0]);
    }
    if (!this.hands[seat].length) return this.endHand(seat);
    if (action.type === 'discard') {
      this.turn = (seat + 1) % this.n;
      this.phase = 'draw';
      this.takenFromDiscard = null;
      if (!this.canDrawStock()) this.endHand(null);
    }
  }

  private reshuffle(): void {
    const top = this.discard.pop()!;
    this.stock = shuffle(this.discard, this.rng);
    this.discard = [top];
    this.reshuffles += 1;
    this.announce('info', 'Discard pile shuffled into a new stock');
  }

  private endHand(winner: number | null): void {
    this.turn = null;
    this.pendingState = 'hand';
    if (winner === null) {
      this.summary = { title: `Hand ${this.handNumber}: no winner`, lines: ['The stock ran out too many times — nobody scores.'] };
      return;
    }
    const left = this.hands.map((h) => handPoints(h));
    const gained = left.reduce((a, b) => a + b, 0);
    this.totals[winner] += gained;
    this.announce('success', `${this.seats[winner].name} goes out!`);
    this.summary = {
      title: `${this.seats[winner].name} goes out and scores ${gained}`,
      lines: this.seats.map((s, i) => (i === winner ? `${s.name}: +${gained} (total ${this.totals[i]})` : `${s.name}: ${left[i]} left in hand (total ${this.totals[i]})`)),
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
    this.startHand();
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  /** Drawing is a button / pile click; everything after that goes through `cardSelection`. */
  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId || this.phase !== 'draw') return [];
    const out: LegalAction[] = [];
    if (this.canDrawStock()) out.push({ type: 'draw', value: 'stock', label: 'Draw from stock' });
    const top = this.discard[this.discard.length - 1];
    if (top) out.push({ type: 'draw', value: 'discard', label: `Take ${glyph(top)}` });
    return out;
  }

  cardSelection(playerId: string): CardSelection | null {
    if (this.currentPlayerId() !== playerId || this.phase !== 'play') return null;
    const hand = this.hands[this.seatIndex(playerId)];
    const n = hand.length;
    const pick = (ids: string[]) => ids.map((id) => hand.find((c) => c.id === id)).filter((c): c is Card => !!c);
    return {
      count: n,
      minCount: 1,
      label: 'Select cards',
      actionType: 'discard',
      actions: [
        { actionType: 'meld', label: 'Meld', minCount: 3, maxCount: n, isValid: (ids) => classifyMeld(pick(ids)) !== null },
        ...(this.melds.length
          ? [{ actionType: 'lay-off' as const, label: 'Lay off', minCount: 1, maxCount: n, isValid: (ids: string[]) => this.layOffTarget(pick(ids)) >= 0 }]
          : []),
        { actionType: 'discard', label: 'Discard', minCount: 1, maxCount: 1, isValid: (ids) => ids[0] !== this.takenFromDiscard || n === 1 },
      ],
    };
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
    const summary =
      leaders.length === 1
        ? `${leaders[0]} wins with ${best} points`
        : `${leaders.slice(0, -1).join(', ')} and ${leaders[leaders.length - 1]} tie with ${best} points`;
    return {
      players: this.seats.map((s, i) => ({ id: s.id, position: positions[i], result: result(positions[i]), score: this.totals[i] })),
      summary,
    };
  }

  getView(viewerId: string): RummyView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const mine = current === viewerId;
    const top = this.discard[this.discard.length - 1] ?? null;
    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (!current) phaseLabel = 'Hand over';
    else if (!mine) phaseLabel = `Waiting for ${this.seats[this.seatIndex(current)].name}…`;
    else if (this.phase === 'draw') phaseLabel = top ? `Draw from the stock or take the ${glyph(top)}` : 'Draw from the stock';
    else phaseLabel = 'Meld or lay off cards, then discard one to end your turn';

    const drawing = mine && this.phase === 'draw';
    const floor: FloorPile[] = [
      {
        id: 'stock',
        cards: this.stock.length ? [STOCK_BACK] : [], // face down: don't reveal the real card
        label: `Stock · ${this.stock.length}`,
        faceDown: true,
        ...(drawing && this.canDrawStock() ? { action: { type: 'draw', value: 'stock' } } : {}),
      },
      {
        id: 'discard',
        cards: top ? [top] : [],
        label: `Discard · ${this.discard.length}`,
        ...(drawing && top ? { action: { type: 'draw', value: 'discard' } } : {}),
      },
      ...this.melds.map((m, i) => ({
        id: `h${this.handNumber}-m${i}`,
        cards: m.meld.cards,
        label: `${this.seats[m.owner].name} · ${meldLabel(m.meld)}`,
        from: this.seats[m.owner].id,
      })),
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
        stat: `${this.totals[i]} pts`,
        badges: (this.handNumber - 1) % this.n === i ? ['Dealer'] : [],
      })),
      hand: [...this.hands[me]].sort(bySuitRank),
      currentPlayerId: current,
      trick: [],
      leadSuit: null,
      trickWinnerId: null,
      trump: null,
      floor,
      scores: {
        title: 'Scores',
        columns: ['Cards', 'Total'],
        rows: this.seats.map((s, i) => ({ label: s.name, values: [this.hands[i].length, this.totals[i]], highlight: i === me })),
      },
      info: [`Hand ${this.handNumber}`, `To ${this.target}`],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      handNumber: this.handNumber,
      melds: this.melds.map((m) => ({ owner: this.seats[m.owner].id, type: m.meld.type, cards: m.meld.cards })),
      discardTop: top,
      discardCount: this.discard.length,
      stockCount: this.stock.length,
      takenFromDiscard: mine ? this.takenFromDiscard : null,
      discarded: this.discarded,
      totals: this.totals,
      target: this.target,
    } satisfies RummyView);
  }
}
