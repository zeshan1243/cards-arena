import { Card } from '../../shared/models/card.model';
import { createStandardDeck, dealRoundRobin, shuffle } from '../core/deck';
import {
  CardSelection,
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
import { Combo, beats, byPower, classify, comboLabel, enumeratePlays } from './thirteen.rules';

/**
 * Thirteen (Tiến Lên) — 2 to 4 players, every player for themselves, 13 cards each.
 *
 * The lowest card dealt (3♠ with four players) must be part of the first play of the game.
 * Lay a single, pair, triple, four of a kind, run (3+ ranks) or run of pairs (3+ pairs);
 * the next players must beat it with the same shape and a higher top card, or pass.
 * Passing locks you out until the round ends. Bombs beat 2s: four of a kind or 3+ pairs
 * in a row beat a single 2, 4+ pairs beat a pair of 2s, 5+ pairs beat three 2s; four of a
 * kind beats 3 pairs in a row, and 4+ pairs beat four of a kind.
 *
 * When everyone else has passed, the last player to play leads a new round (or, if they
 * just went out, the next player still in). Play continues until one player is left.
 * Finishing 1st of n scores n−1 points, 2nd n−2 … last 0. The winner of a hand leads the
 * next. After a hand in which someone reaches the target the game ends; most points wins.
 */

export type ThirteenPhase = 'lead' | 'follow';

export interface ThirteenView extends TableView {
  phase: ThirteenPhase;
  handNumber: number;
  /** Combination to beat, or null when leading. */
  table: { playerId: string; cards: Card[]; combo: Combo } | null;
  /** Card that must be part of the next play (first play of the game only). */
  mustInclude: string | null;
  /** Seats that have passed this round. */
  passed: string[];
  /** Seats that went out this hand, in order. */
  finishOrder: string[];
  /** Every card played this hand (public). */
  played: Card[];
  totals: number[];
  target: number;
}

const glyph = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;
const ORDINAL = ['1st', '2nd', '3rd', '4th'];

export class ThirteenEngine extends BaseTableEngine implements TableGameEngine<ThirteenView> {
  readonly slug = 'thirteen';
  readonly target: number;
  private readonly n: number;

  private hands: Card[][] = [];
  private handNumber = 0;
  private turn: number | null = null;
  private table: { seat: number; cards: Card[]; combo: Combo } | null = null;
  private passed: boolean[] = [];
  private mustInclude: string | null = null;
  private finishOrder: number[] = [];
  private played: Card[] = [];
  private totals: number[];
  private nextLeader: number | null = null;
  private roundWinner: number | null = null;
  private pendingState: 'trick' | 'hand' | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length < 2 || seats.length > 4) throw new Error('Thirteen needs 2 to 4 players');
    this.n = seats.length;
    this.target = Number(settings['target'] ?? 10);
    this.totals = Array(this.n).fill(0);
  }

  initializeGame(): void {
    this.startHand();
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    const deck = shuffle(createStandardDeck(), this.rng).slice(0, 13 * this.n);
    this.hands = dealRoundRobin(deck, this.n);
    this.table = null;
    this.passed = Array(this.n).fill(false);
    this.finishOrder = [];
    this.played = [];
    this.summary = null;
    if (this.nextLeader === null) {
      // First hand: whoever holds the lowest card dealt leads it.
      const lowest = [...deck].sort(byPower)[0];
      this.mustInclude = lowest.id;
      this.turn = this.hands.findIndex((h) => h.some((c) => c.id === lowest.id));
    } else {
      this.mustInclude = null;
      this.turn = this.nextLeader;
    }
  }

  private active(seat: number): boolean {
    return this.hands[seat].length > 0;
  }

  protected override validate(playerId: string, action: GameAction): void {
    if (action.type !== 'play') return super.validate(playerId, action);
    const hand = this.hands[this.seatIndex(playerId)];
    const ids = action.cardIds ?? [];
    if (!ids.length || new Set(ids).size !== ids.length || !ids.every((id) => hand.some((c) => c.id === id))) {
      throw new IllegalActionError('Choose cards from your hand');
    }
    const cards = ids.map((id) => hand.find((c) => c.id === id)!);
    const combo = classify(cards);
    if (!combo) throw new IllegalActionError('Those cards don’t make a combination');
    if (this.mustInclude && !ids.includes(this.mustInclude)) {
      throw new IllegalActionError(`The first play must include the ${glyph(hand.find((c) => c.id === this.mustInclude)!)}`);
    }
    if (this.table && !beats(combo, this.table.combo)) {
      throw new IllegalActionError(`That doesn’t beat ${comboLabel(this.table.cards)}`);
    }
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'pass') {
      this.passed[seat] = true;
      this.advanceFrom(seat);
      return;
    }
    const ids = action.cardIds!;
    const cards = ids.map((id) => this.hands[seat].find((c) => c.id === id)!).sort(byPower);
    const combo = classify(cards)!;
    if (this.table && combo.type !== this.table.combo.type) this.announce('danger', `💣 ${this.seats[seat].name} drops a bomb!`);
    this.hands[seat] = this.hands[seat].filter((c) => !ids.includes(c.id));
    this.table = { seat, cards, combo };
    this.played.push(...cards);
    this.mustInclude = null;

    if (!this.active(seat)) {
      this.finishOrder.push(seat);
      this.announce('success', `${this.seats[seat].name} is out — ${ORDINAL[this.finishOrder.length - 1]} place!`);
      const left = [...Array(this.n).keys()].filter((s) => this.active(s));
      if (left.length === 1) {
        this.finishOrder.push(left[0]);
        return this.endHand();
      }
    }
    this.advanceFrom(seat);
  }

  /** Next seat still in the round, or end the round when it comes back to the last player. */
  private advanceFrom(seat: number): void {
    const last = this.table!.seat;
    for (let k = 1; k <= this.n; k++) {
      const s = (seat + k) % this.n;
      if (s === last) return this.endRound();
      if (this.active(s) && !this.passed[s]) {
        this.turn = s;
        return;
      }
    }
    this.endRound();
  }

  private endRound(): void {
    const last = this.table!.seat;
    let leader = last;
    while (!this.active(leader)) leader = (leader + 1) % this.n;
    this.roundWinner = leader;
    this.turn = null;
    this.pendingState = 'trick';
    this.announce('info', this.active(last) ? `${this.seats[last].name} wins the round` : `${this.seats[leader].name} leads`);
  }

  private endHand(): void {
    const gained = Array(this.n).fill(0);
    this.finishOrder.forEach((seat, place) => (gained[seat] = this.n - 1 - place));
    for (let s = 0; s < this.n; s++) this.totals[s] += gained[s];
    this.summary = {
      title: `${this.seats[this.finishOrder[0]].name} wins hand ${this.handNumber}`,
      lines: this.finishOrder.map((s, place) => `${ORDINAL[place]} ${this.seats[s].name}: +${gained[s]} (total ${this.totals[s]})`),
    };
    this.nextLeader = this.finishOrder[0];
    this.turn = null;
    this.pendingState = 'hand';
  }

  pending(): 'trick' | 'hand' | null {
    return this.pendingState;
  }

  resolve(): void {
    if (this.pendingState === 'trick') {
      this.pendingState = null;
      this.table = null;
      this.passed = Array(this.n).fill(false);
      this.turn = this.roundWinner;
      this.roundWinner = null;
      return;
    }
    if (this.pendingState === 'hand') {
      this.pendingState = null;
      if (this.totals.some((t) => t >= this.target)) {
        this.finished = true;
        return;
      }
      this.startHand();
      return;
    }
    throw new IllegalActionError('Nothing to resolve');
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  /** Plays are chosen through `cardSelection`; the only button is Pass. */
  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId || !this.table) return [];
    return [{ type: 'pass', label: 'Pass' }];
  }

  /** True when the player on turn holds nothing that beats the table. */
  private mustPass(seat: number): boolean {
    return !!this.table && enumeratePlays(this.hands[seat], this.table.combo).length === 0;
  }

  cardSelection(playerId: string): CardSelection | null {
    if (this.currentPlayerId() !== playerId || this.mustPass(this.seatIndex(playerId))) return null;
    return {
      count: this.hands[this.seatIndex(playerId)].length,
      minCount: 1,
      label: this.table ? 'Beat it' : 'Lead any combination',
      confirmLabel: 'Play',
      actionType: 'play',
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

  getView(viewerId: string): ThirteenView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const must = this.mustInclude ? this.hands.flat().find((c) => c.id === this.mustInclude) : undefined;
    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (current !== viewerId) phaseLabel = current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Next round…';
    else if (must) phaseLabel = `Lead with the ${glyph(must)} — alone or in a combination`;
    else if (this.table && this.mustPass(me)) phaseLabel = `No cards beat ${comboLabel(this.table.cards)} — you have to pass`;
    else if (this.table) phaseLabel = `Beat ${comboLabel(this.table.cards)} or pass`;
    else phaseLabel = 'Your lead — play any combination';

    const place = (s: number) => this.finishOrder.indexOf(s);
    return structuredClone({
      slug: this.slug,
      viewerId,
      phase: this.table ? 'follow' : 'lead',
      phaseLabel,
      players: this.seats.map((s, i) => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        isBot: s.isBot,
        team: null,
        cardCount: this.hands[i].length,
        stat: place(i) >= 0 ? `Out · ${ORDINAL[place(i)]}` : `${this.totals[i]} pt${this.totals[i] === 1 ? '' : 's'}`,
        badges: [...(this.passed[i] && this.active(i) ? ['Passed'] : []), ...(this.table?.seat === i ? ['On table'] : [])],
      })),
      hand: [...this.hands[me]].sort(byPower),
      currentPlayerId: current,
      trick: [],
      leadSuit: null,
      trickWinnerId: null,
      trump: null,
      // A fresh id per play so each new combination animates in from its player's seat.
      floor: this.table
        ? [{
            id: `h${this.handNumber}-p${this.played.length}`,
            cards: this.table.cards,
            label: `${this.seats[this.table.seat].name} · ${comboLabel(this.table.cards)}`,
            from: this.seats[this.table.seat].id,
          }]
        : [],
      floorHint: must ? `${glyph(must)} leads` : 'New round — any combination',
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
      table: this.table ? { playerId: this.seats[this.table.seat].id, cards: this.table.cards, combo: this.table.combo } : null,
      mustInclude: this.mustInclude,
      passed: this.seats.filter((_, i) => this.passed[i]).map((s) => s.id),
      finishOrder: this.finishOrder.map((s) => this.seats[s].id),
      played: this.played,
      totals: this.totals,
      target: this.target,
    } satisfies ThirteenView);
  }
}
