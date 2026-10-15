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
 * Tarneeb — 4 players in two partnerships (seats 0 & 2 vs 1 & 3), 52 cards, Ace high.
 *
 * - The first dealer is random; the deal passes clockwise every hand. 13 cards each,
 *   dealt one at a time starting with the player after the dealer.
 * - Bidding starts after the dealer and goes clockwise. A bid is 7–13 tricks and must
 *   beat the current high bid. A player may pass, and once passed is out of the auction.
 *   The auction ends when the other three have passed after a bid. If all four pass the
 *   deal moves on one seat and the cards are reshuffled and redealt.
 * - The winning bidder names trumps and leads. Follow suit if able; highest trump wins,
 *   else the highest card of the suit led.
 * - Scoring: bidding team makes the bid → they score the tricks they took (a made bid of
 *   13 scores 16), opponents score 0. Bidding team fails → they lose the bid amount and
 *   the opponents score the tricks they took.
 * - First team to the target wins; if both are at/over the target the higher score wins,
 *   and a tie keeps playing. Safety cap: after MAX_HANDS deals (redeals included) the
 *   higher score wins, or the match is drawn on equal scores.
 */

export type TarneebPhase = 'bid' | 'trump' | 'play';

export interface TarneebView extends TableView {
  phase: TarneebPhase;
  dealerId: string;
  bidderId: string | null;
  /** Current high bid (0 = none yet). */
  bid: number;
  /** Each seat's last bid this hand, or null. */
  seatBids: (number | null)[];
  passed: boolean[];
  tricksWon: [number, number];
  matchPoints: [number, number];
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  target: number;
}

export const MIN_BID = 7;
export const MAX_BID = 13;
export const KABOOT_POINTS = 16;
export const MAX_HANDS = 40;

export class TarneebEngine extends BaseTableEngine implements TableGameEngine<TarneebView> {
  readonly slug = 'tarneeb';
  readonly target: number;

  private hands: Card[][] = [];
  private phase: TarneebPhase = 'bid';
  private dealer = 0;
  private bidder: number | null = null;
  private bid = 0;
  private seatBids: (number | null)[] = [null, null, null, null];
  private passed: boolean[] = [false, false, false, false];
  private turn: number | null = null;
  private trump: Suit | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksWon: [number, number] = [0, 0];
  private points: [number, number] = [0, 0];
  private handNumber = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Tarneeb needs exactly 4 players');
    this.target = Number(settings['target'] ?? 31);
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * 4);
    this.startHand();
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    const deck = shuffle(createStandardDeck(), this.rng);
    this.hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) this.hands[(this.dealer + 1 + i) % 4].push(deck[i]);
    this.phase = 'bid';
    this.bidder = null;
    this.bid = 0;
    this.seatBids = [null, null, null, null];
    this.passed = [false, false, false, false];
    this.trump = null;
    this.trick = [];
    this.played = [];
    this.tricksWon = [0, 0];
    this.turn = (this.dealer + 1) % 4;
    this.summary = null;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    const name = this.seats[seat].name;
    if (action.type === 'bid' || action.type === 'pass') return this.handleBid(seat, action);
    if (action.type === 'trump') {
      this.trump = action.suit!;
      this.phase = 'play';
      this.turn = seat;
      this.announce('info', `${name} names ${SUIT_NAMES[this.trump]} ${SUIT_GLYPH[this.trump]} as trumps`);
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

  private handleBid(seat: number, action: GameAction): void {
    if (action.type === 'bid') {
      this.bid = Number(action.value);
      this.bidder = seat;
      this.seatBids[seat] = this.bid;
    } else {
      this.passed[seat] = true;
    }
    const passes = this.passed.filter((p) => p).length;
    if (this.bidder === null && passes === 4) {
      if (this.handNumber >= MAX_HANDS) {
        this.finished = true;
        this.turn = null;
        return;
      }
      this.dealer = (this.dealer + 1) % 4;
      this.announce('info', `Everyone passed — redeal. ${this.seats[this.dealer].name} deals`);
      this.startHand();
      return;
    }
    if (this.bidder !== null && passes === 3) {
      this.phase = 'trump';
      this.turn = this.bidder;
      this.announce('success', `${this.seats[this.bidder].name} wins the bid with ${this.bid}`);
      return;
    }
    let next = (seat + 1) % 4;
    while (this.passed[next]) next = (next + 1) % 4;
    this.turn = next;
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
    this.tricksWon[winner % 2] += 1;
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;
    if (this.played.length < 52) {
      this.turn = winner;
      return;
    }
    // Hand over: score it.
    const bt = this.bidder! % 2;
    const ot = 1 - bt;
    const took = this.tricksWon[bt];
    const made = took >= this.bid;
    const gain: [number, number] = [0, 0];
    if (made) {
      gain[bt] = this.bid === MAX_BID ? KABOOT_POINTS : took;
    } else {
      gain[bt] = -this.bid;
      gain[ot] = this.tricksWon[ot];
    }
    this.points[0] += gain[0];
    this.points[1] += gain[1];
    const bname = this.teamName(bt);
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    this.summary = {
      title: made ? (this.bid === MAX_BID ? `Kaboot! ${bname} take all 13` : `${bname} make their bid`) : `${bname} are set`,
      lines: [
        `Bid ${this.bid} by ${this.seats[this.bidder!].name} · Trumps ${SUIT_GLYPH[this.trump!]}`,
        `Tricks: ${this.teamName(0)} ${this.tricksWon[0]} – ${this.tricksWon[1]} ${this.teamName(1)}`,
        `${this.teamName(0)} ${sign(gain[0])} · ${this.teamName(1)} ${sign(gain[1])}`,
        `Match: ${this.points[0]} – ${this.points[1]} (first to ${this.target})`,
      ],
    };
    this.announce(made ? 'success' : 'danger', made ? `${bname} make ${this.bid} (${took} tricks)` : `${bname} fail their bid of ${this.bid}`);
    this.turn = null;
    this.pendingState = 'hand';
  }

  private resolveHand(): void {
    this.pendingState = null;
    const [a, b] = this.points;
    if (((a >= this.target || b >= this.target) && a !== b) || this.handNumber >= MAX_HANDS) {
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
    if (this.phase === 'bid') {
      const out: LegalAction[] = [];
      for (let v = Math.max(MIN_BID, this.bid + 1); v <= MAX_BID; v++) out.push({ type: 'bid', value: v, label: `Bid ${v}` });
      out.push({ type: 'pass', label: 'Pass' });
      return out;
    }
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
    const [a, b] = this.points;
    if (a === b) {
      return {
        players: this.seats.map((s, i) => ({ id: s.id, position: 1, result: 'draw', score: this.points[i % 2] })),
        summary: `Draw ${a}–${b}`,
      };
    }
    const winTeam = a > b ? 0 : 1;
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

  private seatStat(i: number): string {
    if (this.phase === 'bid') {
      if (this.passed[i]) return this.seatBids[i] !== null ? `Bid ${this.seatBids[i]} · Passed` : 'Passed';
      return this.seatBids[i] !== null ? `Bid ${this.seatBids[i]}` : '';
    }
    if (this.phase === 'trump') return i === this.bidder ? `Bid ${this.bid}` : '';
    const t = this.tricksWon[i % 2];
    return `${t} team trick${t === 1 ? '' : 's'}`;
  }

  getView(viewerId: string): TarneebView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const waiting = current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';
    const phaseLabel =
      this.finished ? 'Game over'
      : this.phase === 'bid' ?
        current === viewerId ?
          this.bid ? `Bid more than ${this.bid}, or pass` : `Bid ${MIN_BID}–${MAX_BID} tricks, or pass`
        : current ? `${this.seats[this.seatIndex(current)].name} is bidding…` : waiting
      : this.phase === 'trump' ?
        current === viewerId ? `You won the bid at ${this.bid} — name trumps` : `${this.seats[this.bidder!].name} is naming trumps…`
      : current === viewerId ? (this.trick.length ? 'Follow suit if you can' : 'Your lead')
      : waiting;

    const info = [`Hand ${this.handNumber}`];
    if (this.bidder !== null) info.push(`Bid ${this.bid} · ${this.seats[this.bidder].name}`);
    info.push(`First to ${this.target}`);

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
        stat: this.seatStat(i),
        badges: [...(i === this.dealer ? ['Dealer'] : []), ...(i === this.bidder && this.phase !== 'bid' ? ['Bidder'] : [])],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: {
        suit: this.trump,
        hidden: false,
        label: this.trump ? `Trumps ${SUIT_GLYPH[this.trump]}` : this.phase === 'bid' ? 'Trumps: after bidding' : 'Trumps: choosing…',
      },
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Tricks', 'Points'],
        rows: [0, 1].map((t) => ({ label: this.teamName(t), values: [this.tricksWon[t], this.points[t]], highlight: t === me % 2 })),
      },
      info,
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      bidderId: this.bidder === null ? null : this.seats[this.bidder].id,
      bid: this.bid,
      seatBids: this.seatBids,
      passed: this.passed,
      tricksWon: this.tricksWon,
      matchPoints: this.points,
      played: this.played,
      target: this.target,
    } satisfies TarneebView);
  }
}
