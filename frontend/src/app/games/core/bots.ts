import { BotProfile, Difficulty } from '../../shared/models/game.model';

export const BOT_ROSTER: BotProfile[] = [
  { id: 'bot-ayesha', name: 'Ayesha', difficulty: 'normal', personality: 'friendly', avatar: '🦊' },
  { id: 'bot-bilal', name: 'Bilal', difficulty: 'normal', personality: 'aggressive', avatar: '🐯' },
  { id: 'bot-sana', name: 'Sana', difficulty: 'normal', personality: 'strategic', avatar: '🦉' },
  { id: 'bot-raza', name: 'Raza', difficulty: 'normal', personality: 'strategic', avatar: '🐺' },
  { id: 'bot-hina', name: 'Hina', difficulty: 'normal', personality: 'friendly', avatar: '🐼' },
  { id: 'bot-omar', name: 'Omar', difficulty: 'normal', personality: 'aggressive', avatar: '🦁' },
];

export function botsFor(count: number, difficulty: Difficulty): BotProfile[] {
  return BOT_ROSTER.slice(0, count).map((b) => ({
    ...b,
    difficulty,
    personality: difficulty === 'expert' ? 'expert' : b.personality,
  }));
}
