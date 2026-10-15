import { GameDefinition } from '../core/table-game';
import { twentyNineBot } from './twenty-nine.bot';
import { TwentyNineEngine, TwentyNineView } from './twenty-nine.engine';

export const definition: GameDefinition<TwentyNineView> = {
  slug: '29',
  name: '29',
  playerCounts: [4],
  teams: true,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 3, label: '3 game points' },
        { value: 6, label: '6 game points' },
      ],
      default: 3,
      help: 'First team to reach this many game points wins; a team that falls to minus this many loses.',
    },
    {
      key: 'pair',
      label: 'Pair (K + Q of trump)',
      choices: [
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ],
      default: 'on',
      help: 'Holding the King and Queen of trump moves the bidding target by 4 points.',
    },
  ],
  rules: [
    'Four players in two teams — your partner sits opposite you. 32 cards: 7, 8, 9, 10, J, Q, K, A in each suit.',
    'Rank in every suit, high to low: J, 9, A, 10, K, Q, 8, 7.',
    'Card points: Jack 3, Nine 2, Ace 1, Ten 1, others 0 — 28 points in the deck.',
    'Everyone gets 4 cards. Bidding starts after the dealer: bid 16–28, each bid higher than the last. Passing takes you out of the bidding. If the first three players pass, the dealer must bid at least 16.',
    'The highest bidder secretly chooses trump, then everyone gets 4 more cards (8 each).',
    'The player after the dealer leads. Follow suit if you can. Until trump is revealed, no suit is trump.',
    'If you cannot follow suit you may reveal trump — then you must play a trump if you have one. Or play any card without revealing.',
    'Once revealed, trumps count for the rest of the hand, including cards already in the current trick.',
    'Pair (optional): after trump is revealed, when a team wins a trick while one of its players holds the K and Q of trump, the pair is declared. It lowers the bidder’s target by 4 if declared by the bidding team (minimum 16), or raises it by 4 if declared by the opponents (maximum 28). One pair per hand.',
    'After 8 tricks the bidding team scores +1 game point if their card points reach the target, otherwise −1.',
    'First team to the game-point target wins; a team that falls to minus the target loses. The deal passes clockwise.',
  ],
  create: (seats, seed, settings) => new TwentyNineEngine(seats, seed, settings),
  bot: twentyNineBot,
};
