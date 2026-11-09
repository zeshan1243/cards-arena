import { GameDefinition } from '../core/table-game';
import { donkeyBot } from './donkey.bot';
import { DonkeyEngine, DonkeyView } from './donkey.engine';

export const definition: GameDefinition<DonkeyView> = {
  slug: 'donkey',
  name: 'Donkey',
  playerCounts: [2, 3, 4, 5, 6],
  teams: false,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 300, label: '300 points' },
        { value: 500, label: '500 points' },
      ],
      default: 300,
      help: 'Each round is worth 400 points in total. The game ends after the round in which someone reaches this score.',
    },
  ],
  rules: [
    'Everyone gets 4 cards and 4 more are dealt face up on the table. The rest is the deck.',
    'On your turn, draw a card into your hand. Then play any card from your hand.',
    'If it has the same rank as a card on the table, take the pair onto your pile — then draw again and keep going.',
    'It can also pair with the top card of any pile. From an opponent’s pile you take every card of that rank on top (both 3s of a captured pair); a match with your own pile just adds the card to it.',
    'If the card you play matches nothing, it is thrown face up on the table and your turn ends.',
    'When the deck is empty, take turns playing your hand cards one at a time: a match captures, anything else goes on the table.',
    'Captured cards score: 2–9 are 5 points, 10 to King 10, Aces 20. Rounds continue until someone reaches the target.',
  ],
  create: (seats, seed, settings) => new DonkeyEngine(seats, seed, settings),
  bot: donkeyBot,
};
