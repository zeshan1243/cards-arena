import { Card } from './card.model';

export type GameCategory = 'regional' | 'classic' | 'popular';

/** Catalog entry for a game (mirrors the backend `games` table plus presentation data). */
export interface GameInfo {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  region: string;
  minPlayers: number;
  maxPlayers: number;
  botEnabled: boolean;
  multiplayerEnabled: boolean;
  available: boolean;
  categories: GameCategory[];
  popularity: number;
  releasedAt: string;
  accent: string;
  art: string;
  related: string[];
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type Personality = 'friendly' | 'aggressive' | 'strategic' | 'random' | 'expert';

export interface BotProfile {
  id: string;
  name: string;
  difficulty: Difficulty;
  personality: Personality;
  avatar: string;
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

/** Engine contract every card game implements (spec §15). */
export interface CardGameEngine<TState> {
  initializeGame(): void;
  createDeck(): void;
  shuffleDeck(): void;
  dealCards(): void;
  getValidMoves(playerId: string): Card[];
  playCard(playerId: string, cardId: string): void;
  isGameOver(): boolean;
  calculateScore(): Record<string, number>;
  getWinner(): string | null;
  getState(): TState;
}

export interface GameRules {
  playerCount: number;
  deckSize: number;
  scoring: object;
  specialCards: object;
}
