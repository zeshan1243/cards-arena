import { Card, SUITS, Suit } from '../../shared/models/card.model';
import { shuffle } from '../core/deck';
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
import {
  BaseTableEngine,
  RankOrder,
  SUIT_GLYPH,
  SUIT_NAMES,
  createShortDeck,
  findCard,
  playActions,
  sortForDisplay,
  trickWinner,
} from '../core/tricks';

/**
 * 29 (Twenty-Nine) — 4 players in two partnerships (seats 0 & 2 vs 1 & 3), 32-card deck.
 *
 * Rank in every suit, high → low: J 9 A 10 K Q 8 7. Points: J 3, 9 2, A 1, 10 1 (28 total).
 * Each hand: 4 cards each, auction 16–28 starting after the dealer (passers drop out; if the
 * first three pass the dealer must bid). The winner picks a secret trump, then 4 more cards
 * each. Trump has no effect until a player who cannot follow suit reveals it; the revealer
 * must then play a trump if they hold one. Optional pair (K+Q of trump) moves the target by 4.
 * Bidding team scores +1 game point if they reach the target in card points, else −1.
 * First team to +target game points wins the match; a team at −target loses.
 */

export type TwentyNinePhase = 'bid' | 'trump' | 'play';

/** Low → high, for `trickWinner` / `sortForDisplay`. */
export const TWENTY_NINE_ORDER: RankOrder = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];

export const CARD_POINTS: Partial<Record<Card['rank'], number>> = { J: 3, '9': 2, A: 1, '10': 1 };
export const cardPoints = (c: Card): number => CARD_POINTS[c.rank] ?? 0;

export const MIN_BID = 16;
export const MAX_BID = 28;
export const PAIR_SHIFT = 4;

export interface TwentyNineView extends TableView {
  phase: TwentyNinePhase;
  dealerId: string;
  bidderId: string | null;
  /** Highest bid so far (or the winning bid once bidding is over). */
  highBid: number | null;
  /** Per seat: last bid, 'pass', or null if they have not spoken. Public. */
  bids: (number | 'pass' | null)[];
  /** Target in card points after any pair adjustment. */
  target: number | null;
  trumpRevealed: boolean;
  revealedById: string | null;
  /** Team (0/1) that declared the pair this hand, or null. */
  pairTeam: number | null;
  pairRule: boolean;
  cardPoints: [number, number];
  gamePoints: [number, number];
  matchTarget: number;
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
}

export class TwentyNineEngine extends BaseTableEngine implements TableGameEngine<TwentyNineView> {
  readonly slug = '29';
  readonly matchTarget: number;
  readonly pairRule: boolean;

  private hands: Card[][] = [];
  private undealt: Card[] = [];
  private phase: TwentyNinePhase = 'bid';
  private dealer = 0;
  private turn: number | null = null;
  private bids: (number | 'pass' | null)[] = [null, null, null, null];
  private highBid: number | null = null;
  private highBidder: number | null = null;
  private bidder: number | null = null;
  private target: number | null = null;
  private trump: Suit | null = null;
  private trumpRevealed = false;
  private revealedBy: number | null = null;
  /** Seat that just revealed trump and must now play a trump if able. */
  private mustTrump: number | null = null;
  private pairTeam: number | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksPlayed = 0;
  private cardPts: [number, number] = [0, 0];
  private gamePts: [number, number] = [0, 0];
  private handNumber = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('29 needs exactly 4 players');
    this.matchTarget = Number(settings['target'] ?? 3);
    this.pairRule = String(settings['pair'] ?? 'on') === 'on';
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * 4);
    this.startHand();
  }

  // ------------------------------------------------------------------ flow

  private startHand(): void {
    this.handNumber += 1;
    const deck = shuffle(createShortDeck(), this.rng);
    const first = (this.dealer + 1) % 4;
    this.hands = [[], [], [], []];
    for (let i = 0; i < 16; i++) this.hands[(first + i) % 4].push(deck[i]);
    this.undealt = deck.slice(16);
    this.phase = 'bid';
    this.bids = [null, null, null, null];
    this.highBid = null;
    this.highBidder = null;
    this.bidder = null;
    this.target = null;
    this.trump = null;
    this.trumpRevealed = false;
    this.revealedBy = null;
    this.mustTrump = null;
    this.pairTeam = null;
    this.trick = [];
    this.played = [];
    this.tricksPlayed = 0;
    this.cardPts = [0, 0];
    this.summary = null;
    this.turn = first;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    const name = this.seats[seat].name;

    if (action.type === 'bid' || action.type === 'pass') {
      if (action.type === 'bid') {
        const value = Number(action.value);
        this.bids[seat] = value;
        this.highBid = value;
        this.highBidder = seat;
      } else {
        this.bids[seat] = 'pass';
      }
      const active = [0, 1, 2, 3].filter((i) => this.bids[i] !== 'pass');
      if (this.highBid === MAX_BID || (active.length === 1 && this.highBid !== null)) {
        this.bidder = this.highBidder;
        this.target = this.highBid;
        this.phase = 'trump';
        this.turn = this.bidder;
        this.announce('info', `${this.seats[this.bidder!].name} wins the bid at ${this.highBid}`);
        return;
      }
      let next = (seat + 1) % 4;
      while (this.bids[next] === 'pass') next = (next + 1) % 4;
      this.turn = next;
      return;
    }

    if (action.type === 'trump') {
      this.trump = action.suit!;
      const first = (this.dealer + 1) % 4;
      this.undealt.forEach((c, i) => this.hands[(first + i) % 4].push(c));
      this.undealt = [];
      this.phase = 'play';
      this.turn = first;
      this.announce('info', `${name} has chosen a secret trump`);
      return;
    }

    if (action.type === 'reveal-trump') {
      this.trumpRevealed = true;
      this.revealedBy = seat;
      this.mustTrump = seat;
      this.announce('info', `${name} reveals — Trump is ${SUIT_GLYPH[this.trump!]}!`);
      return;
    }

    const card = findCard(this.hands[seat], action.cardId!);
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    this.trick.push({ playerId, card });
    this.mustTrump = null;
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = trickWinner(this.trick, this.effectiveTrump(), TWENTY_NINE_ORDER).playerId;
      this.pendingState = 'trick';
    } else {
      this.turn = (seat + 1) % 4;
    }
  }

  private effectiveTrump(): Suit | null {
    return this.trumpRevealed ? this.trump : null;
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
    this.cardPts[team] += this.trick.reduce((n, p) => n + cardPoints(p.card), 0);
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;
    this.tricksPlayed += 1;

    if (this.pairRule && this.trumpRevealed && this.pairTeam === null) {
      for (const s of [team, team + 2]) {
        const hand = this.hands[s];
        if (hand.some((c) => c.suit === this.trump && c.rank === 'K') && hand.some((c) => c.suit === this.trump && c.rank === 'Q')) {
          this.pairTeam = team;
          const bidTeam = this.bidder! % 2;
          this.target = team === bidTeam ? Math.max(MIN_BID, this.target! - PAIR_SHIFT) : Math.min(MAX_BID, this.target! + PAIR_SHIFT);
          this.announce('info', `Pair! ${this.seats[s].name} holds K & Q of trump — target now ${this.target}`);
          break;
        }
      }
    }

    if (this.tricksPlayed === 8) {
      const bidTeam = this.bidder! % 2;
      const made = this.cardPts[bidTeam] >= this.target!;
      this.gamePts[bidTeam] += made ? 1 : -1;
      const names = this.teamName(bidTeam);
      this.summary = {
        title: made ? `${names} make their bid` : `${names} go down`,
        lines: [
          `Bid ${this.highBid} by ${this.seats[this.bidder!].name} — target ${this.target}${this.pairTeam !== null ? ' (after pair)' : ''}`,
          `Trump was ${SUIT_GLYPH[this.trump!]} ${SUIT_NAMES[this.trump!]}${this.trumpRevealed ? '' : ' (never revealed)'}`,
          `Card points: ${this.teamName(0)} ${this.cardPts[0]} – ${this.cardPts[1]} ${this.teamName(1)}`,
          `${made ? '+1' : '−1'} game point to ${names}`,
          `Game points: ${this.gamePts[0]} – ${this.gamePts[1]} (first to ${this.matchTarget})`,
        ],
      };
      this.announce(made ? 'success' : 'danger', made ? `${names} make ${this.target}!` : `${names} fall short of ${this.target}`);
      this.turn = null;
      this.pendingState = 'hand';
      return;
    }
    this.turn = winner;
  }

  private resolveHand(): void {
    this.pendingState = null;
    if (this.matchOver()) {
      this.finished = true;
      this.turn = null;
      return;
    }
    this.dealer = (this.dealer + 1) % 4;
    this.startHand();
  }

  private matchOver(): boolean {
    return this.gamePts.some((p) => p >= this.matchTarget || p <= -this.matchTarget);
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    if (this.phase === 'bid') {
      const min = this.highBid === null ? MIN_BID : this.highBid + 1;
      const out: LegalAction[] = [];
      for (let v = min; v <= MAX_BID; v++) out.push({ type: 'bid', value: v, label: `Bid ${v}` });
      if (!this.forcedBid()) out.push({ type: 'pass', label: 'Pass' });
      return out;
    }
    if (this.phase === 'trump') {
      return SUITS.map((suit) => ({ type: 'trump', suit, label: `${SUIT_GLYPH[suit]} ${SUIT_NAMES[suit]}` }));
    }
    const hand = this.hands[seat];
    if (this.mustTrump === seat) {
      const trumps = hand.filter((c) => c.suit === this.trump);
      return playActions(trumps.length ? trumps : hand);
    }
    const lead = this.trick[0]?.card.suit ?? null;
    if (lead === null) return playActions(hand);
    const same = hand.filter((c) => c.suit === lead);
    if (same.length) return playActions(same);
    const out = playActions(hand);
    if (!this.trumpRevealed) out.unshift({ type: 'reveal-trump', label: 'Reveal trump' });
    return out;
  }

  /** Everyone else has passed with no bid: the dealer must bid. */
  private forcedBid(): boolean {
    return this.highBid === null && this.bids.filter((b) => b === 'pass').length === 3;
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  private winningTeam(): number {
    const [a, b] = this.gamePts;
    const t = this.matchTarget;
    if (a >= t) return 0;
    if (b >= t) return 1;
    if (a <= -t) return 1;
    if (b <= -t) return 0;
    return a >= b ? 0 : 1;
  }

  outcome(): GameOutcome {
    const winTeam = this.winningTeam();
    return {
      players: this.seats.map((s, i) => ({
        id: s.id,
        position: i % 2 === winTeam ? 1 : 2,
        result: i % 2 === winTeam ? 'win' : 'loss',
        score: this.gamePts[i % 2],
      })),
      summary:
        this.gamePts[1 - winTeam] <= -this.matchTarget && this.gamePts[winTeam] < this.matchTarget
          ? `${this.teamName(winTeam)} win — ${this.teamName(1 - winTeam)} fell to −${-this.gamePts[1 - winTeam]}`
          : `${this.teamName(winTeam)} win ${this.gamePts[winTeam]}–${this.gamePts[1 - winTeam]}`,
    };
  }

  teamName(team: number): string {
    return `${this.seats[team].name} & ${this.seats[team + 2].name}`;
  }

  getView(viewerId: string): TwentyNineView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const myTurn = current === viewerId;
    const nameOf = (i: number | null) => (i === null ? '' : this.seats[i].name);
    const curName = current ? this.seats[this.seatIndex(current)].name : '';

    let phaseLabel: string;
    if (this.finished) phaseLabel = 'Game over';
    else if (this.pendingState === 'hand') phaseLabel = 'Hand over';
    else if (this.pendingState === 'trick') phaseLabel = `${nameOf(this.seatIndex(this.lastWinner!))} wins the trick`;
    else if (this.phase === 'bid') {
      if (!myTurn) phaseLabel = `${curName} is bidding…`;
      else if (this.forcedBid()) phaseLabel = 'Everyone passed — as dealer you must bid at least 16';
      else if (this.highBid === null) phaseLabel = 'Bid or pass — opening bid is 16';
      else phaseLabel = `Bid or pass — current bid ${this.highBid} by ${nameOf(this.highBidder)}`;
    } else if (this.phase === 'trump') {
      phaseLabel = myTurn ? 'Choose a secret trump' : `${curName} is choosing a secret trump…`;
    } else if (!myTurn) {
      phaseLabel = `Waiting for ${curName}…`;
    } else if (this.mustTrump === me) {
      phaseLabel = this.hands[me].some((c) => c.suit === this.trump) ? 'Trump revealed — you must play a trump' : 'No trumps — play any card';
    } else if (!this.trick.length) {
      phaseLabel = 'Your lead';
    } else if (this.hands[me].some((c) => c.suit === this.trick[0].card.suit)) {
      phaseLabel = 'Follow suit';
    } else {
      phaseLabel = this.trumpRevealed ? "You can't follow suit — play any card" : "You can't follow suit: reveal trump or play any card";
    }

    const trumpPublic = this.trumpRevealed || this.pendingState === 'hand' || this.finished;
    let trump: TwentyNineView['trump'];
    if (this.trump === null) trump = { suit: null, hidden: false, label: this.phase === 'bid' ? 'Trump: bidding…' : 'Trump: choosing…' };
    else if (trumpPublic) trump = { suit: this.trump, hidden: false, label: `Trump ${SUIT_GLYPH[this.trump]}` };
    else if (me === this.bidder) trump = { suit: this.trump, hidden: true, label: `Your secret trump ${SUIT_GLYPH[this.trump]}` };
    else trump = { suit: null, hidden: true, label: 'Trump hidden' };

    const seatStat = (i: number): string => {
      if (this.phase === 'bid') {
        const b = this.bids[i];
        return b === null ? 'No bid yet' : b === 'pass' ? 'Passed' : `Bid ${b}`;
      }
      if (this.phase === 'trump') return i === this.bidder ? `Won bid ${this.highBid}` : this.bids[i] === 'pass' ? 'Passed' : '—';
      return `${this.cardPts[i % 2]} team pts`;
    };

    const info = [`Hand ${this.handNumber}`];
    if (this.highBid !== null) info.push(`Bid ${this.highBid} · ${nameOf(this.phase === 'bid' ? this.highBidder : this.bidder)}`);
    if (this.target !== null && this.phase !== 'bid') info.push(`Target ${this.target}`);
    info.push(`Game to ${this.matchTarget}`);
    if (this.pairRule) info.push(this.pairTeam === null ? 'Pair on' : `Pair: ${this.teamName(this.pairTeam)}`);

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
        stat: seatStat(i),
        badges: [
          ...(i === this.dealer ? ['Dealer'] : []),
          ...(i === this.bidder ? ['Bidder'] : []),
          ...(i === this.revealedBy ? ['Revealed trump'] : []),
        ],
      })),
      hand: sortForDisplay(this.hands[me], TWENTY_NINE_ORDER),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump,
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Card points', 'Game points'],
        rows: [0, 1].map((t) => ({ label: this.teamName(t), values: [this.cardPts[t], this.gamePts[t]], highlight: t === me % 2 })),
      },
      info,
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      bidderId: this.bidder === null ? null : this.seats[this.bidder].id,
      highBid: this.highBid,
      bids: this.bids,
      target: this.target,
      trumpRevealed: this.trumpRevealed,
      revealedById: this.revealedBy === null ? null : this.seats[this.revealedBy].id,
      pairTeam: this.pairTeam,
      pairRule: this.pairRule,
      cardPoints: this.cardPts,
      gamePoints: this.gamePts,
      matchTarget: this.matchTarget,
      played: this.played,
    } satisfies TwentyNineView);
  }
}
