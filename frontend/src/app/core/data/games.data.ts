import { GameInfo } from '../../shared/models/game.model';
import { GameContent } from './game-content';
import { content as courtPiece } from '../../games/court-piece/court-piece.content';
import { content as c_hokm } from '../../games/hokm/hokm.content';
import { content as c_twenty_nine } from '../../games/twenty-nine/twenty-nine.content';
import { content as c_seep } from '../../games/seep/seep.content';
import { content as c_call_break } from '../../games/call-break/call-break.content';
import { content as c_tarneeb } from '../../games/tarneeb/tarneeb.content';
import { content as c_baloot } from '../../games/baloot/baloot.content';
import { content as c_spades } from '../../games/spades/spades.content';
import { content as c_hearts } from '../../games/hearts/hearts.content';
import { content as c_thirteen } from '../../games/thirteen/thirteen.content';
import { content as c_solitaire } from '../../games/solitaire/solitaire.content';

export type { GameContent };

export const GAMES: GameInfo[] = [
  {
    slug: 'bhabhi-thulla',
    name: 'Bhabhi Thulla',
    tagline: 'Shed your cards. Dodge the Thulla. Don’t be the Bhabhi.',
    description:
      'The classic South Asian shedding game. Follow suit, empty your hand and make sure you are not the last player left holding cards.',
    region: 'Pakistan & India',
    minPlayers: 3,
    maxPlayers: 6,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional', 'popular'],
    popularity: 98,
    releasedAt: '2026-10-01',
    accent: '#6C5CE7',
    art: '♠♥♣♦',
    related: ['court-piece', '29', 'seep', 'call-break'],
  },
  {
    slug: 'court-piece',
    name: 'Court Piece',
    tagline: 'Pick trumps, win seven tricks, go for the Court.',
    description:
      'Also known as Rang. A fast four-player partnership trick-taking game where one player chooses trumps after seeing five cards.',
    region: 'Pakistan & India',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional', 'popular'],
    popularity: 92,
    releasedAt: '2026-12-01',
    accent: '#00D4FF',
    art: '♥♠♥',
    related: ['bhabhi-thulla', '29', 'call-break', 'hokm'],
  },
  {
    slug: '29',
    name: '29',
    tagline: 'Bid high, count points, call trumps.',
    description:
      'A point-trick game played with a 32-card deck where Jacks and Nines rule. Bid for the right to choose trumps and collect enough card points to make your bid.',
    region: 'South Asia',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional'],
    popularity: 85,
    releasedAt: '2027-01-15',
    accent: '#F59E0B',
    art: '♣♦♣',
    related: ['court-piece', 'bhabhi-thulla', 'call-break'],
  },
  {
    slug: 'seep',
    name: 'Seep',
    tagline: 'Build houses, sweep the floor.',
    description:
      'A fishing game for four players in partnerships. Capture cards from the floor by matching or summing values, build houses and score sweeps.',
    region: 'North India & Pakistan',
    minPlayers: 2,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional'],
    popularity: 70,
    releasedAt: '2027-02-01',
    accent: '#22C55E',
    art: '♦♠♦',
    related: ['bhabhi-thulla', 'court-piece', '29'],
  },
  {
    slug: 'call-break',
    name: 'Call Break',
    tagline: 'Call your tricks. Spades always win.',
    description:
      'A four-player trick-taking game from Nepal and India. Spades are always trumps; call how many tricks you will take and hit your number.',
    region: 'Nepal & India',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional', 'popular'],
    popularity: 88,
    releasedAt: '2027-03-01',
    accent: '#EF4444',
    art: '♠♠♠',
    related: ['court-piece', 'spades', 'bhabhi-thulla'],
  },
  {
    slug: 'hokm',
    name: 'Hokm',
    tagline: 'The Persian partnership classic.',
    description: 'The Hakem chooses trumps and the first team to seven tricks wins the hand.',
    region: 'Iran',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional'],
    popularity: 60,
    releasedAt: '2027-05-01',
    accent: '#14B8A6',
    art: '♦♥♦',
    related: ['court-piece', 'tarneeb', 'baloot'],
  },
  {
    slug: 'tarneeb',
    name: 'Tarneeb',
    tagline: 'Bid, name trumps, take the tricks.',
    description: 'A popular Levantine bidding and trick-taking game for two partnerships.',
    region: 'Middle East',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional'],
    popularity: 58,
    releasedAt: '2027-05-15',
    accent: '#EC4899',
    art: '♣♥♣',
    related: ['hokm', 'baloot', 'spades'],
  },
  {
    slug: 'baloot',
    name: 'Baloot',
    tagline: 'Saudi Arabia’s favourite card game.',
    description: 'A 32-card partnership game with Sun and Hokm contracts and melds.',
    region: 'Gulf',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['regional'],
    popularity: 55,
    releasedAt: '2027-06-01',
    accent: '#A855F7',
    art: '♥♣♥',
    related: ['tarneeb', 'hokm', '29'],
  },
  {
    slug: 'spades',
    name: 'Spades',
    tagline: 'Bid, partner up and break spades.',
    description: 'The American partnership classic where spades are always trumps.',
    region: 'Worldwide',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['classic', 'popular'],
    popularity: 80,
    releasedAt: '2027-06-15',
    accent: '#3B82F6',
    art: '♠♣♠',
    related: ['call-break', 'hearts', 'tarneeb'],
  },
  {
    slug: 'hearts',
    name: 'Hearts',
    tagline: 'Avoid the hearts. Dodge the Queen.',
    description: 'Pass three cards, avoid taking hearts and the Queen of Spades — or shoot the moon.',
    region: 'Worldwide',
    minPlayers: 4,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['classic', 'popular'],
    popularity: 78,
    releasedAt: '2027-07-01',
    accent: '#F43F5E',
    art: '♥♥♥',
    related: ['spades', 'bhabhi-thulla', 'call-break'],
  },
  {
    slug: 'thirteen',
    name: 'Thirteen',
    tagline: 'Shed your cards. Beat the table. 2s rule.',
    description: 'Tiến Lên, the Vietnamese climbing game: beat singles, pairs and runs, bomb the 2s, and be first to empty your hand.',
    region: 'Vietnam',
    minPlayers: 2,
    maxPlayers: 4,
    botEnabled: true,
    multiplayerEnabled: false,
    available: true,
    categories: ['classic', 'popular'],
    popularity: 80,
    releasedAt: '2026-10-18',
    accent: '#22C55E',
    art: '♥♦♠',
    related: ['bhabhi-thulla', 'hearts', 'spades'],
  },
  {
    slug: 'solitaire',
    name: 'Solitaire',
    tagline: 'The classic Klondike patience game.',
    description: 'Build four foundations from Ace to King. Draw 1 or Draw 3, drag or tap to move, with undo, hints and auto-finish.',
    region: 'Worldwide',
    minPlayers: 1,
    maxPlayers: 1,
    botEnabled: false,
    multiplayerEnabled: false,
    available: true,
    categories: ['classic', 'popular'],
    popularity: 90,
    releasedAt: '2026-10-19',
    accent: '#0EA5E9',
    art: '♠♦♣',
    related: ['thirteen', 'hearts', 'bhabhi-thulla'],
  },
];

export const GAME_CONTENT: Record<string, GameContent> = {
  'bhabhi-thulla': {
    howToPlay: [
      'Bhabhi Thulla is played with a standard 52-card deck and three to six players. All cards are dealt out.',
      'The player holding the Ace of Spades leads it to begin the first trick. Play continues clockwise and everyone must follow the suit that was led if they can.',
      'If every player follows suit, the trick is discarded and the player who played the highest card leads the next trick.',
      'If a player cannot follow suit, they play any other card. This is a Thulla: the trick stops immediately and the player who played the highest card of the led suit must pick up every card from the trick and add them to their hand.',
      'Players who run out of cards escape and are safe. The last player still holding cards becomes the Bhabhi and loses.',
    ],
    strategy: [
      'Lead low cards. If you lead a low card, someone else will usually play higher and take on the risk of a Thulla.',
      'When following, play the highest card that is still lower than the current winner — you shed a big card without becoming the target.',
      'If you are the last to play in a trick, the trick will be discarded no matter what — dump your highest card of that suit.',
      'Keep track of who has thulla’d which suit. Those players are void in that suit, so leading it is dangerous.',
      'Run your short suits out early. Being void in a suit gives you the power to Thulla later.',
      'Remember what players pick up. Those cards are back in their hand and will come out again.',
    ],
    faq: [
      {
        q: 'What does “Thulla” mean?',
        a: 'Thulla is the move of playing a different suit because you cannot follow the suit that was led. It ends the trick and forces the highest player of the led suit to pick up all the cards.',
      },
      {
        q: 'Who is the Bhabhi?',
        a: 'The Bhabhi is the last player left holding cards when everyone else has escaped. That player loses the game.',
      },
      {
        q: 'Can I play Bhabhi Thulla online for free?',
        a: 'Yes. You can play Bhabhi Thulla free in your browser against AI opponents with no download and no account required.',
      },
      {
        q: 'How many players can play Bhabhi Thulla?',
        a: 'Bhabhi Thulla works best with four players, but CardArena supports tables of three to six.',
      },
      {
        q: 'Is there a Thulla on the first trick?',
        a: 'Under the default Pakistan rules the first trick is a free round: if you cannot follow spades you discard and nobody picks up. The India rules allow a Thulla from the very first trick. You can choose either before you start.',
      },
    ],
  },
};

GAME_CONTENT['court-piece'] = courtPiece;
GAME_CONTENT['hokm'] = c_hokm;
GAME_CONTENT['29'] = c_twenty_nine;
GAME_CONTENT['seep'] = c_seep;
GAME_CONTENT['call-break'] = c_call_break;
GAME_CONTENT['tarneeb'] = c_tarneeb;
GAME_CONTENT['baloot'] = c_baloot;
GAME_CONTENT['spades'] = c_spades;
GAME_CONTENT['hearts'] = c_hearts;
GAME_CONTENT['thirteen'] = c_thirteen;
GAME_CONTENT['solitaire'] = c_solitaire;

export function findGame(slug: string): GameInfo | undefined {
  return GAMES.find((g) => g.slug === slug);
}
