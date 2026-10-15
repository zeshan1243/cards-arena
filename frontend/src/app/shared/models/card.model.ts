export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}

export function cardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function cardLabel(card: Card): string {
  const names: Partial<Record<Rank, string>> = { J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
  return `${names[card.rank] ?? card.rank} of ${card.suit}`;
}

/** Sort for display: grouped by suit, ascending rank within suit. */
export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort(
    (a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || rankValue(a.rank) - rankValue(b.rank),
  );
}
