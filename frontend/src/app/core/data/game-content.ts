export interface GameContent {
  howToPlay: string[];
  strategy: string[];
  faq: { q: string; a: string }[];
  /** Replaces the generic "Play against AI" paragraph on the game page. */
  aiNote?: string;
}
