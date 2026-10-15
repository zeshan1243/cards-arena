import { Card, Rank } from '../../shared/models/card.model';
import { createStandardDeck, shuffle } from '../core/deck';
import {
  CardSelection,
  FloorPile,
  GameAction,
  GameOutcome,
  GameSettings,
  IllegalActionError,
  LegalAction,
  SeatConfig,
  TableGameEngine,
  TableView,
} from '../core/table-game';
import { BaseTableEngine, SUIT_GLYPH, findCard, sortForDisplay } from '../core/tricks';

/**
 * Seep (Sweep) — a fishing game for 2 players, or 4 in partnerships (seats 0 & 2 vs 1 & 3).
 *
 * Values: A=1, 2–10 face value, J=11, Q=12, K=13.
 * Card points: every spade = its value, the other three aces = 1, 10♦ = 6 (100 in the deck).
 * A seep (a capture that clears the floor) scores 50, except on the very last play of the deal.
 *
 * Deal: the seat after the (random, then rotating) dealer is the bidder and gets 4 cards.
 * With no 9–K among them the deck is reshuffled (bounded: after MAX_REDEALS a 9–K card is
 * swapped in). The bidder bids a house value 9–13 they hold. Then 4 cards go face up to the
 * floor and the rest are dealt: the bidder gets 8 more, every other seat 12. With 2 players
 * the remaining 24 cards are dealt 12 each when both hands are empty.
 *
 * The bidder's first play must capture the bid value with a card of that value or build a
 * house of the bid value; otherwise they throw a card of the bid value.
 *
 * A play is one card used to:
 *  - capture floor items (loose cards and/or a house) totalling exactly the card's value
 *    (a house only with a card of exactly its value; one combination per play);
 *  - build a house of 9–13 from the card plus loose floor cards (no house of that value
 *    may already be on the floor);
 *  - add to a house: make it pakka at the same value (card + optional loose cards total the
 *    house value), or raise a kacha house to a higher value ≤ 13 (no other house of that value);
 *  - throw it loose — not allowed while you own a house.
 * You always must keep a card matching every house you own (the last player to build or add
 * to a house owns it), so every build/add/capture/throw that would break that is illegal.
 * At the end of a deal the floor goes to the last player who captured.
 */

export type SeepPhase = 'bid' | 'play';

export interface SeepHouse {
  id: string;
  value: number;
  pakka: boolean;
  ownerId: string | null;
}

export interface SeepView extends TableView {
  phase: SeepPhase;
  dealerId: string;
  bidderId: string;
  bid: number | null;
  /** True while the bidder's first play (which must use the bid) is due. */
  bidPlay: boolean;
  houses: SeepHouse[];
  /** Current deal: card points and seeps per side. */
  cardPoints: [number, number];
  seeps: [number, number];
  totals: [number, number];
  dealNumber: number;
  rounds: number;
  stockCount: number;
}

interface FloorItem {
  id: string;
  cards: Card[];
  value: number;
  house: boolean;
  pakka: boolean;
  owner: number | null;
}

type OptionKind = 'capture' | 'build' | 'add' | 'throw';

interface PlayOption {
  kind: OptionKind;
  card: Card;
  /** Floor indices consumed: captured items, or loose cards used for a build/add. */
  items: number[];
  /** Floor index of the house added to (add only). */
  house: number;
  /** Resulting house value (build/add). */
  total: number;
  value: string;
  label: string;
}

const VALUES: Record<Rank, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
export const SEEP_BONUS = 50;
export const MAX_REDEALS = 20;
const CAPTURE_CAP = 8;
const BUILD_CAP = 6;
const ADD_CAP = 6;

export const cardValue = (c: Card): number => VALUES[c.rank];

export function cardPoints(c: Card): number {
  if (c.suit === 'spades') return VALUES[c.rank];
  if (c.rank === 'A') return 1;
  if (c.suit === 'diamonds' && c.rank === '10') return 6;
  return 0;
}

export const short = (c: Card) => `${c.rank}${SUIT_GLYPH[c.suit]}`;

/** All index lists (ascending, lexicographic DFS order) whose values sum to `target`. */
export function sumSubsets(values: readonly number[], target: number): number[][] {
  const out: number[][] = [];
  const chosen: number[] = [];
  const dfs = (start: number, remaining: number): void => {
    if (remaining === 0) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < values.length; i++) {
      if (values[i] <= remaining) {
        chosen.push(i);
        dfs(i + 1, remaining - values[i]);
        chosen.pop();
      }
    }
  };
  dfs(0, target);
  return out;
}

function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

export class SeepEngine extends BaseTableEngine implements TableGameEngine<SeepView> {
  readonly slug = 'seep';
  readonly rounds: number;
  readonly n: number;

  private hands: Card[][] = [];
  private stock: Card[] = [];
  private floor: FloorItem[] = [];
  private captured: Card[][] = [[], []];
  private seeps: [number, number] = [0, 0];
  private totals: [number, number] = [0, 0];
  private phase: SeepPhase = 'bid';
  private dealer = 0;
  private bidder = 0;
  private bid: number | null = null;
  private bidPlay = false;
  private turn: number | null = null;
  private lastCapturer: number | null = null;
  private houseSeq = 0;
  private dealNumber = 0;
  private redeals = 0;
  private pendingState: 'hand' | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 2 && seats.length !== 4) throw new Error('Seep needs 2 or 4 players');
    this.n = seats.length;
    this.rounds = Number(settings['rounds'] ?? 1) === 2 ? 2 : 1;
  }

  initializeGame(): void {
    this.dealer = Math.floor(this.rng() * this.n);
    this.startDeal();
  }

  // ------------------------------------------------------------------ flow

  private startDeal(): void {
    this.dealNumber += 1;
    this.bidder = (this.dealer + 1) % this.n;
    let deck = shuffle(createStandardDeck(), this.rng);
    let attempts = 1;
    while (!deck.slice(0, 4).some((c) => cardValue(c) >= 9)) {
      if (attempts >= MAX_REDEALS) {
        const j = deck.findIndex((c, i) => i >= 4 && cardValue(c) >= 9);
        const tmp = deck[3];
        deck[3] = deck[j];
        deck[j] = tmp;
        break;
      }
      deck = shuffle(createStandardDeck(), this.rng);
      attempts += 1;
    }
    this.redeals = attempts - 1;
    this.hands = Array.from({ length: this.n }, () => []);
    this.hands[this.bidder] = deck.slice(0, 4);
    this.stock = deck.slice(4);
    this.floor = [];
    this.captured = [[], []];
    this.seeps = [0, 0];
    this.lastCapturer = null;
    this.bid = null;
    this.bidPlay = false;
    this.phase = 'bid';
    this.turn = this.bidder;
    this.summary = null;
    if (this.redeals > 0) this.announce('info', `No 9–K for the bidder — redealt ${this.redeals}×`);
  }

  private side(seat: number): number {
    return seat % 2;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'bid') {
      this.bid = Number(action.value);
      for (const c of this.stock.slice(0, 4)) this.floor.push(this.looseItem(c));
      this.stock = this.stock.slice(4);
      this.hands[this.bidder].push(...this.stock.slice(0, 8));
      this.stock = this.stock.slice(8);
      for (let k = 1; k < this.n; k++) {
        const s = (this.bidder + k) % this.n;
        this.hands[s].push(...this.stock.slice(0, 12));
        this.stock = this.stock.slice(12);
      }
      this.phase = 'play';
      this.bidPlay = true;
      this.turn = this.bidder;
      this.announce('info', `${this.seats[seat].name} bids ${this.bid}`);
      return;
    }

    const card = findCard(this.hands[seat], action.cardId!);
    const opt = this.options(seat).find((o) => o.card.id === card.id && o.value === action.value);
    if (!opt) throw new IllegalActionError('Illegal play');
    this.hands[seat] = this.hands[seat].filter((c) => c.id !== card.id);
    const lastPlay = this.stock.length === 0 && this.hands.every((h) => h.length === 0);
    const name = this.seats[seat].name;
    const side = this.side(seat);

    if (opt.kind === 'capture') {
      const taken = new Set(opt.items);
      const cards = [card];
      this.floor.forEach((f, i) => {
        if (taken.has(i)) cards.push(...f.cards);
      });
      this.floor = this.floor.filter((_, i) => !taken.has(i));
      this.captured[side].push(...cards);
      this.lastCapturer = seat;
      if (this.floor.length === 0 && !lastPlay) {
        this.seeps[side] += 1;
        this.announce('success', `SEEP! +${SEEP_BONUS} for ${name}`);
      } else {
        this.announce('info', `${name} captures ${cards.length - 1} card${cards.length > 2 ? 's' : ''} with ${short(card)}`);
      }
    } else if (opt.kind === 'build') {
      const used = new Set(opt.items);
      const cards: Card[] = [];
      this.floor.forEach((f, i) => {
        if (used.has(i)) cards.push(...f.cards);
      });
      cards.push(card);
      this.floor = this.floor.filter((_, i) => !used.has(i));
      this.houseSeq += 1;
      this.floor.push({ id: `house-${this.houseSeq}`, cards, value: opt.total, house: true, pakka: false, owner: seat });
      this.announce('info', `${name} builds a house of ${opt.total}`);
    } else if (opt.kind === 'add') {
      const used = new Set(opt.items);
      const h = this.floor[opt.house];
      const before = h.value;
      this.floor.forEach((f, i) => {
        if (used.has(i)) h.cards.push(...f.cards);
      });
      h.cards.push(card);
      if (opt.total === h.value) h.pakka = true;
      else h.value = opt.total;
      h.owner = seat;
      this.floor = this.floor.filter((_, i) => !used.has(i));
      this.announce('info', opt.total === before ? `${name} cements the house of ${before}` : `${name} raises the house of ${before} to ${opt.total}`);
    } else {
      this.floor.push(this.looseItem(card));
      this.announce('info', `${name} throws ${short(card)}`);
    }
    this.bidPlay = false;

    if (this.hands.every((hh) => hh.length === 0)) {
      if (this.stock.length > 0) {
        for (let k = 0; k < this.n; k++) {
          const s = (this.bidder + k) % this.n;
          this.hands[s].push(...this.stock.slice(0, 12));
          this.stock = this.stock.slice(12);
        }
        this.turn = (seat + 1) % this.n;
      } else {
        this.endDeal(seat);
      }
    } else {
      this.turn = (seat + 1) % this.n;
    }
  }

  private looseItem(c: Card): FloorItem {
    return { id: c.id, cards: [c], value: cardValue(c), house: false, pakka: false, owner: null };
  }

  private endDeal(lastSeat: number): void {
    const lines: string[] = [];
    if (this.floor.length) {
      const to = this.lastCapturer ?? lastSeat;
      const cards = this.floor.flatMap((f) => f.cards);
      this.captured[this.side(to)].push(...cards);
      lines.push(`${this.seats[to].name} takes the last ${cards.length} floor card${cards.length > 1 ? 's' : ''}`);
      this.floor = [];
    }
    const pts = this.dealPoints();
    for (const t of [0, 1]) {
      this.totals[t] += pts[t];
      const cp = this.captured[t].reduce((s, c) => s + cardPoints(c), 0);
      lines.push(`${this.teamName(t)}: ${cp} card pts + ${this.seeps[t]} seep${this.seeps[t] === 1 ? '' : 's'} = ${pts[t]}`);
    }
    if (this.rounds > 1) lines.push(`Total: ${this.teamName(0)} ${this.totals[0]} – ${this.totals[1]} ${this.teamName(1)}`);
    const best = pts[0] === pts[1] ? null : pts[0] > pts[1] ? 0 : 1;
    this.summary = {
      title: `Deal ${this.dealNumber} of ${this.rounds}: ${best === null ? 'level' : `${this.teamName(best)} lead the deal`}`,
      lines,
    };
    this.announce('success', `Deal ${this.dealNumber} complete`);
    this.turn = null;
    this.pendingState = 'hand';
  }

  private dealPoints(): [number, number] {
    return [0, 1].map((t) => this.captured[t].reduce((s, c) => s + cardPoints(c), 0) + SEEP_BONUS * this.seeps[t]) as [number, number];
  }

  pending(): 'trick' | 'hand' | null {
    return this.pendingState;
  }

  resolve(): void {
    if (this.pendingState !== 'hand') throw new IllegalActionError('Nothing to resolve');
    this.pendingState = null;
    if (this.dealNumber >= this.rounds) {
      this.finished = true;
      this.turn = null;
      return;
    }
    this.dealer = (this.dealer + 1) % this.n;
    this.startDeal();
  }

  // ----------------------------------------------------------- legal plays

  /** After the play, the seat must still hold a card matching every house it owns. */
  private keepsHouses(seat: number, rest: readonly Card[], removed: readonly number[], extra: readonly number[]): boolean {
    const gone = new Set(removed);
    const need: number[] = [];
    this.floor.forEach((f, i) => {
      if (f.house && f.owner === seat && !gone.has(i)) need.push(f.value);
    });
    need.push(...extra);
    return need.every((v) => rest.some((c) => cardValue(c) === v));
  }

  private looseIndices(): number[] {
    const out: number[] = [];
    this.floor.forEach((f, i) => {
      if (!f.house) out.push(i);
    });
    return out;
  }

  private hasHouse(value: number, except: number): boolean {
    return this.floor.some((f, i) => i !== except && f.house && f.value === value);
  }

  private describe(items: readonly number[]): string {
    return items.map((i) => (this.floor[i].house ? `House ${this.floor[i].value}` : short(this.floor[i].cards[0]))).join(' + ');
  }

  private captureOptions(seat: number, card: Card, rest: readonly Card[], lastPlay: boolean): PlayOption[] {
    const v = cardValue(card);
    const eligible: number[] = [];
    this.floor.forEach((f, i) => {
      if (!f.house || f.value === v) eligible.push(i);
    });
    const subs = sumSubsets(
      eligible.map((i) => this.floor[i].value),
      v,
    )
      .map((s) => s.map((k) => eligible[k]))
      .filter((items) => this.keepsHouses(seat, rest, items, []));
    const hasHouse = (items: number[]) => (items.some((i) => this.floor[i].house) ? 1 : 0);
    subs.sort((a, b) => hasHouse(b) - hasHouse(a) || b.length - a.length || lexCompare(a, b));
    return subs.slice(0, CAPTURE_CAP).map((items) => {
      const seep = items.length === this.floor.length && !lastPlay;
      return {
        kind: 'capture',
        card,
        items,
        house: -1,
        total: v,
        value: `capture:${items.map((i) => this.floor[i].id).join(',')}`,
        label: `Capture ${this.describe(items)}${seep ? ' — Seep!' : ''}`,
      };
    });
  }

  private buildOptions(seat: number, card: Card, rest: readonly Card[], only: number | null): PlayOption[] {
    const v = cardValue(card);
    const loose = this.looseIndices();
    const found: { total: number; items: number[] }[] = [];
    for (let total = 9; total <= 13; total++) {
      if (only !== null && total !== only) continue;
      if (this.hasHouse(total, -1)) continue;
      const need = total - v;
      if (need < 1) continue;
      for (const s of sumSubsets(
        loose.map((i) => this.floor[i].value),
        need,
      )) {
        const items = s.map((k) => loose[k]);
        if (this.keepsHouses(seat, rest, items, [total])) found.push({ total, items });
      }
    }
    found.sort((a, b) => a.total - b.total || b.items.length - a.items.length || lexCompare(a.items, b.items));
    return found.slice(0, BUILD_CAP).map(({ total, items }) => ({
      kind: 'build',
      card,
      items,
      house: -1,
      total,
      value: `build:${total}:${items.map((i) => this.floor[i].id).join(',')}`,
      label: `Build house of ${total} with ${this.describe(items)}`,
    }));
  }

  private addOptions(seat: number, card: Card, rest: readonly Card[]): PlayOption[] {
    const v = cardValue(card);
    const loose = this.looseIndices();
    const found: { house: number; total: number; items: number[] }[] = [];
    this.floor.forEach((h, hi) => {
      if (!h.house) return;
      const targets = [h.value];
      if (!h.pakka) for (let t = h.value + 1; t <= 13; t++) if (!this.hasHouse(t, hi)) targets.push(t);
      for (const total of targets) {
        const need = total === h.value ? h.value - v : total - h.value - v;
        if (need < 0) continue;
        for (const s of sumSubsets(
          loose.map((i) => this.floor[i].value),
          need,
        )) {
          const items = s.map((k) => loose[k]);
          if (this.keepsHouses(seat, rest, [...items, hi], [total])) found.push({ house: hi, total, items });
        }
      }
    });
    found.sort((a, b) => a.house - b.house || a.total - b.total || b.items.length - a.items.length || lexCompare(a.items, b.items));
    return found.slice(0, ADD_CAP).map(({ house, total, items }) => {
      const h = this.floor[house];
      const extra = items.length ? ` (+ ${this.describe(items)})` : '';
      return {
        kind: 'add',
        card,
        items,
        house,
        total,
        value: `add:${h.id}:${total}:${items.map((i) => this.floor[i].id).join(',')}`,
        label: total === h.value ? `Cement House ${h.value}${extra}` : `Raise House ${h.value} to ${total}${extra}`,
      };
    });
  }

  private options(seat: number): PlayOption[] {
    const hand = this.hands[seat];
    const out: PlayOption[] = [];
    const ownsHouse = this.floor.some((f) => f.house && f.owner === seat);
    const others = this.hands.every((h, i) => i === seat || h.length === 0);
    const lastPlay = this.stock.length === 0 && hand.length === 1 && others;
    for (const card of hand) {
      const v = cardValue(card);
      const rest = hand.filter((c) => c.id !== card.id);
      if (this.bidPlay) {
        if (v === this.bid) out.push(...this.captureOptions(seat, card, rest, lastPlay));
        out.push(...this.buildOptions(seat, card, rest, this.bid));
        continue;
      }
      out.push(...this.captureOptions(seat, card, rest, lastPlay));
      out.push(...this.buildOptions(seat, card, rest, null));
      out.push(...this.addOptions(seat, card, rest));
      if (!ownsHouse) out.push({ kind: 'throw', card, items: [], house: -1, total: v, value: 'throw', label: `Throw ${short(card)} loose` });
    }
    if (this.bidPlay && out.length === 0) {
      for (const card of hand) {
        if (cardValue(card) === this.bid) out.push({ kind: 'throw', card, items: [], house: -1, total: this.bid, value: 'throw', label: `Throw ${short(card)} loose` });
      }
    }
    return out;
  }

  // --------------------------------------------------------------- queries

  currentPlayerId(): string | null {
    return this.pendingState || this.finished || this.turn === null ? null : this.seats[this.turn].id;
  }

  legalActions(playerId: string): LegalAction[] {
    if (this.currentPlayerId() !== playerId) return [];
    const seat = this.seatIndex(playerId);
    if (this.phase === 'bid') {
      const values: number[] = [];
      for (let v = 9; v <= 13; v++) if (this.hands[seat].some((c) => cardValue(c) === v)) values.push(v);
      return values.map((v) => ({ type: 'bid', value: v, label: `Bid ${v}` }));
    }
    return this.options(seat).map((o) => ({ type: 'play', cardId: o.card.id, value: o.value, label: o.label }));
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    const [a, b] = this.totals;
    const draw = a === b;
    const win = a > b ? 0 : 1;
    return {
      players: this.seats.map((s, i) => ({
        id: s.id,
        position: draw || i % 2 === win ? 1 : 2,
        result: draw ? 'draw' : i % 2 === win ? 'win' : 'loss',
        score: this.totals[i % 2],
      })),
      summary: draw ? `Draw at ${a} points each` : `${this.teamName(win)} win ${this.totals[win]}–${this.totals[1 - win]}`,
    };
  }

  teamName(team: number): string {
    return this.n === 4 ? `${this.seats[team].name} & ${this.seats[team + 2].name}` : this.seats[team].name;
  }

  getView(viewerId: string): SeepView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const bidderName = this.seats[this.bidder].name;
    const phaseLabel =
      this.finished ? 'Game over'
      : this.pendingState === 'hand' ? `Deal ${this.dealNumber} complete`
      : this.phase === 'bid' ? (current === viewerId ? 'Bid a house value (9–K) you hold' : `${bidderName} is bidding…`)
      : current === viewerId ? (this.bidPlay ? `Use your bid: capture or build ${this.bid}` : 'Capture, build or throw a card')
      : current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…` : 'Resolving…';
    const pts = this.dealPoints();
    const cardPts = [0, 1].map((t) => this.captured[t].reduce((s, c) => s + cardPoints(c), 0)) as [number, number];
    const floor: FloorPile[] = this.floor.map((f) => ({
      id: f.id,
      cards: f.cards,
      label: f.house ? `House ${f.value} · ${f.pakka ? 'pakka' : 'kacha'}` : null,
      owner: f.owner === null ? null : this.seats[f.owner].id,
    }));
    const columns = this.rounds > 1 ? ['Points', 'Seeps', 'Total'] : ['Points', 'Seeps'];
    const info = [`Deal ${this.dealNumber} of ${this.rounds}`];
    if (this.bid !== null) info.unshift(`Bid ${this.bid}`);
    if (this.n === 2 && this.phase === 'play' && this.stock.length) info.push(`Stock ${this.stock.length}`);

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
        stat: `${pts[i % 2]} pts · ${this.seeps[i % 2]} seep${this.seeps[i % 2] === 1 ? '' : 's'}`,
        badges: [...(i === this.dealer ? ['Dealer'] : []), ...(i === this.bidder ? [this.bid !== null ? `Bid ${this.bid}` : 'Bidder'] : [])],
      })),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: [],
      leadSuit: null,
      trickWinnerId: null,
      trump: null,
      floor,
      scores: {
        title: this.rounds > 1 ? `Deal ${this.dealNumber} of ${this.rounds}` : 'Score',
        columns,
        rows: [0, 1].map((t) => ({
          label: this.teamName(t),
          values: this.rounds > 1 ? [pts[t], this.seeps[t], this.totals[t] + (this.pendingState || this.finished ? 0 : pts[t])] : [pts[t], this.seeps[t]],
          highlight: t === me % 2,
        })),
      },
      info,
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      bidderId: this.seats[this.bidder].id,
      bid: this.bid,
      bidPlay: this.bidPlay,
      houses: this.floor
        .filter((f) => f.house)
        .map((f) => ({ id: f.id, value: f.value, pakka: f.pakka, ownerId: f.owner === null ? null : this.seats[f.owner].id })),
      cardPoints: cardPts,
      seeps: this.seeps,
      totals: this.totals,
      dealNumber: this.dealNumber,
      rounds: this.rounds,
      stockCount: this.stock.length,
    } satisfies SeepView);
  }

  // ------------------------------------------------------------ test hooks

  /** Test-only: replace the play state (hands, floor) to set up a scenario. */
  setupForTest(state: {
    hands: Card[][];
    floor: { cards: Card[]; value?: number; house?: boolean; pakka?: boolean; owner?: number | null }[];
    turn: number;
    stock?: Card[];
    bid?: number | null;
    bidPlay?: boolean;
  }): void {
    this.hands = state.hands.map((h) => [...h]);
    this.floor = state.floor.map((f) => {
      if (!f.house) return this.looseItem(f.cards[0]);
      this.houseSeq += 1;
      return { id: `house-${this.houseSeq}`, cards: [...f.cards], value: f.value!, house: true, pakka: !!f.pakka, owner: f.owner ?? null };
    });
    this.stock = state.stock ?? [];
    this.phase = 'play';
    this.turn = state.turn;
    this.bid = state.bid ?? null;
    this.bidPlay = state.bidPlay ?? false;
    this.captured = [[], []];
    this.seeps = [0, 0];
    this.lastCapturer = null;
    this.pendingState = null;
  }

  capturedCards(side: number): Card[] {
    return [...this.captured[side]];
  }
}
