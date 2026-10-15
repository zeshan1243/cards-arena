import { Card } from '../../shared/models/card.model';
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
import { BaseTableEngine, findCard, followSuit, playActions, sortForDisplay, trickWinner } from '../core/tricks';

/**
 * Spades — 4 players in two partnerships (seats 0 & 2 vs 1 & 3), 52 cards, A high,
 * spades always trump.
 *
 * Each hand: the dealer (random at first, then clockwise) deals 13 cards each,
 * starting with the player on their left. Starting after the dealer, each player
 * bids 0–13 tricks once (0 = Nil). A team's contract is the sum of its non-nil bids.
 * The player after the dealer leads the first trick. Follow suit if able, otherwise
 * play anything. Spades may not be led until a spade has been played (as a discard
 * or a trump) unless the leader holds nothing but spades.
 *
 * Scoring per team:
 *  - contract > 0: team tricks (both partners, nil bidder included) ≥ contract →
 *    +10 × contract + 1 per overtrick ("bag"); otherwise −10 × contract.
 *  - contract 0 (both partners bid nil): no contract score and no bags.
 *  - each nil bid: +100 if that player takes no tricks, −100 otherwise.
 *  - every 10 accumulated bags → −100 and the bag count drops by 10.
 * After a hand, the match ends if a team has reached the target or fallen to −200;
 * higher score wins, and a tie means another hand is played. A safety cap of
 * MAX_HANDS hands ends the match (fewer bags breaks a tie, otherwise a draw).
 */

export type SpadesPhase = 'bid' | 'play';

export interface SpadesView extends TableView {
  phase: SpadesPhase;
  dealerId: string;
  /** Bid per seat (null = not yet bid). 0 = Nil. */
  bids: (number | null)[];
  /** Tricks taken per seat this hand. */
  tricksTaken: number[];
  teamScores: [number, number];
  teamBags: [number, number];
  spadesBroken: boolean;
  /** Every card played in completed tricks this hand (public). */
  played: Card[];
  target: number;
  handNumber: number;
}

export const NIL_BONUS = 100;
export const BAG_LIMIT = 10;
export const BAG_PENALTY = 100;
export const LOSS_FLOOR = -200;
export const MAX_HANDS = 50;

export interface TeamHandScore {
  contract: number;
  tricks: number;
  /** Points from the contract (bid/overtricks or set). */
  contractPoints: number;
  /** Net nil bonus / penalty. */
  nilPoints: number;
  nilMade: number;
  nilFailed: number;
  newBags: number;
  bagPenalties: number;
  /** Total change this hand, including bag penalties. */
  delta: number;
  /** Bag count after the hand (after penalties). */
  bags: number;
  made: boolean;
}

/** Pure scoring for one team. `seats` are the two seat indices of the team. */
export function scoreTeam(bids: readonly number[], tricks: readonly number[], seats: readonly number[], bagsBefore: number): TeamHandScore {
  let contract = 0;
  let teamTricks = 0;
  let nilPoints = 0;
  let nilMade = 0;
  let nilFailed = 0;
  for (const s of seats) {
    teamTricks += tricks[s];
    if (bids[s] === 0) {
      if (tricks[s] === 0) {
        nilPoints += NIL_BONUS;
        nilMade += 1;
      } else {
        nilPoints -= NIL_BONUS;
        nilFailed += 1;
      }
    } else {
      contract += bids[s];
    }
  }
  let contractPoints = 0;
  let newBags = 0;
  let made = false;
  if (contract > 0) {
    if (teamTricks >= contract) {
      made = true;
      newBags = teamTricks - contract;
      contractPoints = 10 * contract + newBags;
    } else {
      contractPoints = -10 * contract;
    }
  }
  let bags = bagsBefore + newBags;
  let bagPenalties = 0;
  while (bags >= BAG_LIMIT) {
    bags -= BAG_LIMIT;
    bagPenalties += 1;
  }
  return {
    contract,
    tricks: teamTricks,
    contractPoints,
    nilPoints,
    nilMade,
    nilFailed,
    newBags,
    bagPenalties,
    delta: contractPoints + nilPoints - BAG_PENALTY * bagPenalties,
    bags,
    made,
  };
}

/**
 * Match result after a hand: winning team (0/1), 'draw', or null to keep playing.
 */
export function matchResult(scores: readonly number[], bags: readonly number[], target: number, handsPlayed: number): 0 | 1 | 'draw' | null {
  const over = scores.some((s) => s >= target || s <= LOSS_FLOOR) || handsPlayed >= MAX_HANDS;
  if (!over) return null;
  if (scores[0] !== scores[1]) return scores[0] > scores[1] ? 0 : 1;
  if (handsPlayed < MAX_HANDS) return null; // tied: play another hand
  if (bags[0] !== bags[1]) return bags[0] < bags[1] ? 0 : 1;
  return 'draw';
}

export class SpadesEngine extends BaseTableEngine implements TableGameEngine<SpadesView> {
  readonly slug = 'spades';
  readonly target: number;

  private hands: Card[][] = [];
  private phase: SpadesPhase = 'bid';
  private dealer = 0;
  private turn: number | null = null;
  private bids: (number | null)[] = [null, null, null, null];
  private tricksTaken = [0, 0, 0, 0];
  private trick: TrickPlay[] = [];
  private played: Card[] = [];
  private broken = false;
  private scores: [number, number] = [0, 0];
  private bags: [number, number] = [0, 0];
  private handNumber = 0;
  private pendingState: 'trick' | 'hand' | null = null;
  private lastWinner: string | null = null;
  private summary: { title: string; lines: string[] } | null = null;
  private finished = false;
  private result: 0 | 1 | 'draw' | null = null;

  constructor(seats: SeatConfig[], seed: number, settings: GameSettings = {}) {
    super(seats, seed);
    if (seats.length !== 4) throw new Error('Spades needs exactly 4 players');
    this.target = Number(settings['target'] ?? 300);
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
    this.bids = [null, null, null, null];
    this.tricksTaken = [0, 0, 0, 0];
    this.trick = [];
    this.played = [];
    this.broken = false;
    this.turn = (this.dealer + 1) % 4;
    this.summary = null;
  }

  protected handle(playerId: string, action: GameAction): void {
    const seat = this.seatIndex(playerId);
    if (action.type === 'bid') {
      const value = Number(action.value);
      this.bids[seat] = value;
      this.announce('info', `${this.seats[seat].name} bids ${value === 0 ? 'Nil' : value}`);
      if (this.bids.every((b) => b !== null)) {
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
    if (card.suit === 'spades' && !this.broken) {
      this.broken = true;
      this.announce('info', 'Spades broken!');
    }
    if (this.trick.length === 4) {
      this.turn = null;
      this.lastWinner = trickWinner(this.trick, 'spades').playerId;
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
    this.tricksTaken[winner] += 1;
    this.played.push(...this.trick.map((p) => p.card));
    this.trick = [];
    this.lastWinner = null;
    this.pendingState = null;
    if (this.hands[winner].length === 0) {
      this.endHand();
      return;
    }
    this.turn = winner;
  }

  private endHand(): void {
    const bids = this.bids.map((b) => b ?? 0);
    const results = [0, 1].map((t) => scoreTeam(bids, this.tricksTaken, [t, t + 2], this.bags[t]));
    const lines: string[] = [];
    let banner: { kind: 'info' | 'success' | 'danger'; text: string } | null = null;
    for (const t of [0, 1]) {
      const r = results[t];
      this.scores[t] += r.delta;
      this.bags[t] = r.bags;
      const name = this.teamName(t);
      const contractText =
        r.contract === 0 ? `no contract, took ${r.tricks}`
        : r.made ? `bid ${r.contract}, took ${r.tricks} → +${r.contractPoints}${r.newBags ? ` (${r.newBags} bag${r.newBags > 1 ? 's' : ''})` : ''}`
        : `bid ${r.contract}, took ${r.tricks} → set ${r.contractPoints}`;
      lines.push(`${name}: ${contractText}`);
      for (const s of [t, t + 2]) {
        if (bids[s] !== 0) continue;
        const ok = this.tricksTaken[s] === 0;
        lines.push(`${this.seats[s].name} nil ${ok ? 'made +100' : 'failed −100'}`);
        if (!banner || banner.kind === 'info') banner = ok ? { kind: 'success', text: 'Nil made +100' } : { kind: 'danger', text: 'Nil failed −100' };
      }
      if (r.bagPenalties) {
        lines.push(`${name}: bag penalty −${BAG_PENALTY * r.bagPenalties}`);
        banner = { kind: 'danger', text: `Bag penalty −${BAG_PENALTY * r.bagPenalties}` };
      }
    }
    lines.push(`Match: ${this.scores[0]} – ${this.scores[1]} (to ${this.target})`);
    this.result = matchResult(this.scores, this.bags, this.target, this.handNumber);
    const title =
      this.result === 'draw' ? 'Match drawn'
      : this.result !== null ? `${this.teamName(this.result)} win the match`
      : `Hand ${this.handNumber} complete`;
    this.summary = { title, lines };
    if (banner) this.announce(banner.kind, banner.text);
    else this.announce('info', `Hand ${this.handNumber}: ${results[0].delta >= 0 ? '+' : ''}${results[0].delta} / ${results[1].delta >= 0 ? '+' : ''}${results[1].delta}`);
    this.turn = null;
    this.pendingState = 'hand';
  }

  private resolveHand(): void {
    this.pendingState = null;
    if (this.result !== null) {
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
      return Array.from({ length: 14 }, (_, v) => ({ type: 'bid' as const, value: v, label: v === 0 ? 'Nil' : `Bid ${v}` }));
    }
    return playActions(this.playable(seat));
  }

  private playable(seat: number): Card[] {
    const hand = this.hands[seat];
    if (this.trick.length === 0) {
      if (this.broken) return [...hand];
      const nonSpades = hand.filter((c) => c.suit !== 'spades');
      return nonSpades.length ? nonSpades : [...hand];
    }
    return followSuit(hand, this.trick[0].card.suit);
  }

  cardSelection(): CardSelection | null {
    return null;
  }

  isGameOver(): boolean {
    return this.finished;
  }

  outcome(): GameOutcome {
    if (this.result === 'draw') {
      return {
        players: this.seats.map((s, i) => ({ id: s.id, position: 1, result: 'draw', score: this.scores[i % 2] })),
        summary: `Draw at ${this.scores[0]}–${this.scores[1]}`,
      };
    }
    const winTeam = this.result ?? (this.scores[0] >= this.scores[1] ? 0 : 1);
    return {
      players: this.seats.map((s, i) => ({
        id: s.id,
        position: i % 2 === winTeam ? 1 : 2,
        result: i % 2 === winTeam ? 'win' : 'loss',
        score: this.scores[i % 2],
      })),
      summary: `${this.teamName(winTeam)} win ${this.scores[winTeam]}–${this.scores[1 - winTeam]}`,
    };
  }

  teamName(team: number): string {
    return `${this.seats[team].name} & ${this.seats[team + 2].name}`;
  }

  private teamContract(team: number): number {
    return [team, team + 2].reduce((n, s) => n + (this.bids[s] ?? 0), 0);
  }

  getView(viewerId: string): SpadesView {
    const me = this.seatIndex(viewerId);
    const current = this.currentPlayerId();
    const phaseLabel =
      this.finished ? 'Game over'
      : this.pendingState === 'hand' ? 'Hand complete'
      : this.pendingState === 'trick' ? `${this.seats[this.seatIndex(this.lastWinner!)].name} takes the trick`
      : this.phase === 'bid' ? (current === viewerId ? "Bid how many tricks you'll take" : `Waiting for ${this.seats[this.turn!].name} to bid…`)
      : current === viewerId
        ? this.trick.length ? 'Follow suit if you can' : this.broken ? 'Your lead' : 'Your lead — spades not broken yet'
      : current ? `Waiting for ${this.seats[this.seatIndex(current)].name}…`
      : 'Resolving…';

    return structuredClone({
      slug: this.slug,
      viewerId,
      phase: this.phase,
      phaseLabel,
      players: this.seats.map((s, i) => {
        const bid = this.bids[i];
        return {
          id: s.id,
          name: s.name,
          avatar: s.avatar,
          isBot: s.isBot,
          team: i % 2,
          cardCount: this.hands[i].length,
          stat: bid === null ? (this.phase === 'bid' ? 'Bidding…' : '') : `${bid === 0 ? 'Nil' : `Bid ${bid}`} · Won ${this.tricksTaken[i]}`,
          badges: [...(i === this.dealer ? ['Dealer'] : []), ...(bid === 0 ? ['Nil'] : [])],
        };
      }),
      hand: sortForDisplay(this.hands[me]),
      currentPlayerId: current,
      trick: this.trick,
      leadSuit: this.trick[0]?.card.suit ?? null,
      trickWinnerId: this.pendingState === 'trick' ? this.lastWinner : null,
      trump: { suit: 'spades', hidden: false, label: 'Trumps ♠' },
      floor: null,
      scores: {
        title: 'Match',
        columns: ['Contract', 'Tricks', 'Score', 'Bags'],
        rows: [0, 1].map((t) => ({
          label: this.teamName(t),
          values: [this.teamContract(t), this.tricksTaken[t] + this.tricksTaken[t + 2], this.scores[t], this.bags[t]],
          highlight: t === me % 2,
        })),
      },
      info: [`Hand ${this.handNumber}`, `To ${this.target}`, this.broken ? 'Spades broken' : 'Spades not broken'],
      handSummary: this.pendingState === 'hand' ? this.summary : null,
      status: this.finished ? 'finished' : 'playing',
      banner: this.banner,
      dealerId: this.seats[this.dealer].id,
      bids: this.bids,
      tricksTaken: this.tricksTaken,
      teamScores: this.scores,
      teamBags: this.bags,
      spadesBroken: this.broken,
      played: this.played,
      target: this.target,
      handNumber: this.handNumber,
    } satisfies SpadesView);
  }
}
