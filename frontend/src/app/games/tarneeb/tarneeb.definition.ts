import { GameDefinition } from '../core/table-game';
import { tarneebBot } from './tarneeb.bot';
import { TarneebEngine, TarneebView } from './tarneeb.engine';

export const definition: GameDefinition<TarneebView> = {
  slug: 'tarneeb',
  name: 'Tarneeb',
  playerCounts: [4],
  teams: true,
  setupOptions: [
    {
      key: 'target',
      label: 'Play to',
      choices: [
        { value: 21, label: '21 points' },
        { value: 31, label: '31 points' },
        { value: 41, label: '41 points' },
      ],
      default: 31,
      help: 'The first team to reach this score wins the match.',
    },
  ],
  rules: [
    'Four players in two teams — your partner sits opposite you. 52 cards, Ace high, 13 cards each.',
    'Bidding starts left of the dealer. Bid 7–13 tricks for your team; each bid must beat the last. Once you pass you are out of the auction.',
    'The auction ends when the other three players have passed after a bid. If everyone passes, the cards are redealt by the next dealer.',
    'The highest bidder names the trump suit (tarneeb) and leads the first trick.',
    'You must follow suit if you can; otherwise play any card. The highest trump wins, else the highest card of the suit led.',
    'Make your bid: your team scores the tricks it took (a made bid of 13 scores 16) and the opponents score nothing.',
    'Fail: your team loses the bid amount and the opponents score the tricks they took.',
    'The deal passes clockwise. First team to the target wins; if both teams pass it on the same hand, the higher score wins.',
  ],
  create: (seats, seed, settings) => new TarneebEngine(seats, seed, settings),
  bot: tarneebBot,
};
