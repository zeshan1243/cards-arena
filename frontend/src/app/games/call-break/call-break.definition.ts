import { GameDefinition } from '../core/table-game';
import { callBreakBot } from './call-break.bot';
import { CallBreakEngine, CallBreakView } from './call-break.engine';

export const definition: GameDefinition<CallBreakView> = {
  slug: 'call-break',
  name: 'Call Break',
  playerCounts: [4],
  teams: false,
  setupOptions: [
    {
      key: 'rounds',
      label: 'Rounds',
      choices: [
        { value: 3, label: '3 rounds' },
        { value: 5, label: '5 rounds' },
      ],
      default: 3,
      help: 'Highest total after the last round wins.',
    },
  ],
  rules: [
    'Four players, each playing for themselves, with a 52-card deck. Aces are high and spades are always trump.',
    'Everyone gets 13 cards. Starting left of the dealer, each player calls how many tricks (1–8) they expect to win.',
    'The player left of the dealer leads first. You must follow suit, and you must beat the highest card of the led suit if you can (unless a spade has already been played).',
    'If you have none of the led suit you must play a spade, beating any spade already played if you can. With no spades either, play any card.',
    'The highest spade wins the trick, otherwise the highest card of the led suit. The winner leads next.',
    'Make your call and score it (Call 4 → +4), plus 0.1 for each extra trick. Miss it and lose your call (−4).',
    'The deal passes clockwise each round. After 3 or 5 rounds the highest total wins.',
  ],
  create: (seats, seed, settings) => new CallBreakEngine(seats, seed, settings),
  bot: callBreakBot,
};
