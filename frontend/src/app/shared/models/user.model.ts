export interface User {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export interface GameStatistics {
  gameSlug: string;
  gameName: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalScore: number;
  winRate: number;
  bestScore: number;
  longestWinStreak: number;
  currentWinStreak: number;
  averageDurationSeconds: number;
}

export interface UserStatistics {
  user: User;
  totals: { gamesPlayed: number; gamesWon: number; gamesLost: number; winRate: number };
  games: GameStatistics[];
  achievements: Achievement[];
}

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface GameHistoryEntry {
  sessionId: string;
  gameSlug: string;
  gameName: string;
  mode: string;
  result: string;
  score: number;
  position: number | null;
  players: { name: string; isBot: boolean; position: number | null; result: string }[];
  durationSeconds: number | null;
  finishedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  gamesWon: number;
}

export interface FinishSessionResponse {
  result: 'win' | 'safe' | 'loss';
  position: number | null;
  score: number;
  xpAwarded: number;
  newXp: number;
  level: number;
  leveledUp: boolean;
  achievementsUnlocked: Achievement[];
}
