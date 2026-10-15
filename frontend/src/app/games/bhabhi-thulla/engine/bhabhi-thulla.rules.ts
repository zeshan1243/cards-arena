import { GameRules } from '../../../shared/models/game.model';

export type BhabhiVariant = 'pakistan' | 'india' | 'custom';

export interface BhabhiRules extends GameRules {
  variant: BhabhiVariant;
  /** The holder of the Ace of Spades must lead it to open the game. */
  openWithAceOfSpades: boolean;
  /**
   * When false, a player who cannot follow suit on the very first trick simply
   * discards — no one picks up. When true, a thulla is possible from trick one.
   */
  firstTrickThulla: boolean;
  /** Seconds a human has to move before auto-play kicks in. 0 disables the timer. */
  turnSeconds: number;
  scoring: { escapeOrderPoints: number[]; bhabhiPenalty: number };
  specialCards: { openingCard: string | null };
}

const BASE = {
  deckSize: 52,
  turnSeconds: 20,
};

function scoringFor(playerCount: number): BhabhiRules['scoring'] {
  // First player out earns the most; the Bhabhi is penalised.
  return {
    escapeOrderPoints: Array.from({ length: playerCount - 1 }, (_, i) => (playerCount - 1 - i) * 5),
    bhabhiPenalty: -10,
  };
}

export function createRules(variant: BhabhiVariant = 'pakistan', playerCount = 4): BhabhiRules {
  if (playerCount < 3 || playerCount > 6) {
    throw new Error('Bhabhi Thulla supports 3 to 6 players');
  }
  const common = { ...BASE, playerCount, scoring: scoringFor(playerCount) };
  switch (variant) {
    case 'pakistan':
      return {
        ...common,
        variant,
        openWithAceOfSpades: true,
        firstTrickThulla: false,
        specialCards: { openingCard: 'spades-A' },
      };
    case 'india':
      return {
        ...common,
        variant,
        openWithAceOfSpades: true,
        firstTrickThulla: true,
        specialCards: { openingCard: 'spades-A' },
      };
    case 'custom':
      return {
        ...common,
        variant,
        openWithAceOfSpades: false,
        firstTrickThulla: true,
        specialCards: { openingCard: null },
      };
  }
}

/** Human-readable rules, shown on the game page and in-game help (spec §17). */
export const VARIANT_DESCRIPTIONS: Record<BhabhiVariant, { title: string; rules: string[] }> = {
  pakistan: {
    title: 'Pakistan rules (default)',
    rules: [
      'The whole 52-card deck is dealt out as evenly as possible.',
      'Whoever holds the Ace of Spades leads it to start the first trick.',
      'First trick is a "free" round: if you have no spades you may play any card, and the whole trick is discarded.',
      'From the second trick on, playing a different suit when you cannot follow is a Thulla.',
    ],
  },
  india: {
    title: 'India rules',
    rules: [
      'The whole 52-card deck is dealt out as evenly as possible.',
      'Whoever holds the Ace of Spades leads it to start the first trick.',
      'A Thulla is allowed from the very first trick.',
    ],
  },
  custom: {
    title: 'Open start',
    rules: [
      'A random player leads the first trick with any card.',
      'A Thulla is allowed from the very first trick.',
    ],
  },
};

export const CORE_RULES: string[] = [
  'You must follow the suit that was led if you can.',
  'If every player follows suit, the trick is discarded and the player who played the highest card leads next.',
  'If someone cannot follow suit they play any other card — a Thulla. The trick stops immediately and the player who played the highest card of the led suit picks up every card in the trick, then leads next.',
  'Aces are high, twos are low.',
  'A player whose hand is empty when a trick finishes has escaped and is safe.',
  'The last player left holding cards is the Bhabhi and loses the game.',
];
