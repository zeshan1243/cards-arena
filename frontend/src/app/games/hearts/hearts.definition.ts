import { GameDefinition } from '../core/table-game';
import { heartsBot } from './hearts.bot';
import { HeartsEngine, HeartsView } from './hearts.engine';

export const definition: GameDefinition<HeartsView> = {
  slug: 'hearts',
  name: 'Hearts',
  playerCounts: [4],
  teams: false,
  setupOptions: [
    {
      key: 'target',
      label: 'Game ends at',
      choices: [
        { value: 50, label: '50 points' },
        { value: 100, label: '100 points' },
      ],
      default: 50,
      help: 'The game ends after the hand in which someone reaches this score. Lowest total wins.',
    },
  ],
  rules: [
    'Four players, every player for themselves. Each gets 13 cards; Aces are high and there are no trumps.',
    'Before each hand pass 3 cards: left, then right, then across, then no pass — and repeat.',
    'The player holding the 2♣ leads it to the first trick. Follow suit if you can; otherwise play any card.',
    'On the first trick you may not play a heart or the Q♠ unless you have nothing else.',
    'Hearts cannot be led until a heart has been played, unless you hold only hearts.',
    'Each heart you take is 1 point and the Q♠ is 13 points. Points are bad!',
    'Shoot the moon — take all 13 hearts and the Q♠ — and you score 0 while everyone else scores 26.',
    'When someone reaches the target score the game ends. The lowest total wins.',
  ],
  create: (seats, seed, settings) => new HeartsEngine(seats, seed, settings),
  bot: heartsBot,
};
