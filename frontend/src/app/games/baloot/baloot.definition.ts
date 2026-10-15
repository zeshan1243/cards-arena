import { GameDefinition } from '../core/table-game';
import { balootBot } from './baloot.bot';
import { BalootEngine, BalootView } from './baloot.engine';

export const definition: GameDefinition<BalootView> = {
  slug: 'baloot',
  name: 'Baloot',
  playerCounts: [4],
  teams: true,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 52, label: '52 points' },
        { value: 101, label: '101 points' },
        { value: 152, label: '152 points' },
      ],
      default: 101,
      help: 'The first team to reach the target wins the match.',
    },
  ],
  rules: [
    'Four players in two teams — your partner sits opposite you. 32 cards (7 to Ace).',
    'Everyone gets 5 cards and one card is turned face up: the buyer card.',
    'Bidding round 1: choose Sun (no trumps), Hokm (the buyer card’s suit is trumps) or pass. A later Sun overtakes a Hokm.',
    'If all pass, round 2: Sun, Hokm in any other suit, or pass. If all pass again, the cards are redealt.',
    'The buyer takes the face-up card plus 2 more; everyone else takes 3 (8 cards each). The player after the dealer leads.',
    'Follow suit if you can. In Hokm, if you can’t, you must trump (unless your partner is winning) and must beat any trump already played if you can.',
    'Plain rank: A 10 K Q J 9 8 7. Trump rank: J 9 A 10 K Q 8 7.',
    'Points: A 11, 10 10, K 4, Q 3, J 2 (trump J 20, trump 9 14). Last trick +10.',
    'A hand is worth 26 game points in Sun and 16 in Hokm. If the buying team gets half or less, the opponents take all of it.',
    'Baloot: holding and playing the K and Q of trumps scores +2. First team to the target wins.',
  ],
  create: (seats, seed, settings) => new BalootEngine(seats, seed, settings),
  bot: balootBot,
};
