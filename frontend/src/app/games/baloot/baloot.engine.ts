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
import { BaseTableEngine, RankOrder, SUIT_GLYPH, createShortDeck, findCard, playActions } from '../core/tricks';

/**
 * Baloot (Saudi) — "core" rules, 4 players in two partnerships (seats 0 & 2 vs 1 & 3).
 * Projects/melds are not included except the Baloot (K + Q of trumps) bonus.
 *
 * DEAL. 32 cards (7–A). First dealer is random (one rng() call), the deal rotates clockwise.
 *   The shuffled deck is dealt 5 cards each starting with the seat after the dealer
 *   (deck[0..19], one card at a time), deck[20] is turned face up (the "buyer card"),
 *   deck[21..31] is the stock.
 * BIDDING. Round 1, starting after the dealer, each seat speaks once:
 *   - `choose sun` — Sun (no trumps). Bidding ends immediately; that seat buys Sun.
 *   - `choose hokm` — Hokm with the buyer card's suit as trumps. Only the first Hokm is
 *     allowed; the seats still to speak in this round may then only choose Sun (which
 *     overtakes the Hokm and ends the bidding) or pass. Seats that already passed get no
 *     second chance. If nobody overtakes, the Hokm bidder buys.
 *   - `pass`.
 *   If all four pass, round 2 (again starting after the dealer): Sun, Hokm naming any suit
 *   except the buyer card's suit (`trump` action), or pass — with the same "first Hokm can
 *   only be overtaken by a later Sun" rule. If all four pass again the cards are thrown in,
 *   the dealer moves on and a fresh deck is shuffled (rng).
 * COMPLETION. Starting after the dealer, the buyer takes the buyer card plus 2 stock cards,
 *   every other seat takes 3 stock cards (8 each). The seat after the dealer leads.
 * PLAY. Follow suit if able. In Hokm, when unable to follow you must trump if you can,
 *   unless your partner is currently winning the trick (then anything goes). Whenever you
 *   play a trump on a trick that already holds a trump you must beat the highest trump if
 *   you can (also when trumps were led). Sun has no trumps.
 * RANKS (high→low). Plain: A 10 K Q J 9 8 7. Trumps: J 9 A 10 K Q 8 7.
 * POINTS. Plain: A 11, 10 10, K 4, Q 3, J 2. Trumps: J 20, 9 14, A 11, 10 10, K 4, Q 3.
 *   Last trick +10. Totals: Sun 130 raw, Hokm 162 raw.
 * SCORING (integers). Hand value: Sun 26, Hokm 16.
 *   buyerGame = Sun: floor((raw * 2 + 5) / 10)   Hokm: floor((raw + 5) / 10)   (half-up)
 *   defenders get handValue − buyerGame, so the two always sum to exactly 26 / 16.
 *   If buyerGame * 2 <= handValue (half or less) the contract fails: defenders take all.
 *   Baloot: in Hokm, a seat that plays both the K and Q of trumps scores +2 for its team,
 *   added after the contract check (even when the contract failed).
 * MATCH. First team to the target (52 / 101 / 152). If both pass it in the same hand the
 *   higher total wins; an exact tie plays another hand. Safety cap: after MAX_DEALS deals
 *   (redeals included) the higher total wins, ties going to team 0.
 */

export type BalootPhase = 'bid' | 'play';
export type BalootContract = 'sun' | 'hokm';

export interface BalootView extends TableView {
  phase: BalootPhase;
  dealerId: string;
  buyerId: string | null;
  contract: BalootContract | null;
  trumpSuit: Suit | null;
  /** Face-up card during bidding (public), null afterwards. */
  buyerCard: Card | null;
  bidRound: 1 | 2;
  /** Seat that chose Hokm this round (may still be overtaken by Sun). */
  hokmBidderId: string | null;
  /** Raw card points per team in the current hand. */
  handRaw: [number, number];
  matchPoints: [number, number];
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  target: number;
}

/** Low → high. */
export const PLAIN_ORDER: RankOrder = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
export const TRUMP_ORDER: RankOrder = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];

const PLAIN_POINTS: Record<string, number> = { A: 11, '10': 10, K: 4, Q: 3, J: 2 };
const TRUMP_POINTS: Record<string, number> = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3 };

export const LAST_TRICK_BONUS = 10;
export const BALOOT_BONUS = 2;
export const MAX_DEALS = 250;

export function cardPoints(card: Card, trump: Suit | null): number {
  return (card.suit === trump ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank]) ?? 0;
}

export function rankIndex(card: Card, trump: Suit | null): number {
  return (card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card.rank);
}

/** Highest trump if any trump was played, else highest of the led suit (suit-specific orders). */
export function balootTrickWinner(plays: readonly TrickPlay[], trump: Suit | null): TrickPlay {
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const pTrump = trump !== null && p.card.suit === trump;
    const bestTrump = trump !== null && best.card.suit === trump;
    if (pTrump && !bestTrump) best = p;
    else if (p.card.suit === best.card.suit && rankIndex(p.card, trump) > rankIndex(best.card, trump)) best = p;
  }
  return best;
}

export function handValue(contract: BalootContract): number {
  return contract === 'sun' ? 26 : 16;
}

/** Buyer's raw points → buyer's game points (integer half-up). */
export function buyerGamePoints(raw: number, contract: BalootContract): number {
  return contract === 'sun' ? Math.floor((raw * 2 + 5) / 10) : Math.floor((raw + 5) / 10);
}

/** Game points [buyerTeam, defenders] before the Baloot bonus, and whether the contract was made. */
export function scoreContract(buyerRaw: number, contract: BalootContract): { buyer: number; defenders: number; made: boolean } {
  const total = handValue(contract);
  const buyer = buyerGamePoints(buyerRaw, contract);
  const made = buyer * 2 > total;
  return made ? { buyer, defenders: total - buyer, made } : { buyer: 0, defenders: total, made };
}

/** Cards legal to play from `hand` onto `trick`. */
export function legalCards(hand: readonly Card[], trick: readonly TrickPlay[], trump: Suit | null, partnerWinning: boolean): Card[] {
  if (!trick.length) return [...hand];
  const lead = trick[0].card.suit;
  const trumps = trump === null ? [] : hand.filter((c) => c.suit === trump);
  const topTrump = trick.filter((p) => p.card.suit === trump).reduce((m, p) => Math.max(m, rankIndex(p.card, trump)), -1);
  /** Trumps allowed if a trump is played: must over-trump when possible. */
  const trumpChoices = (): Card[] => {
    const over = trumps.filter((c) => rankIndex(c, trump) > topTrump);
    return over.length ? over : trumps;
  };
  if (lead === trump) return trumps.length ? trumpChoices() : [...hand];
  const same = hand.filter((c) => c.suit === lead);
  if (same.length) return same;
  if (!trumps.length) return [...hand];
  if (partnerWinning) return [...hand.filter((c) => c.suit !== trump), ...trumpChoices()];
  return trumpChoices();
}

export function sortBalootHand(cards: readonly Card[], trump: Suit | null): Card[] {
  return [...cards].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || rankIndex(a, trump) - rankIndex(b, trump));
}

const cardText = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;

export class BalootEngine extends BaseTableEngine implements TableGameEngine<BalootView> {
  readonly slug = 'baloot';
  readonly target: number;

  private hands: Card[][] = [[], [], [], []];
  private stock: Card[] = [];
  private buyerCard: Card | null = null;
  private phase: BalootPhase = 'bid';
  private dealer = 0;
  private bidRound: 1 | 2 = 1;
  /** Seats spoken so far in this bidding round (0..4). */
  private bidCount = 0;
  private bidMarks: (string | null)[] = [null, null, null, null];
  private hokmBidder: number | null = null;
  private hokmSuit: Suit | null = null;
  private contract: BalootContract | null = null;
  private trump: Suit | null = null;
  private buyer: number | null = null;
  private turn: number | null = null;
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private tricksWon = [0, 0, 0, 0];
  private raw: [number, number] = [0, 0];
  /** Trump K/Q played per seat this hand (bit 1 = K, bit 2 = Q). */
  private kq = [0, 0, 0, 0];
  private balootTeams: number[] = [];
  private points: [number, number] = [0, 0];
  private handNumber = 0;
  private deals = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;
  private winner = 0;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Baloot needs exactly 4 players');
    this.target = Number(settings['target'] ?? 101);
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * 4);
    this.startDeal();
  }

  // ------------------------------------------------------------------ flow

  private startDeal(): void {
    this.deals += 1;
    const deck = shuffle(createShortDeck(), this.rng);
    this.hands = [[], [], [], []];
    for (let i = 0; i < 20; i++) this.hands[(this.dealer + 1 + i) % 4].push(deck[i]);
    this.buyerCard = deck[20];
    this.stock = deck.slice(21);
    this.phase = 'bid';
    this.bidRound = 1;
    this.bidCount = 0;
    this.bidMarks = [null, null, null, null];
    this.hokmBidder = null;
    this.hokmSuit = null;
    this.contract = null;
    this.trump = null;
    this.buyer = null;
    this.trick = [];
    this.played = [];
    this.tricksWon = [0, 0, 0, 0];
    this.raw = [0, 0];
    this.kq = [0, 0, 0, 0];
    this.balootTeams = [];
    this.summary = null;
    this.turn = (this.dealer + 1) % 4;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    const name = this.seats[seat].name;
    if (this.phase === 'bid') {
      if (action.type === 'choose' && action.value === 'sun') {
        this.bidMarks[seat] = 'Sun';
        return this.buy(seat, 'sun', null);
      }
      if (action.type === 'choose' && action.value === 'hokm') {
        this.hokmBidder = seat;
        this.hokmSuit = this.buyerCard!.suit;
        this.bidMarks[seat] = `Hokm ${SUIT_GLYPH[this.hokmSuit]}`;
        this.announce('info', `${name} chooses Hokm ${SUIT_GLYPH[this.hokmSuit]}`);
      } else if (action.type === 'trump') {
        this.hokmBidder = seat;
        this.hokmSuit = action.suit!;
        this.bidMarks[seat] = `Hokm ${SUIT_GLYPH[this.hokmSuit]}`;
        this.announce('info', `${name} chooses Hokm ${SUIT_GLYPH[this.hokmSuit]}`);
      } else {
        this.bidMarks[seat] = 'Pass';
      }
      this.bidCount += 1;
      if (this.bidCount < 4) {
        this.turn = (seat + 1) % 4;
        return;
      }
      if (this.hokmBidder !== null) return this.buy(this.hokmBidder, 'hokm', this.hokmSuit);
      if (this.bidRound === 1) {
        this.bidRound = 2;
        this.bidCount = 0;
        this.bidMarks = [null, null, null, null];
        this.turn = (this.dealer + 1) % 4;
        this.announce('info', 'Everyone passed — second round of bidding');
        return;
      }
      this.announce('info', 'Everyone passed — redeal');
      this.dealer = (this.dealer + 1) % 4;
      if (this.deals >= MAX_DEALS) return this.finish();
      return this.startDeal();
    }

    const card = findCard(this.hands[seat], action.cardId!);
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    this.trick.push({ playerId, card });
    if (this.trump !== null && card.suit === this.trump && (card.rank === 'K' || card.rank === 'Q')) {
      this.kq[seat] |= card.rank === 'K' ? 1 : 2;
      if (this.kq[seat] === 3) {
        this.balootTeams.push(seat % 2);
        this.announce('success', `Baloot! ${name} holds K & Q of trumps (+${BALOOT_BONUS})`);
      }
    }
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = balootTrickWinner(this.trick, this.trump).playerId;
      this.pendingState = 'trick';
    } else {
      this.turn = (seat + 1) % 4;
    }
  }

  private buy(seat: number, contract: BalootContract, trump: Suit | null): void {
    this.contract = contract;
    this.trump = trump;
    this.buyer = seat;
    for (let i = 0; i < 4; i++) {
      const s = (this.dealer + 1 + i) % 4;
      if (s === seat) {
        this.hands[s].push(this.buyerCard!, ...this.stock.splice(0, 2));
      } else {
        this.hands[s].push(...this.stock.splice(0, 3));
      }
    }
    this.buyerCard = null;
    this.phase = 'play';
    this.handNumber += 1;
    this.turn = (this.dealer + 1) % 4;
    this.announce('info', `${this.seats[seat].name} buys ${this.contractLabel()}`);
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
    this.tricksWon[winner] += 1;
    for (const p of this.trick) this.raw[team] += cardPoints(p.card, this.trump);
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;
    if (this.played.length < 32) {
      this.turn = winner;
      return;
    }
    this.raw[team] += LAST_TRICK_BONUS;
    this.scoreHand();
  }

  private scoreHand(): void {
    const contract = this.contract!;
    const bt = this.buyer! % 2;
    const res = scoreContract(this.raw[bt], contract);
    const gained: [number, number] = [0, 0];
    gained[bt] = res.buyer;
    gained[1 - bt] = res.defenders;
    for (const t of this.balootTeams) gained[t] += BALOOT_BONUS;
    this.points[0] += gained[0];
    this.points[1] += gained[1];
    const buyerName = this.seats[this.buyer!].name;
    this.summary = {
      title: res.made ? `${this.teamName(bt)} make ${this.contractLabel()}` : `${buyerName}'s ${this.contractLabel()} fails`,
      lines: [
        `${buyerName} bought ${this.contractLabel()} (${handValue(contract)} points at stake)`,
        `Card points: ${this.teamName(0)} ${this.raw[0]} – ${this.raw[1]} ${this.teamName(1)}`,
        ...(res.made ? [] : [`Contract failed — ${this.teamName(1 - bt)} take all ${handValue(contract)}`]),
        ...this.balootTeams.map((t) => `Baloot: +${BALOOT_BONUS} to ${this.teamName(t)}`),
        `This hand: ${this.teamName(0)} +${gained[0]}, ${this.teamName(1)} +${gained[1]}`,
        `Match: ${this.points[0]} – ${this.points[1]} (first to ${this.target})`,
      ],
    };
    this.announce(res.made ? 'success' : 'danger', res.made ? `${this.contractLabel()} made` : `${this.contractLabel()} failed!`);
    this.turn = null;
    this.pendingState = 'hand';
  }

  private resolveHand(): void {
    this.pendingState = null;
    const [a, b] = this.points;
    if ((a >= this.target || b >= this.target) && a !== b) return this.finish();
    this.dealer = (this.dealer + 1) % 4;
    if (this.deals >= MAX_DEALS) return this.finish();
    this.startDeal();
  }

  private finish(): void {
    this.finished = true;
    this.turn = null;
    this.winner = this.points[0] >= this.points[1] ? 0 : 1;
  }

  private contractLabel(): string {
    if (this.contract === 'sun') return 'Sun';
    if (this.contract === 'hokm') return `Hokm ${SUIT_GLYPH[this.trump!]}`;
    return '';
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    if (this.phase === 'bid') {
      const out: LegalAction[] = [{ type: 'choose', value: 'sun', label: 'Sun' }];
      if (this.hokmBidder === null) {
        const bs = this.buyerCard!.suit;
        if (this.bidRound === 1) out.push({ type: 'choose', value: 'hokm', label: `Hokm ${SUIT_GLYPH[bs]}` });
        else for (const s of SUITS) if (s !== bs) out.push({ type: 'trump', suit: s, label: `Hokm ${SUIT_GLYPH[s]}` });
      }
      out.push({ type: 'pass', label: 'Pass' });
      return out;
    }
    const partnerWinning = this.trick.length > 0 && balootTrickWinner(this.trick, this.trump).playerId === this.seats[(seat + 2) % 4].id;
    return playActions(legalCards(this.hands[seat], this.trick, this.trump, partnerWinning));
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    const winTeam = this.finished ? this.winner : this.points[0] >= this.points[1] ? 0 : 1;
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

  getView(viewerId: string): BalootView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const waiting = current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';
    const phaseLabel =
      this.finished ? 'Game over'
      : this.pendingState === 'hand' ? 'Hand over'
      : this.phase === 'bid'
        ? current === viewerId
          ? this.hokmBidder !== null
            ? 'Overtake with Sun or pass'
            : this.bidRound === 1 ? 'Round 1: Sun, Hokm or pass' : 'Round 2: Sun, Hokm in another suit, or pass'
          : waiting
      : current === viewerId ? (this.trick.length ? 'Follow suit if you can' : 'Your lead')
      : waiting;

    const info = [`Hand ${Math.max(this.handNumber, 1)}`, `First to ${this.target}`];
    if (this.phase === 'bid') {
      info.unshift(`Bidding round ${this.bidRound}`);
      if (this.buyerCard) info.push(`Buyer card: ${cardText(this.buyerCard)}`);
    } else {
      info.unshift(this.contractLabel());
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
        team: i % 2,
        cardCount: this.hands[i].length,
        stat: this.phase === 'bid' ? (this.bidMarks[i] ?? '—') : `${this.tricksWon[i]} trick${this.tricksWon[i] === 1 ? '' : 's'}`,
        badges: [...(i === this.dealer ? ['Dealer'] : []), ...(i === this.buyer ? ['Buyer'] : [])],
      })),
      hand: sortBalootHand(this.hands[me], this.trump),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump:
        this.contract === 'sun' ? { suit: null, hidden: false, label: 'Sun (no trumps)' }
        : this.contract === 'hokm' ? { suit: this.trump, hidden: false, label: `Hokm ${SUIT_GLYPH[this.trump!]}` }
        : { suit: null, hidden: false, label: this.buyerCard ? `Buyer card ${cardText(this.buyerCard)}` : 'Bidding…' },
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Hand', 'Match'],
        rows: [0, 1].map((t) => ({ label: this.teamName(t), values: [this.raw[t], this.points[t]], highlight: t === me % 2 })),
      },
      info,
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      buyerId: this.buyer === null ? null : this.seats[this.buyer].id,
      contract: this.contract,
      trumpSuit: this.trump,
      buyerCard: this.buyerCard,
      bidRound: this.bidRound,
      hokmBidderId: this.hokmBidder === null ? null : this.seats[this.hokmBidder].id,
      handRaw: this.raw,
      matchPoints: this.points,
      played: this.played,
      target: this.target,
    } satisfies BalootView);
  }
}
