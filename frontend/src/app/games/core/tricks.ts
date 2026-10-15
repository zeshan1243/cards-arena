import { Card, RANKS, Rank, SUITS, Suit, cardId } from '../../shared/models/card.model';
import { GameAction, IllegalActionError, LegalAction, LoggedAction, SeatConfig, TrickPlay } from './table-game';
import { Rng, seededRng } from './deck';

/** Rank strength lookup: higher index wins. */
export type RankOrder = readonly Rank[];

export const STANDARD_ORDER: RankOrder = RANKS; // 2 … A

/** 32-card piquet deck (7 … A) in standard suit order. */
export function createShortDeck(ranks: readonly Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']): Card[] {
  return SUITS.flatMap((suit) => ranks.map((rank) => ({ id: cardId(suit, rank), suit, rank })));
}

/** Winner of a trick: highest trump if any trump was played, else highest of the led suit. */
export function trickWinner(plays: readonly TrickPlay[], trump: Suit | null, order: RankOrder = STANDARD_ORDER): TrickPlay {
  // `best` starts on the led suit, so an off-suit non-trump card can never take over.
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const pTrump = trump !== null && p.card.suit === trump;
    const bestTrump = trump !== null && best.card.suit === trump;
    if (pTrump && !bestTrump) best = p;
    else if (p.card.suit === best.card.suit && order.indexOf(p.card.rank) > order.indexOf(best.card.rank)) best = p;
  }
  return best;
}

/** Cards that may be played when following `leadSuit` under plain follow-suit rules. */
export function followSuit(hand: readonly Card[], leadSuit: Suit | null): Card[] {
  if (!leadSuit) return [...hand];
  const same = hand.filter((c) => c.suit === leadSuit);
  return same.length ? same : [...hand];
}

/** Seat ids starting at `startId`, wrapping around. */
export function rotateFrom<T extends { id: string }>(seats: readonly T[], startId: string): T[] {
  const i = seats.findIndex((s) => s.id === startId);
  return [...seats.slice(i), ...seats.slice(0, i)];
}

export function sortForDisplay(cards: readonly Card[], order: RankOrder = STANDARD_ORDER, suitOrder: readonly Suit[] = SUITS): Card[] {
  return [...cards].sort((a, b) => suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit) || order.indexOf(a.rank) - order.indexOf(b.rank));
}

export const playLabel = (c: Card) => `Play ${c.rank}${{ spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' }[c.suit]}`;

export const playActions = (cards: readonly Card[]): LegalAction[] =>
  cards.map((c) => ({ type: 'play', cardId: c.id, label: playLabel(c) }));

/** True when `a` and `b` describe the same decision (ignores labels). */
export function sameAction(a: GameAction, b: GameAction): boolean {
  return (
    a.type === b.type &&
    (a.cardId ?? null) === (b.cardId ?? null) &&
    (a.value ?? null) === (b.value ?? null) &&
    (a.suit ?? null) === (b.suit ?? null) &&
    JSON.stringify([...(a.cardIds ?? [])].sort()) === JSON.stringify([...(b.cardIds ?? [])].sort())
  );
}

/**
 * Convenience base class: seeded RNG, seats, action log, banner and
 * turn validation. Subclasses implement the game logic in `handle()`.
 */
export abstract class BaseTableEngine {
  readonly rng: Rng;
  protected log: LoggedAction[] = [];
  protected bannerSeq = 0;
  protected banner: { id: number; kind: 'info' | 'success' | 'danger'; text: string } | null = null;

  constructor(
    readonly seats: SeatConfig[],
    readonly seed: number,
  ) {
    this.rng = seededRng(seed);
  }

  abstract currentPlayerId(): string | null;
  abstract legalActions(playerId: string): LegalAction[];
  protected abstract handle(playerId: string, action: GameAction): void;

  /** Default validation: must be your turn and the action must be in `legalActions`. */
  apply(playerId: string, action: GameAction): void {
    if (this.currentPlayerId() !== playerId) throw new IllegalActionError('Not your turn');
    this.validate(playerId, action);
    this.log.push({ playerId, action: clean(action) });
    this.handle(playerId, action);
  }

  protected validate(playerId: string, action: GameAction): void {
    if (!this.legalActions(playerId).some((a) => sameAction(a, action))) {
      throw new IllegalActionError(`Illegal action ${action.type}`);
    }
  }

  actionLog(): LoggedAction[] {
    return structuredClone(this.log);
  }

  protected announce(kind: 'info' | 'success' | 'danger', text: string): void {
    this.banner = { id: ++this.bannerSeq, kind, text };
  }

  protected seatIndex(id: string): number {
    const i = this.seats.findIndex((s) => s.id === id);
    if (i < 0) throw new IllegalActionError(`Unknown player ${id}`);
    return i;
  }

  protected nextSeatId(id: string, step = 1): string {
    const n = this.seats.length;
    return this.seats[(((this.seatIndex(id) + step) % n) + n) % n].id;
  }
}

/** Strip UI-only fields (label) and undefined keys so logs match the backend schema. */
export function clean(action: GameAction): GameAction {
  const out: GameAction = { type: action.type };
  if (action.cardId !== undefined) out.cardId = action.cardId;
  if (action.cardIds !== undefined) out.cardIds = [...action.cardIds];
  if (action.value !== undefined) out.value = action.value;
  if (action.suit !== undefined) out.suit = action.suit;
  return out;
}

export function findCard(hand: readonly Card[], id: string): Card {
  const c = hand.find((x) => x.id === id);
  if (!c) throw new IllegalActionError('You do not hold that card');
  return c;
}

export const SUIT_NAMES: Record<Suit, string> = { spades: 'Spades', hearts: 'Hearts', clubs: 'Clubs', diamonds: 'Diamonds' };
export const SUIT_GLYPH: Record<Suit, string> = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
