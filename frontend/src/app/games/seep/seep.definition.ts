import { GameDefinition } from '../core/table-game';
import { seepBot } from './seep.bot';
import { SeepEngine, SeepView } from './seep.engine';

export const definition: GameDefinition<SeepView> = {
  slug: 'seep',
  name: 'Seep',
  playerCounts: [4, 2],
  teams: true,
  setupOptions: [
    {
      key: 'rounds',
      label: 'Deals',
      choices: [
        { value: 1, label: '1 deal' },
        { value: 2, label: '2 deals' },
      ],
      default: 1,
      help: 'Points from every deal are added together.',
    },
  ],
  rules: [
    'Two players, or four in partnerships — your partner sits opposite you.',
    'Values: A = 1, 2–10 face value, J = 11, Q = 12, K = 13.',
    'Points: every spade is worth its value, the other aces 1 each and the 10♦ 6 (100 in total).',
    'The bidder sees four cards and bids a house value of 9–K they hold. Four cards go face up to the floor, then everyone is dealt 12.',
    'The bidder plays first and must capture or build their bid; otherwise they throw a card of that value.',
    'Each turn play one card: capture floor cards totalling its value, build a house of 9–13 (you must hold a card to take it), add to a house, or throw it loose.',
    'Houses can only be captured with a card of exactly their value. Pakka (cemented) houses cannot be raised. You may not throw while you own a house.',
    'Clearing the floor is a Seep: +50 (not on the last play). Leftover floor cards go to the last capturer. Highest total wins.',
  ],
  create: (seats, seed, settings) => new SeepEngine(seats, seed, settings),
  bot: seepBot,
};
