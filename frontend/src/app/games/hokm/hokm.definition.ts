import { GameDefinition } from '../core/table-game';
import { hokmBot } from './hokm.bot';
import { HokmEngine, HokmView } from './hokm.engine';

export const definition: GameDefinition<HokmView> = {
  slug: 'hokm',
  name: 'Hokm',
  playerCounts: [4],
  teams: true,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 3, label: '3 points' },
        { value: 5, label: '5 points' },
        { value: 7, label: '7 points' },
      ],
      default: 5,
      help: 'The first team to reach this many points wins the match.',
    },
  ],
  rules: [
    'Four players in two teams: your partner sits opposite you. Standard 52-card deck, Ace high.',
    'The first Hakem is chosen at random. Five cards are dealt to each player, starting with the Hakem.',
    'The Hakem looks at their five cards and names the trump suit (the Hokm); then the rest of the deck is dealt so everyone holds 13.',
    'The Hakem leads the first trick. You must follow suit if you can; otherwise play any card, including a trump.',
    'The highest trump wins the trick, or the highest card of the suit led if no trump was played. The winner leads next.',
    'The hand ends as soon as a team takes 7 tricks. The winning team scores 1 point.',
    'Kot: winning 7–0 scores 2 points, or 3 points if the team swept is the Hakem’s team.',
    'If the Hakem’s team wins the hand, the same Hakem continues; otherwise the role passes to the next player clockwise.',
    'The first team to the target score wins the match.',
  ],
  create: (seats, seed, settings) => new HokmEngine(seats, seed, settings),
  bot: hokmBot,
};
