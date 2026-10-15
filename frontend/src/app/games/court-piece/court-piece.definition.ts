import { GameDefinition } from '../core/table-game';
import { courtPieceBot } from './court-piece.bot';
import { CourtPieceEngine, CourtPieceView } from './court-piece.engine';

export const definition: GameDefinition<CourtPieceView> = {
  slug: 'court-piece',
  name: 'Court Piece',
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
    },
  ],
  rules: [
    'Four players in two teams — your partner sits opposite you.',
    'The player after the dealer sees five cards and chooses trumps, then everyone gets 13 cards.',
    'The trump caller leads. You must follow suit if you can; otherwise play any card, including a trump.',
    'The highest trump wins the trick, or the highest card of the suit led if no trump was played.',
    'First team to seven tricks wins the hand and scores 1 point.',
    'Winning the first seven tricks in a row is a Court and scores 3 points.',
    'The deal passes clockwise. First team to the target wins the match.',
  ],
  create: (seats, seed, settings) => new CourtPieceEngine(seats, seed, settings),
  bot: courtPieceBot,
};
