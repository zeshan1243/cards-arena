import { GameDefinition } from '../core/table-game';
import { rummyBot } from './rummy.bot';
import { RummyEngine, RummyView } from './rummy.engine';

export const definition: GameDefinition<RummyView> = {
  slug: 'rummy',
  name: 'Rummy',
  playerCounts: [2, 3, 4],
  teams: false,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 100, label: '100 points' },
        { value: 200, label: '200 points' },
      ],
      default: 100,
      help: 'Going out scores the cards left in everyone else’s hand. The game ends after the hand in which someone reaches this score.',
    },
  ],
  rules: [
    'Two players get 10 cards each; three or four players get 7. The rest is the stock, and its top card starts the discard pile.',
    'On your turn, first draw: take the top card of the stock or of the discard pile.',
    'Then you may lay down melds: a set of 3 or 4 cards of the same rank, or a run of 3+ cards in a row in one suit. Aces are low (A-2-3, not Q-K-A).',
    'You may also lay off cards onto any meld on the table — yours or anyone else’s.',
    'End your turn by discarding one card. You can’t throw back the card you just took from the discard pile.',
    'Go out by getting rid of every card, by discarding your last one or by melding everything.',
    'The player who goes out scores the cards left in the other hands: Ace 1, 2–10 face value, J/Q/K 10.',
    'When the stock runs out, the discard pile is shuffled into a new stock. The first to the target score wins.',
  ],
  create: (seats, seed, settings) => new RummyEngine(seats, seed, settings),
  bot: rummyBot,
};
