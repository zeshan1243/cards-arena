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
  TrickPlay,
} from '../core/table-game';
import { BaseTableEngine, SUIT_GLYPH, playActions, sortForDisplay, trickWinner } from '../core/tricks';

/**
 * Hearts — 4 players, every player for themselves. 52 cards, Ace high, no trumps, 13 cards each.
 *
 * Passing cycle by hand number: left (next seat), right (previous seat), across, hold (no pass).
 * Players choose their 3 cards one at a time in seat order 0..3; the cards are exchanged only
 * once all four have chosen.
 *
 * The holder of the 2♣ leads it to the first trick. Follow suit if able, otherwise any card,
 * except that on the first trick no heart and no Q♠ may be discarded unless the hand holds
 * nothing else. Hearts may not be led until a heart has been played ("broken"), unless the
 * leader holds only hearts.
 *
 * Each heart taken = 1 point, Q♠ = 13. Shooting the moon (all 13 hearts + Q♠): the shooter
 * scores 0 and everyone else +26. After a hand, if anyone has reached the target the game
 * ends; lowest total wins.
 */

export type HeartsPhase = 'pass' | 'play';
export type PassDirection = 'left' | 'right' | 'across' | 'hold';

export const PASS_CYCLE: readonly PassDirection[] = ['left', 'right', 'across', 'hold'];
/** Seat offset to the receiver for each direction (0 = no pass). */
export const PASS_OFFSET: Record<PassDirection, number> = { left: 1, right: 3, across: 2, hold: 0 };
export const QUEEN_ID = 'spades-Q';
export const TWO_CLUBS_ID = 'clubs-2';
export const MOON_POINTS = 26;

export interface HeartsView extends TableView {
  phase: HeartsPhase;
  handNumber: number;
  passDirection: PassDirection;
  heartsBroken: boolean;
  /** Tricks completed this hand (0 = the first trick is in progress). */
  tricksPlayed: number;
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  /** Points taken so far this hand, per seat (before any moon adjustment). */
  handPoints: number[];
  totals: number[];
  target: number;
  /** Cards the viewer received in this hand's pass (null before the exchange / on a hold hand). */
  received: Card[] | null;
}

const glyph = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;
const cardPoints = (c: Card) => (c.suit === 'hearts' ? 1 : c.id === QUEEN_ID ? 13 : 0);

export class HeartsEngine extends BaseTableEngine implements TableGameEngine<HeartsView> {
  readonly slug = 'hearts';
  readonly target: number;

  private hands: Card[][] = [];
  private phase: HeartsPhase = 'pass';
  private handNumber = 0;
  private passes: (Card[] | null)[] = [null, null, null, null];
  private received: (Card[] | null)[] = [null, null, null, null];
  private turn: number | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksPlayed = 0;
  private heartsBroken = false;
  private handPoints = [0, 0, 0, 0];
  private heartsTaken = [0, 0, 0, 0];
  private queenTaker: number | null = null;
  private totals = [0, 0, 0, 0];
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private exchangeBannerId = -1;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Hearts needs exactly 4 players');
    this.target = Number(settings['target'] ?? 50);
  }

  initializeGame(): void {
    this.startHand();
  }

  passDirection(): PassDirection {
    return PASS_CYCLE[(this.handNumber - 1) % 4];
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    this.hands = dealRoundRobin(shuffle(createStandardDeck(), this.rng), 4);
    this.passes = [null, null, null, null];
    this.received = [null, null, null, null];
    this.trick = [];
    this.played = [];
    this.tricksPlayed = 0;
    this.heartsBroken = false;
    this.handPoints = [0, 0, 0, 0];
    this.heartsTaken = [0, 0, 0, 0];
    this.queenTaker = null;
    this.summary = null;
    if (this.passDirection() === 'hold') {
      this.announce('info', 'Hold hand — no passing');
      this.startPlay();
    } else {
      this.phase = 'pass';
      this.turn = 0;
    }
  }

  private startPlay(): void {
    this.phase = 'play';
    this.turn = this.hands.findIndex((h) => h.some((c) => c.id === TWO_CLUBS_ID));
  }

  protected override validate(playerId: string, action: GameAction): void {
    if (this.phase === 'pass' && action.type === 'pass-cards') {
      const ids = action.cardIds ?? [];
      const hand = this.hands[this.seatIndex(playerId)];
      if (ids.length !== 3 || new Set(ids).size !== 3 || !ids.every((id) => hand.some((c) => c.id === id))) {
        throw new IllegalActionError('Choose exactly 3 cards from your hand to pass');
      }
      return;
    }
    super.validate(playerId, action);
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'pass-cards') {
      const ids = action.cardIds!;
      this.passes[seat] = ids.map((id) => this.hands[seat].find((c) => c.id === id)!);
      this.hands[seat] = this.hands[seat].filter((c) => !ids.includes(c.id));
      if (seat < 3) {
        this.turn = seat + 1;
        return;
      }
      const offset = PASS_OFFSET[this.passDirection()];
      for (let s = 0; s < 4; s++) {
        const to = (s + offset) % 4;
        this.hands[to].push(...this.passes[s]!);
        this.received[to] = this.passes[s];
      }
      this.announce('info', `Cards passed ${this.passDirection()}`);
      this.exchangeBannerId = this.bannerSeq;
      this.startPlay();
      return;
    }
    const card = this.hands[seat].find((c) => c.id === action.cardId)!;
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    this.trick.push({ playerId, card });
    if (card.suit === 'hearts' && !this.heartsBroken) {
      this.heartsBroken = true;
      this.announce('danger', 'Hearts broken!');
    }
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = trickWinner(this.trick, null).playerId;
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
    for (const p of this.trick) {
      this.handPoints[winner] += cardPoints(p.card);
      if (p.card.suit === 'hearts') this.heartsTaken[winner] += 1;
      if (p.card.id === QUEEN_ID) {
        this.queenTaker = winner;
        this.announce('danger', `${this.seats[winner].name} took the Queen of Spades`);
      }
    }
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;
    this.tricksPlayed += 1;
    if (this.tricksPlayed < 13) {
      this.turn = winner;
      return;
    }
    this.endHand();
  }

  private endHand(): void {
    let shooter: number | null = null;
    for (let s = 0; s < 4; s++) if (this.heartsTaken[s] === 13 && this.queenTaker === s) shooter = s;
    const gained = shooter === null ? [...this.handPoints] : [0, 1, 2, 3].map((s) => (s === shooter ? 0 : MOON_POINTS));
    for (let s = 0; s < 4; s++) this.totals[s] += gained[s];
    const lines = this.seats.map((p, s) => `${p.name}: +${gained[s]} (total ${this.totals[s]})`);
    if (shooter === null && this.queenTaker !== null) lines.push(`Q♠ taken by ${this.seats[this.queenTaker].name}`);
    this.summary = {
      title: shooter !== null ? `${this.seats[shooter].name} shot the moon!` : `Hand ${this.handNumber} complete`,
      lines,
    };
    if (shooter !== null) this.announce('success', 'Shot the moon!');
    this.turn = null;
    this.pendingState = 'hand';
  }

  private resolveHand(): void {
    this.pendingState = null;
    if (this.totals.some((t) => t >= this.target)) {
      this.finished = true;
      this.turn = null;
      return;
    }
    this.startHand();
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId || this.phase !== 'play') return [];
    return playActions(this.validCards(this.seatIndex(playerId)));
  }

  private validCards(seat: number): Card[] {
    const hand = this.hands[seat];
    const firstTrick = this.tricksPlayed === 0;
    if (this.trick.length === 0) {
      if (firstTrick) return hand.filter((c) => c.id === TWO_CLUBS_ID);
      if (!this.heartsBroken) {
        const nonHearts = hand.filter((c) => c.suit !== 'hearts');
        if (nonHearts.length) return nonHearts;
      }
      return [...hand];
    }
    const lead = this.trick[0].card.suit;
    const same = hand.filter((c) => c.suit === lead);
    if (same.length) return same;
    if (firstTrick) {
      const clean = hand.filter((c) => cardPoints(c) === 0);
      if (clean.length) return clean;
    }
    return [...hand];
  }

  cardSelection(playerId: string): CardSelection | null {
    if (this.phase !== 'pass' || this.currentPlayerId() !== playerId) return null;
    const to = (this.seatIndex(playerId) + PASS_OFFSET[this.passDirection()]) % 4;
    return { count: 3, label: `Pass 3 cards ${this.passDirection()}`, actionType: 'pass-cards', targetId: this.seats[to].id };
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    const positions = this.totals.map((t) => 1 + this.totals.filter((o) => o < t).length);
    const worst = Math.max(...positions);
    const firsts = positions.filter((p) => p === 1).length;
    const result = (p: number): SeatResult => (p === 1 ? (firsts > 1 ? 'draw' : 'win') : p === worst ? 'loss' : 'safe');
    const leaders = this.seats.filter((_, i) => positions[i] === 1).map((s) => s.name);
    const best = Math.min(...this.totals);
    const summary =
      leaders.length === 1
        ? `${leaders[0]} wins with ${best} points`
        : `${leaders.slice(0, -1).join(', ')} and ${leaders[leaders.length - 1]} tie with ${best} points`;
    return {
      players: this.seats.map((s, i) => ({ id: s.id, position: positions[i], result: result(positions[i]), score: this.totals[i] })),
      summary,
    };
  }

  getView(viewerId: string): HeartsView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const dir = this.passDirection();
    const waiting = current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';
    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (this.phase === 'pass') phaseLabel = current === viewerId ? `Choose 3 cards to pass ${dir}` : current ? `Waiting for ${this.seats[this.seatIndex(current)].name} to pass…` : 'Passing…';
    else if (this.tricksPlayed === 0 && this.trick.length === 0) phaseLabel = current === viewerId ? '2♣ leads — play it' : '2♣ leads';
    else if (current !== viewerId) phaseLabel = waiting;
    else if (this.trick.length) phaseLabel = 'Follow suit if you can';
    else phaseLabel = this.heartsBroken ? 'Your lead' : 'Your lead · Hearts not broken yet';

    let banner = this.banner;
    if (banner && banner.id === this.exchangeBannerId && this.received[me]) {
      banner = { ...banner, text: `You received ${this.received[me]!.map(glyph).join(' ')}` };
    }

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
        stat: `${this.handPoints[i]} pt${this.handPoints[i] === 1 ? '' : 's'} this hand`,
        badges: [
          ...(this.phase === 'pass' && this.passes[i] ? ['Passed'] : []),
          ...(this.queenTaker === i ? ['Q♠'] : []),
        ],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: null,
      floor: null,
      scores: {
        title: 'Scores',
        columns: ['This hand', 'Total'],
        rows: this.seats.map((s, i) => ({ label: s.name, values: [this.handPoints[i], this.totals[i]], highlight: i === me })),
      },
      info: [
        `Hand ${this.handNumber}`,
        dir === 'hold' ? 'No pass' : `Pass ${dir}`,
        `To ${this.target}`,
        ...(this.heartsBroken ? ['Hearts broken'] : []),
      ],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner,
      handNumber: this.handNumber,
      passDirection: dir,
      heartsBroken: this.heartsBroken,
      tricksPlayed: this.tricksPlayed,
      played: this.played,
      handPoints: this.handPoints,
      totals: this.totals,
      target: this.target,
      received: this.received[me],
    } satisfies HeartsView);
  }
}
