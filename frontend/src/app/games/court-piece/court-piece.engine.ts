import { Card, SUITS, Suit } from '../../shared/models/card.model';
import { createStandardDeck, shuffle } from '../core/deck';
import {
  CardSelection,
  GameAction,
  GameOutcome,
  GameSettings,
  IllegalActionError,
  LegalAction,
  SeatConfig,
  TableGameEngine,
  TableView,
  TrickPlay,
} from '../core/table-game';
import { BaseTableEngine, SUIT_GLYPH, SUIT_NAMES, findCard, followSuit, playActions, sortForDisplay, trickWinner } from '../core/tricks';

/**
 * Court Piece (Rang) — 4 players in two partnerships (seats 0 & 2 vs 1 & 3).
 *
 * Each hand: the player after the dealer is the trump caller. They see five cards,
 * name trumps, then the rest of the deck is dealt (13 each). The caller leads.
 * Standard trick-taking: follow suit if able, highest trump wins, else highest of led suit.
 * The first team to 7 tricks wins the hand: 1 point, or 3 points for a Court
 * (winning the first seven tricks in a row). First team to the target wins.
 */

export type CourtPiecePhase = 'trump' | 'play';

export interface CourtPieceView extends TableView {
  phase: CourtPiecePhase;
  dealerId: string;
  callerId: string;
  tricksWon: [number, number];
  matchPoints: [number, number];
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  target: number;
}

export const TRICKS_TO_WIN = 7;
export const COURT_POINTS = 3;

export class CourtPieceEngine extends BaseTableEngine implements TableGameEngine<CourtPieceView> {
  readonly slug = 'court-piece';
  readonly target: number;

  private hands: Card[][] = [];
  private undealt: Card[] = [];
  private phase: CourtPiecePhase = 'trump';
  private dealer = 0;
  private caller = 0;
  private turn: number | null = null;
  private trump: Suit | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksWon: [number, number] = [0, 0];
  /** Team that won each trick this hand, in order (for Court detection). */
  private trickHistory: number[] = [];
  private points: [number, number] = [0, 0];
  private handNumber = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Court Piece needs exactly 4 players');
    this.target = Number(settings['target'] ?? 5);
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * 4);
    this.startHand();
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    this.caller = (this.dealer + 1) % 4;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = [[], [], [], []];
    // First five cards each, starting with the trump caller.
    for (let i = 0; i < 20; i++) this.hands[(this.caller + i) % 4].push(deck[i]);
    this.undealt = deck.slice(20);
    this.phase = 'trump';
    this.trump = null;
    this.trick = [];
    this.played = [];
    this.tricksWon = [0, 0];
    this.trickHistory = [];
    this.turn = this.caller;
    this.summary = null;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'trump') {
      this.trump = action.suit!;
      this.undealt.forEach((c, i) => this.hands[(this.caller + i) % 4].push(c));
      this.undealt = [];
      this.phase = 'play';
      this.turn = this.caller;
      this.announce('info', `${this.seats[seat].name} calls ${SUIT_NAMES[this.trump]} ${SUIT_GLYPH[this.trump]} as trumps`);
      return;
    }
    const card = findCard(this.hands[seat], action.cardId!);
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    this.trick.push({ playerId, card });
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = trickWinner(this.trick, this.trump).playerId;
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
    const team = winner % 2;
    this.tricksWon[team] += 1;
    this.trickHistory.push(team);
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;

    if (this.tricksWon[team] >= TRICKS_TO_WIN) {
      const court = this.trickHistory.length === TRICKS_TO_WIN && this.trickHistory.every((t) => t === team);
      const gained = court ? COURT_POINTS : 1;
      this.points[team] += gained;
      const names = this.teamName(team);
      this.summary = {
        title: court ? `Court! ${names} win seven straight` : `${names} win the hand`,
        lines: [
          `Tricks: ${this.teamName(0)} ${this.tricksWon[0]} – ${this.tricksWon[1]} ${this.teamName(1)}`,
          `+${gained} point${gained > 1 ? 's' : ''} to ${names}`,
          `Match: ${this.points[0]} – ${this.points[1]} (first to ${this.target})`,
        ],
      };
      this.announce('success', court ? 'COURT!' : `${names} take the hand`);
      this.turn = null;
      this.pendingState = 'hand';
      return;
    }
    this.turn = winner;
  }

  private resolveHand(): void {
    this.pendingState = null;
    if (this.points[0] >= this.target || this.points[1] >= this.target) {
      this.finished = true;
      this.turn = null;
      return;
    }
    this.dealer = (this.dealer + 1) % 4;
    this.startHand();
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    if (this.phase === 'trump') {
      return SUITS.map((suit) => ({ type: 'trump', suit, label: `${SUIT_GLYPH[suit]} ${SUIT_NAMES[suit]}` }));
    }
    return playActions(followSuit(this.hands[seat], this.trick[0]?.card.suit ?? null));
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    const winTeam = this.points[0] >= this.points[1] ? 0 : 1;
    return {
      players: this.seats.map((s, i) => ({
        id: s.id,
        position: i % 2 === winTeam ? 1 : 2,
        result: i % 2 === winTeam ? 'win' : 'loss',
        score: this.points[i % 2],
      })),
      summary: `${this.teamName(winTeam)} win ${this.points[winTeam]}–${this.points[1 - winTeam]}`,
    };
  }

  teamName(team: number): string {
    return `${this.seats[team].name} & ${this.seats[team + 2].name}`;
  }

  getView(viewerId: string): CourtPieceView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const phaseLabel =
      this.finished ? 'Game over'
      : this.phase === 'trump' ? (current === viewerId ? 'Choose trumps from your first five cards' : `${this.seats[this.caller].name} is choosing trumps…`)
      : current === viewerId ? (this.trick.length ? 'Follow suit if you can' : 'Your lead')
      : current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';

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
        team: i % 2,
        cardCount: this.hands[i].length,
        stat: `${this.tricksWon[i % 2]} team tricks`,
        badges: [...(i === this.dealer ? ['Dealer'] : []), ...(i === this.caller ? ['Trump caller'] : [])],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: { suit: this.trump, hidden: false, label: this.trump ? `Trumps ${SUIT_GLYPH[this.trump]}` : 'Trumps: choosing…' },
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Tricks', 'Points'],
        rows: [0, 1].map((t) => ({ label: this.teamName(t), values: [this.tricksWon[t], this.points[t]], highlight: t === me % 2 })),
      },
      info: [`Hand ${this.handNumber}`, `First to ${this.target}`],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      callerId: this.seats[this.caller].id,
      tricksWon: this.tricksWon,
      matchPoints: this.points,
      played: this.played,
      target: this.target,
    } satisfies CourtPieceView);
  }
}
