import { GameDefinition } from '../core/table-game';
import { spadesBot } from './spades.bot';
import { SpadesEngine, SpadesView } from './spades.engine';

export const definition: GameDefinition<SpadesView> = {
  slug: 'spades',
  name: 'Spades',
  playerCounts: [4],
  teams: true,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 200, label: '200 points' },
        { value: 300, label: '300 points' },
        { value: 500, label: '500 points' },
      ],
      default: 300,
    },
  ],
  rules: [
    'Four players in two teams — your partner sits opposite you. Each player gets 13 cards; Ace is high and spades are always trumps.',
    'Starting left of the dealer, everyone bids how many tricks they expect to win (0–13). A bid of 0 is Nil. Your team contract is the sum of both non-nil bids.',
    'The player left of the dealer leads. Follow suit if you can; otherwise play any card. The highest spade wins the trick, or the highest card of the suit led.',
    'Spades cannot be led until a spade has been played on an earlier trick — unless you hold only spades.',
    'Make your contract: +10 per trick bid and +1 per extra trick (a “bag”). Fall short: −10 per trick bid.',
    'Nil: +100 if the nil bidder takes no tricks, −100 if they take any. Their tricks still count toward the team contract.',
    'Every 10 bags costs 100 points. The match ends when a team reaches the target or drops to −200; the higher score wins (ties play another hand).',
  ],
  create: (seats, seed, settings) => new SpadesEngine(seats, seed, settings),
  bot: spadesBot,
};
