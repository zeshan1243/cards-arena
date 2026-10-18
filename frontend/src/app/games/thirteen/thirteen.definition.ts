import { GameDefinition } from '../core/table-game';
import { thirteenBot } from './thirteen.bot';
import { ThirteenEngine, ThirteenView } from './thirteen.engine';

export const definition: GameDefinition<ThirteenView> = {
  slug: 'thirteen',
  name: 'Thirteen',
  playerCounts: [4, 3, 2],
  teams: false,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 5, label: '5 points' },
        { value: 10, label: '10 points' },
        { value: 15, label: '15 points' },
      ],
      default: 10,
      help: 'Each hand, 1st place scores most and last place scores 0. The game ends after the hand in which someone reaches this score.',
    },
  ],
  rules: [
    'Everyone gets 13 cards. Get rid of all your cards before the other players.',
    'Cards rank 3 (lowest) up to A, then 2 (highest). Suits break ties: ♠ < ♣ < ♦ < ♥.',
    'Whoever holds the lowest card (3♠ with four players) starts the game with it — alone or in a combination.',
    'Play a single, a pair, three of a kind, four of a kind, a run of 3+ ranks (e.g. 5-6-7) or a run of 3+ pairs (e.g. 5-5-6-6-7-7). 2s can’t be part of a run.',
    'To beat the cards on the table, play the same kind and number of cards with a higher top card — or pass. Once you pass you sit out until the next round.',
    'When everyone else passes, the last player to play clears the table and leads anything.',
    'Bombs beat 2s: four of a kind or 3 pairs in a row beat a single 2, 4 pairs in a row beat a pair of 2s, and 5 pairs in a row beat three 2s.',
    'Play continues until one player is left. With four players 1st scores 3, 2nd 2, 3rd 1 and last 0. The hand winner leads the next hand.',
  ],
  create: (seats, seed, settings) => new ThirteenEngine(seats, seed, settings),
  bot: thirteenBot,
};
