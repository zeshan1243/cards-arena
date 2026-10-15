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
 * Hokm — 4 players in two partnerships (seats 0 & 2 vs 1 & 3), 52 cards, Ace high.
 *
 * The first Hakem is drawn at random. Each hand: shuffle, deal five cards to each
 * player starting with the Hakem, the Hakem names trumps, then the remaining 32
 * cards are dealt (13 each). The Hakem leads the first trick. Follow suit if able;
 * highest trump wins, else highest of the led suit; the winner leads next.
 * The hand ends as soon as a team has 7 tricks: +1 point, Kot (7–0) = 2 points,
 * Kot against the Hakem's team = 3 points. The Hakem keeps the role if their team
 * won the hand, otherwise it passes to the next seat. First team to the target wins.
 */

export type HokmPhase = 'trump' | 'play';

export interface HokmView extends TableView {
  phase: HokmPhase;
  hakemId: string;
  tricksWon: [number, number];
  matchPoints: [number, number];
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  target: number;
}

export const TRICKS_TO_WIN = 7;
export const KOT_POINTS = 2;
export const HAKEM_KOT_POINTS = 3;

/** Points for winning a hand. `loserTricks` is the losing team's trick count. */
export function handPoints(winTeam: number, loserTricks: number, hakemTeam: number): number {
  if (loserTricks > 0) return 1;
  return winTeam === hakemTeam ? KOT_POINTS : HAKEM_KOT_POINTS;
}

/** Hakem for the next hand: stays if their team won, otherwise passes to the next seat. */
export function nextHakem(hakem: number, winTeam: number): number {
  return hakem % 2 === winTeam ? hakem : (hakem + 1) % 4;
}

export class HokmEngine extends BaseTableEngine implements TableGameEngine<HokmView> {
  readonly slug = 'hokm';
  readonly target: number;

  private hands: Card[][] = [];
  private undealt: Card[] = [];
  private phase: HokmPhase = 'trump';
  private hakem = 0;
  private turn: number | null = null;
  private trump: Suit | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksWon: [number, number] = [0, 0];
  private points: [number, number] = [0, 0];
  private handNumber = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private lastHandWinner = 0;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Hokm needs exactly 4 players');
    this.target = Number(settings['target'] ?? 5);
  }

  initializeGame(): void {
    this.hakem = Math.floor(this.rng() * 4);
    this.startHand();
    this.announce('info', `${this.seats[this.hakem].name} is the Hakem`);
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = [[], [], [], []];
    // First five cards each, starting with the Hakem.
    for (let i = 0; i < 20; i++) this.hands[(this.hakem + i) % 4].push(deck[i]);
    this.undealt = deck.slice(20);
    this.phase = 'trump';
    this.trump = null;
    this.trick = [];
    this.played = [];
    this.tricksWon = [0, 0];
    this.turn = this.hakem;
    this.summary = null;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'trump') {
      this.trump = action.suit!;
      this.undealt.forEach((c, i) => this.hands[(this.hakem + i) % 4].push(c));
      this.undealt = [];
      this.phase = 'play';
      this.turn = this.hakem;
      this.announce('info', `${this.seats[seat].name} calls ${SUIT_NAMES[this.trump]} ${SUIT_GLYPH[this.trump]} as Hokm`);
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
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;

    if (this.tricksWon[team] >= TRICKS_TO_WIN) {
      const hakemTeam = this.hakem % 2;
      const loserTricks = this.tricksWon[1 - team];
      const gained = handPoints(team, loserTricks, hakemTeam);
      this.points[team] += gained;
      this.lastHandWinner = team;
      const names = this.teamName(team);
      const kot = loserTricks === 0;
      const hakemKot = kot && team !== hakemTeam;
      this.summary = {
        title: hakemKot ? `Hakem Kot! ${names} sweep the Hakem's team` : kot ? `Kot! ${names} win 7–0` : `${names} win the hand`,
        lines: [
          `Tricks: ${this.teamName(0)} ${this.tricksWon[0]} – ${this.tricksWon[1]} ${this.teamName(1)}`,
          `+${gained} point${gained > 1 ? 's' : ''} to ${names}`,
          `Match: ${this.points[0]} – ${this.points[1]} (first to ${this.target})`,
          team === hakemTeam
            ? `${this.seats[this.hakem].name} stays Hakem`
            : `Hakem passes to ${this.seats[nextHakem(this.hakem, team)].name}`,
        ],
      };
      this.announce(kot ? 'success' : 'info', hakemKot ? 'Hakem Kot! +3' : kot ? 'Kot! +2' : `${names} take the hand`);
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
      const w = this.points[0] >= this.points[1] ? 0 : 1;
      this.announce('success', `${this.teamName(w)} win the match!`);
      return;
    }
    const prev = this.hakem;
    this.hakem = nextHakem(this.hakem, this.lastHandWinner);
    this.startHand();
    if (prev !== this.hakem) this.announce('info', `${this.seats[this.hakem].name} is the new Hakem`);
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

  getView(viewerId: string): HokmView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const hakemName = this.seats[this.hakem].name;
    const phaseLabel =
      this.finished ? 'Game over'
      : this.pendingState === 'hand' ? 'Hand over'
      : this.pendingState === 'trick' ? `${this.seats[this.seatIndex(this.lastWinner!)].name} wins the trick`
      : this.phase === 'trump' ? (current === viewerId ? 'You are Hakem: choose trumps from your first five cards' : `${hakemName} (Hakem) is choosing trumps…`)
      : current === viewerId ? (this.trick.length ? 'Your turn: follow suit if you can' : 'Your lead')
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
        stat: `${this.tricksWon[i % 2]} team trick${this.tricksWon[i % 2] === 1 ? '' : 's'}`,
        badges: [...(i === this.hakem ? ['Hakem'] : []), ...(i === (me + 2) % 4 ? ['Partner'] : [])],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: {
        suit: this.trump,
        hidden: false,
        label: this.trump ? `Hokm ${SUIT_GLYPH[this.trump]} ${SUIT_NAMES[this.trump]}` : 'Hokm: Hakem choosing…',
      },
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Tricks', 'Points'],
        rows: [0, 1].map((t) => ({ label: this.teamName(t), values: [this.tricksWon[t], this.points[t]], highlight: t === me % 2 })),
      },
      info: [`Hand ${this.handNumber}`, `First to ${this.target}`, `Hakem: ${hakemName}`],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      hakemId: this.seats[this.hakem].id,
      tricksWon: this.tricksWon,
      matchPoints: this.points,
      played: this.played,
      target: this.target,
    } satisfies HokmView);
  }
}
