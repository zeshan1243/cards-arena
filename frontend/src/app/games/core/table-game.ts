import { Card, Suit } from '../../shared/models/card.model';
import { BotProfile } from '../../shared/models/game.model';
import { Rng } from './deck';

/**
 * Shared contract for every table game except Bhabhi Thulla (which predates it).
 *
 * Determinism rules — the backend replays games with a Python port, so:
 *  - all randomness comes from the engine's seeded `rng` (in the same order as the Python port);
 *  - game logic uses integers only (no floating-point scores, no Math.round);
 *  - logic never depends on the order of equal elements after a sort.
 */

// ------------------------------------------------------------------ actions

export type ActionType = 'play' | 'bid' | 'pass' | 'trump' | 'pass-cards' | 'reveal-trump' | 'choose';

/** A player decision. Serialised as-is to the backend for replay. */
export interface GameAction {
  type: ActionType;
  cardId?: string;
  cardIds?: string[];
  value?: number | string;
  suit?: Suit;
}

/** A concrete legal action with a human-readable label for buttons. */
export interface LegalAction extends GameAction {
  label: string;
}

/** Multi-card selection phase (e.g. Hearts passing). */
export interface CardSelection {
  count: number;
  label: string;
  /** Action type submitted with the chosen `cardIds`. */
  actionType: ActionType;
}

export interface LoggedAction {
  playerId: string;
  action: GameAction;
}

export class IllegalActionError extends Error {}

// --------------------------------------------------------------------- view

export interface SeatConfig {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
}

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface SeatView {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  /** Team index (0 or 1) in partnership games, otherwise null. */
  team: number | null;
  cardCount: number;
  /** Primary line under the name, e.g. "3 tricks" or "Bid 4 · 2 won". */
  stat: string;
  /** Small labels, e.g. "Dealer", "Hakem", "Bidder". */
  badges: string[];
}

export interface FloorPile {
  id: string;
  cards: Card[];
  /** e.g. "House of 11" or null for a loose card. */
  label: string | null;
  owner?: string | null;
}

export interface ScoreTable {
  title: string;
  columns: string[];
  rows: { label: string; values: (string | number)[]; highlight?: boolean }[];
}

export interface Banner {
  id: number;
  kind: 'info' | 'success' | 'danger';
  text: string;
}

export interface TableView {
  slug: string;
  viewerId: string;
  /** Machine phase (game specific), and the text shown in the status bar. */
  phase: string;
  phaseLabel: string;
  players: SeatView[];
  /** Viewer's hand, already sorted for display. */
  hand: Card[];
  currentPlayerId: string | null;
  /** Cards on the table for the current (or just-completed) trick. */
  trick: TrickPlay[];
  leadSuit: Suit | null;
  /** Set while a completed trick is waiting to be resolved. */
  trickWinnerId: string | null;
  /** null when the game has no trump concept. */
  trump: { suit: Suit | null; hidden: boolean; label: string } | null;
  /** Seep-style floor instead of a trick. */
  floor: FloorPile[] | null;
  scores: ScoreTable;
  /** Small chips in the top bar, e.g. "Hand 2", "To 7". */
  info: string[];
  /** Shown between hands while `pending() === 'hand'`. */
  handSummary: { title: string; lines: string[] } | null;
  status: 'playing' | 'finished';
  banner: Banner | null;
}

// ------------------------------------------------------------------ outcome

export type SeatResult = 'win' | 'loss' | 'draw' | 'safe';

export interface GameOutcome {
  /** One entry per seat, in seat order. Position 1 is best; partners share a position. */
  players: { id: string; position: number; result: SeatResult; score: number }[];
  summary: string;
}

// ------------------------------------------------------------------- engine

export interface TableGameEngine<TView extends TableView = TableView> {
  readonly slug: string;
  readonly seed: number;
  initializeGame(): void;
  getView(viewerId: string): TView;
  legalActions(playerId: string): LegalAction[];
  cardSelection(playerId: string): CardSelection | null;
  /** Validates and applies an action. Throws IllegalActionError. */
  apply(playerId: string, action: GameAction): void;
  /** Something finished and is waiting for `resolve()` so the UI can show it. */
  pending(): 'trick' | 'hand' | null;
  resolve(): void;
  currentPlayerId(): string | null;
  isGameOver(): boolean;
  outcome(): GameOutcome;
  actionLog(): LoggedAction[];
}

// --------------------------------------------------------------- definition

export interface SetupOption {
  key: string;
  label: string;
  choices: { value: number | string; label: string }[];
  default: number | string;
  help?: string;
}

export type GameSettings = Record<string, number | string>;

export type BotFn<TView extends TableView = TableView> = (
  view: TView,
  legal: LegalAction[],
  selection: CardSelection | null,
  profile: Pick<BotProfile, 'difficulty' | 'personality'>,
  rng: Rng,
) => GameAction;

export interface GameDefinition<TView extends TableView = TableView> {
  slug: string;
  name: string;
  /** Allowed table sizes; the first is the default. */
  playerCounts: number[];
  teams: boolean;
  setupOptions: SetupOption[];
  /** Short rules for the in-game rules dialog. */
  rules: string[];
  create(seats: SeatConfig[], seed: number, settings: GameSettings): TableGameEngine<TView>;
  bot: BotFn<TView>;
}
