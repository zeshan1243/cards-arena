import { Card, RANKS, Suit } from '../../shared/models/card.model';
import { createStandardDeck, shuffle } from '../core/deck';
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
  TrickPlay,
} from '../core/table-game';
import { BaseTableEngine, SUIT_GLYPH, findCard, playActions, sortForDisplay, trickWinner } from '../core/tricks';

/**
 * Call Break — 4 players, every player for themselves. 52 cards, Ace high, spades always trump.
 *
 * Each round: dealer (random first, then clockwise) deals 13 each. Starting with the player
 * after the dealer, everyone calls 1–8 tricks. The player after the dealer leads the first trick.
 *
 * Play rules:
 *  - Follow the led suit if you can. If no spade has been played to the trick (or spades were
 *    led), you must beat the highest card of the led suit if you can.
 *  - Void in the led suit: you must play a spade if you have one, and must beat the highest
 *    spade already on the trick if you can (otherwise any spade). No spade → play anything.
 *  - Highest spade wins, else highest card of the led suit. The winner leads next.
 *
 * Scoring in tenths of a point (integers): made the call → +call×10 + overtricks×1;
 * missed → −call×10. After the last round (3 or 5), highest total wins.
 */

export type CallBreakPhase = 'bid' | 'play';

export interface CallBreakView extends TableView {
  phase: CallBreakPhase;
  dealerId: string;
  /** Per seat; null while not yet called. */
  calls: (number | null)[];
  tricksWon: number[];
  /** Running totals in tenths. */
  totals: number[];
  /** roundScores[round][seat] in tenths, for completed rounds. */
  roundScores: number[][];
  /** Every card played in completed tricks this round (public). */
  played: Card[];
  round: number;
  rounds: number;
}

export const TRUMP: Suit = 'spades';
export const MIN_CALL = 1;
export const MAX_CALL = 8;

const rankIdx = (c: Card) => RANKS.indexOf(c.rank);
export const cardName = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;

/** Highest card of `suit` already on the trick, or null. */
function highestOf(trick: readonly TrickPlay[], suit: Suit): Card | null {
  let best: Card | null = null;
  for (const p of trick) if (p.card.suit === suit && (best === null || rankIdx(p.card) > rankIdx(best))) best = p.card;
  return best;
}

/** Cards that may legally be played from `hand` onto `trick` (pure; mirrored in Python). */
export function legalCards(hand: readonly Card[], trick: readonly TrickPlay[]): Card[] {
  if (trick.length === 0) return [...hand];
  const lead = trick[0].card.suit;
  const same = hand.filter((c) => c.suit === lead);
  if (same.length) {
    // Once a spade has trumped a side-suit lead, following suit cannot win: any card of the suit.
    if (lead !== TRUMP && highestOf(trick, TRUMP) !== null) return same;
    const top = highestOf(trick, lead)!;
    const beaters = same.filter((c) => rankIdx(c) > rankIdx(top));
    return beaters.length ? beaters : same;
  }
  const spades = hand.filter((c) => c.suit === TRUMP);
  if (spades.length) {
    const top = highestOf(trick, TRUMP);
    if (top === null) return spades;
    const beaters = spades.filter((c) => rankIdx(c) > rankIdx(top));
    return beaters.length ? beaters : spades;
  }
  return [...hand];
}

/** Round score in tenths. */
export function roundScore(call: number, won: number): number {
  return won >= call ? call * 10 + (won - call) : -call * 10;
}

/** Tenths → "4.1", "-3", "0". */
export function formatTenths(t: number): string {
  const sign = t < 0 ? '-' : '';
  const a = Math.abs(t);
  const whole = Math.floor(a / 10);
  const frac = a % 10;
  return `${sign}${whole}${frac ? `.${frac}` : ''}`;
}

export class CallBreakEngine extends BaseTableEngine implements TableGameEngine<CallBreakView> {
  readonly slug = 'call-break';
  readonly rounds: number;

  private hands: Card[][] = [[], [], [], []];
  private phase: CallBreakPhase = 'bid';
  private dealer = 0;
  private turn: number | null = null;
  private calls: (number | null)[] = [null, null, null, null];
  private won: number[] = [0, 0, 0, 0];
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private roundScores: number[][] = [];
  private totals: number[] = [0, 0, 0, 0];
  private round = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Call Break needs exactly 4 players');
    this.rounds = Number(settings['rounds'] ?? 3) === 5 ? 5 : 3;
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * 4);
    this.startRound();
  }

  // ------------------------------------------------------------------ flow

  private startRound(): void {
    this.round += 1;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = [[], [], [], []];
    // Deal one at a time, starting with the player after the dealer.
    for (let i = 0; i < 52; i++) this.hands[(this.dealer + 1 + i) % 4].push(deck[i]);
    this.phase = 'bid';
    this.calls = [null, null, null, null];
    this.won = [0, 0, 0, 0];
    this.trick = [];
    this.played = [];
    this.summary = null;
    this.turn = (this.dealer + 1) % 4;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'bid') {
      const value = Number(action.value);
      this.calls[seat] = value;
      this.announce('info', `${this.seats[seat].name} calls ${value}`);
      if (this.calls.every((c) => c !== null)) {
        this.phase = 'play';
        this.turn = (this.dealer + 1) % 4;
      } else {
        this.turn = (seat + 1) % 4;
      }
      return;
    }
    const card = findCard(this.hands[seat], action.cardId!);
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    this.trick.push({ playerId, card });
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = trickWinner(this.trick, TRUMP).playerId;
      this.pendingState = 'trick';
    } else {
      this.turn = (seat + 1) % 4;
    }
  }

  pending(): 'trick' | 'hand' | null {
    return this.pendingState;
  }

  resolve(): void {
    if (this.pendingState === 'trick') return this.resolveTrick();
    if (this.pendingState === 'hand') return this.resolveHand();
    throw new IllegalActionError('Nothing to resolve');
  }

  private resolveTrick(): void {
    const winner = this.seatIndex(this.lastWinner!);
    this.won[winner] += 1;
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;

    if (this.hands.every((h) => h.length === 0)) {
      const scores = [0, 1, 2, 3].map((i) => roundScore(this.calls[i]!, this.won[i]));
      this.roundScores.push(scores);
      for (let i = 0; i < 4; i++) this.totals[i] += scores[i];
      const last = this.round === this.rounds;
      this.summary = {
        title: last ? `Final round (${this.round} of ${this.rounds})` : `Round ${this.round} of ${this.rounds}`,
        lines: [
          ...this.seats.map((s, i) => {
            const made = this.won[i] >= this.calls[i]!;
            const sc = scores[i];
            return `${s.name}: called ${this.calls[i]}, won ${this.won[i]} — ${made ? 'made it' : 'missed'} (${sc > 0 ? '+' : ''}${formatTenths(sc)})`;
          }),
          `Totals: ${this.seats.map((s, i) => `${s.name} ${formatTenths(this.totals[i])}`).join(' · ')}`,
        ],
      };
      if (last) {
        const out = this.outcome();
        this.announce('success', out.summary);
      } else {
        this.announce('info', `Round ${this.round} complete`);
      }
      this.turn = null;
      this.pendingState = 'hand';
      return;
    }
    this.turn = winner;
  }

  private resolveHand(): void {
    this.pendingState = null;
    if (this.round >= this.rounds) {
      this.finished = true;
      this.turn = null;
      return;
    }
    this.dealer = (this.dealer + 1) % 4;
    this.startRound();
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    if (this.phase === 'bid') {
      const out: LegalAction[] = [];
      for (let v = MIN_CALL; v <= MAX_CALL; v++) out.push({ type: 'bid', value: v, label: `Call ${v}` });
      return out;
    }
    return playActions(legalCards(this.hands[seat], this.trick));
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
    const topCount = positions.filter((p) => p === 1).length;
    const players = this.seats.map((s, i) => {
      const position = positions[i];
      const result: SeatResult =
        position === 1 ? (topCount > 1 ? 'draw' : 'win') : position === worst ? 'loss' : 'safe';
      return { id: s.id, position, result, score: this.totals[i] };
    });
    const leaders = this.seats.filter((_, i) => positions[i] === 1).map((s) => s.name);
    const best = formatTenths(Math.max(...this.totals));
    const summary = leaders.length === 1 ? `${leaders[0]} wins with ${best}` : `${leaders.join(' & ')} tie for first with ${best}`;
    return { players, summary };
  }

  private playPrompt(seat: number): string {
    if (this.trick.length === 0) return 'Your lead — spades are trump';
    const lead = this.trick[0].card.suit;
    const hand = this.hands[seat];
    const spadeOnTrick = highestOf(this.trick, TRUMP);
    if (hand.some((c) => c.suit === lead)) {
      if (lead !== TRUMP && spadeOnTrick) return `Follow ${SUIT_GLYPH[lead]} — already trumped`;
      return `Must beat the ${cardName(highestOf(this.trick, lead)!)} if you can`;
    }
    if (hand.some((c) => c.suit === TRUMP)) {
      return spadeOnTrick ? `Must beat the ${cardName(spadeOnTrick)} if you can` : `Out of ${SUIT_GLYPH[lead]} — you must play a spade`;
    }
    return `Out of ${SUIT_GLYPH[lead]} and spades — play any card`;
  }

  getView(viewerId: string): CallBreakView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const waiting = current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';
    const phaseLabel =
      this.finished ? 'Game over'
      : this.pendingState === 'hand' ? `Round ${this.round} complete`
      : this.phase === 'bid' ? (current === viewerId ? 'Call how many tricks you will win' : current ? `${this.seats[this.turn!].name} is calling…` : waiting)
      : current === viewerId ? this.playPrompt(me)
      : waiting;

    const roundCols = Array.from({ length: this.rounds }, (_, r) => `R${r + 1}`);
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
        stat:
          this.calls[i] === null ? (this.turn === i && this.phase === 'bid' ? 'Calling…' : 'No call yet')
          : this.phase === 'bid' ? `Call ${this.calls[i]}`
          : `Call ${this.calls[i]} · Won ${this.won[i]}`,
        badges: i === this.dealer ? ['Dealer'] : [],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: { suit: TRUMP, hidden: false, label: 'Trumps ♠' },
      floor: null,
      scores: {
        title: 'Scores',
        columns: [...roundCols, 'Total'],
        rows: this.seats.map((s, i) => ({
          label: s.name,
          values: [...roundCols.map((_, r) => (r < this.roundScores.length ? formatTenths(this.roundScores[r][i]) : '–')), formatTenths(this.totals[i])],
          highlight: i === me,
        })),
      },
      info: [`Round ${this.round} of ${this.rounds}`, 'Spades are trump'],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      calls: this.calls,
      tricksWon: this.won,
      totals: this.totals,
      roundScores: this.roundScores,
      played: this.played,
      round: this.round,
      rounds: this.rounds,
    } satisfies CallBreakView);
  }
}
