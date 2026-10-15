import { Card, Suit, rankValue } from '../../../shared/models/card.model';
import { BotProfile, CardGameEngine, GameStatus } from '../../../shared/models/game.model';
import { Rng, createStandardDeck, dealRoundRobin, seededRng, shuffle } from '../../core/deck';
import { BhabhiRules, createRules } from './bhabhi-thulla.rules';

export interface SeatConfig {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  bot?: BotProfile;
}

export interface BhabhiPlayer extends SeatConfig {
  hand: Card[];
  /** 1-based escape position, or null while still holding cards. */
  finishPosition: number | null;
  pickups: number;
  cardsPickedUp: number;
}

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export type TrickOutcome = 'cleared' | 'thulla';

export interface TrickResult {
  trickNumber: number;
  outcome: TrickOutcome;
  plays: TrickPlay[];
  leadSuit: Suit;
  /** Player who played the highest card of the led suit. */
  highestPlayerId: string;
  thullaById: string | null;
  pickedUpById: string | null;
  escapedIds: string[];
  nextLeaderId: string | null;
}

/** Public, replayable event log. Contains no hidden information. */
export type GameEvent =
  | { type: 'deal'; handSizes: Record<string, number> }
  | { type: 'play'; trickNumber: number; playerId: string; card: Card; leadSuit: Suit; followed: boolean }
  | { type: 'trick'; result: TrickResult };

export interface BhabhiState {
  gameId: string;
  sessionId: string;
  rules: BhabhiRules;
  players: BhabhiPlayer[];
  status: GameStatus;
  currentPlayerId: string | null;
  trickNumber: number;
  trick: TrickPlay[];
  leadSuit: Suit | null;
  /** Players expected to play in the current trick, in turn order. */
  trickParticipants: string[];
  /** True once the trick is complete and waiting for `resolveTrick()`. */
  awaitingResolution: boolean;
  discardedCount: number;
  lastTrick: TrickResult | null;
  finishOrder: string[];
  bhabhiId: string | null;
  events: GameEvent[];
  seed: number;
}

/** What one seat is allowed to see (spec §55). */
export interface PlayerView extends Omit<BhabhiState, 'players'> {
  viewerId: string;
  hand: Card[];
  players: (Omit<BhabhiPlayer, 'hand'> & { cardCount: number })[];
}

export class IllegalMoveError extends Error {}

export interface EngineOptions {
  rules?: BhabhiRules;
  seed?: number;
  gameId?: string;
  sessionId?: string;
}

export class BhabhiThullaEngine implements CardGameEngine<BhabhiState> {
  private state!: BhabhiState;
  private deck: Card[] = [];
  private rng!: Rng;

  constructor(
    private readonly seats: SeatConfig[],
    private readonly options: EngineOptions = {},
  ) {
    const rules = options.rules ?? createRules('pakistan', seats.length);
    if (seats.length !== rules.playerCount) {
      throw new Error(`Rules expect ${rules.playerCount} players, got ${seats.length}`);
    }
  }

  // ---------------------------------------------------------------- lifecycle

  initializeGame(): void {
    const seed = this.options.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = seededRng(seed);
    this.state = {
      gameId: this.options.gameId ?? 'bhabhi-thulla',
      sessionId: this.options.sessionId ?? `local-${seed}`,
      rules: this.options.rules ?? createRules('pakistan', this.seats.length),
      players: this.seats.map((s) => ({ ...s, hand: [], finishPosition: null, pickups: 0, cardsPickedUp: 0 })),
      status: 'waiting',
      currentPlayerId: null,
      trickNumber: 0,
      trick: [],
      leadSuit: null,
      trickParticipants: [],
      awaitingResolution: false,
      discardedCount: 0,
      lastTrick: null,
      finishOrder: [],
      bhabhiId: null,
      events: [],
      seed,
    };
    this.createDeck();
    this.shuffleDeck();
    this.dealCards();
    this.startTrick(this.findStartingPlayer());
    this.state.status = 'playing';
  }

  createDeck(): void {
    this.deck = createStandardDeck();
  }

  shuffleDeck(): void {
    this.deck = shuffle(this.deck, this.rng);
  }

  dealCards(): void {
    const hands = dealRoundRobin(this.deck, this.state.players.length);
    this.state.players.forEach((p, i) => (p.hand = hands[i]));
    this.deck = [];
    this.state.events.push({
      type: 'deal',
      handSizes: Object.fromEntries(this.state.players.map((p) => [p.id, p.hand.length])),
    });
  }

  findStartingPlayer(): string {
    const { rules, players } = this.state;
    if (rules.openWithAceOfSpades) {
      const holder = players.find((p) => p.hand.some((c) => c.id === 'spades-A'));
      if (holder) return holder.id;
    }
    return players[Math.floor(this.rng() * players.length)].id;
  }

  // ------------------------------------------------------------------ queries

  getState(): BhabhiState {
    return structuredClone(this.state);
  }

  getPlayerView(viewerId: string): PlayerView {
    const s = this.getState();
    const viewer = s.players.find((p) => p.id === viewerId);
    if (!viewer) throw new Error(`Unknown player ${viewerId}`);
    return {
      ...s,
      viewerId,
      hand: viewer.hand,
      players: s.players.map(({ hand, ...rest }) => ({ ...rest, cardCount: hand.length })),
    };
  }

  activePlayers(): BhabhiPlayer[] {
    return this.state.players.filter((p) => p.finishPosition === null && p.hand.length > 0);
  }

  getValidMoves(playerId: string): Card[] {
    const s = this.state;
    if (s.status !== 'playing' || s.awaitingResolution || s.currentPlayerId !== playerId) return [];
    const player = this.player(playerId);
    // Opening card rule: the very first lead must be the Ace of Spades.
    if (s.trickNumber === 1 && s.trick.length === 0 && s.rules.openWithAceOfSpades) {
      const ace = player.hand.find((c) => c.id === 'spades-A');
      if (ace) return [ace];
    }
    if (!s.leadSuit) return [...player.hand];
    const following = player.hand.filter((c) => c.suit === s.leadSuit);
    return following.length ? following : [...player.hand];
  }

  isGameOver(): boolean {
    return this.state.status === 'finished';
  }

  getWinner(): string | null {
    return this.state.finishOrder[0] ?? null;
  }

  calculateScore(): Record<string, number> {
    const { escapeOrderPoints, bhabhiPenalty } = this.state.rules.scoring;
    const scores: Record<string, number> = {};
    for (const p of this.state.players) {
      const idx = this.state.finishOrder.indexOf(p.id);
      if (p.id === this.state.bhabhiId) scores[p.id] = bhabhiPenalty;
      else if (idx >= 0) scores[p.id] = escapeOrderPoints[idx] ?? 0;
      else scores[p.id] = 0;
    }
    return scores;
  }

  // ------------------------------------------------------------------ actions

  playCard(playerId: string, cardId: string): void {
    const s = this.state;
    if (s.status !== 'playing') throw new IllegalMoveError('Game is not in progress');
    if (s.awaitingResolution) throw new IllegalMoveError('Trick is being resolved');
    if (s.currentPlayerId !== playerId) throw new IllegalMoveError('Not your turn');
    const player = this.player(playerId);
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) throw new IllegalMoveError('You do not hold that card');
    if (!this.getValidMoves(playerId).some((c) => c.id === cardId)) {
      throw new IllegalMoveError('You must follow suit');
    }

    player.hand = player.hand.filter((c) => c.id !== cardId);
    if (!s.leadSuit) s.leadSuit = card.suit;
    s.trick.push({ playerId, card });
    const followed = card.suit === s.leadSuit;
    s.events.push({ type: 'play', trickNumber: s.trickNumber, playerId, card, leadSuit: s.leadSuit, followed });

    const thullaAllowed = s.trickNumber > 1 || s.rules.firstTrickThulla;
    const isThulla = !followed && thullaAllowed;
    const everyonePlayed = s.trick.length === s.trickParticipants.length;

    if (isThulla || everyonePlayed) {
      s.awaitingResolution = true;
      s.currentPlayerId = null;
    } else {
      s.currentPlayerId = s.trickParticipants[s.trick.length];
    }
  }

  /**
   * Finalise a completed trick. Kept separate from `playCard` so the UI can
   * show the full trick before it is cleared or picked up.
   */
  resolveTrick(): TrickResult {
    const s = this.state;
    if (!s.awaitingResolution || !s.leadSuit) throw new IllegalMoveError('No trick to resolve');

    const leadSuit = s.leadSuit;
    const highest = s.trick
      .filter((p) => p.card.suit === leadSuit)
      .reduce((best, p) => (rankValue(p.card.rank) > rankValue(best.card.rank) ? p : best));
    const lastPlay = s.trick[s.trick.length - 1];
    const thullaAllowed = s.trickNumber > 1 || s.rules.firstTrickThulla;
    const isThulla = thullaAllowed && lastPlay.card.suit !== leadSuit;

    let pickedUpById: string | null = null;
    if (isThulla) {
      const picker = this.player(highest.playerId);
      picker.hand.push(...s.trick.map((p) => p.card));
      picker.pickups += 1;
      picker.cardsPickedUp += s.trick.length;
      pickedUpById = picker.id;
    } else {
      s.discardedCount += s.trick.length;
    }

    const escapedIds = this.checkEscapes();
    const result: TrickResult = {
      trickNumber: s.trickNumber,
      outcome: isThulla ? 'thulla' : 'cleared',
      plays: [...s.trick],
      leadSuit,
      highestPlayerId: highest.playerId,
      thullaById: isThulla ? lastPlay.playerId : null,
      pickedUpById,
      escapedIds,
      nextLeaderId: null,
    };

    s.trick = [];
    s.leadSuit = null;
    s.awaitingResolution = false;

    if (this.checkBhabhi()) {
      s.status = 'finished';
      s.currentPlayerId = null;
    } else {
      result.nextLeaderId = this.nextLeaderAfter(highest.playerId);
      this.startTrick(result.nextLeaderId);
    }

    s.lastTrick = result;
    s.events.push({ type: 'trick', result });
    return result;
  }

  /** Move every player whose hand is now empty into the finish order (spec: removePlayer). */
  private checkEscapes(): string[] {
    const s = this.state;
    const escaped: string[] = [];
    // Resolve simultaneous escapes in the order the cards were played.
    for (const play of s.trick) {
      const p = this.player(play.playerId);
      if (p.finishPosition === null && p.hand.length === 0 && !escaped.includes(p.id)) {
        this.removePlayer(p.id);
        escaped.push(p.id);
      }
    }
    return escaped;
  }

  removePlayer(playerId: string): void {
    const p = this.player(playerId);
    this.state.finishOrder.push(p.id);
    p.finishPosition = this.state.finishOrder.length;
  }

  /** True when the game has ended: at most one player still holds cards. */
  checkBhabhi(): boolean {
    const remaining = this.activePlayers();
    if (remaining.length > 1) return false;
    this.state.bhabhiId = remaining[0]?.id ?? null;
    return true;
  }

  // ------------------------------------------------------------------ helpers

  private startTrick(leaderId: string): void {
    const s = this.state;
    s.trickNumber += 1;
    s.trick = [];
    s.leadSuit = null;
    const seatIds = s.players.map((p) => p.id);
    const start = seatIds.indexOf(leaderId);
    const order = [...seatIds.slice(start), ...seatIds.slice(0, start)];
    const activeIds = new Set(this.activePlayers().map((p) => p.id));
    s.trickParticipants = order.filter((id) => activeIds.has(id));
    s.currentPlayerId = leaderId;
  }

  /** The highest player leads next; if they escaped, the next active seat clockwise. */
  private nextLeaderAfter(playerId: string): string {
    const players = this.state.players;
    const start = players.findIndex((p) => p.id === playerId);
    for (let i = 0; i < players.length; i++) {
      const p = players[(start + i) % players.length];
      if (p.finishPosition === null && p.hand.length > 0) return p.id;
    }
    throw new Error('No active players remaining');
  }

  private player(id: string): BhabhiPlayer {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) throw new IllegalMoveError(`Unknown player ${id}`);
    return p;
  }
}
