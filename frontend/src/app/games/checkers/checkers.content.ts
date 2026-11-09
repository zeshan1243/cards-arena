import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Checkers — called Draughts in Britain — is a two-player strategy game played on the 64 squares of an 8×8 board. Each player starts with 12 pieces on the dark squares of the three rows nearest them. On CardArena you play the red pieces at the bottom against the computer’s black pieces, and you move first.',
    'Pieces move diagonally forward one square onto an empty dark square. To capture, jump diagonally over an opponent’s piece that is next to you onto the empty square directly behind it; the jumped piece is removed. If, after a jump, the same piece can jump again, it must keep going — one turn can capture several pieces in a chain.',
    'Captures are compulsory: if any of your pieces can jump, you must jump. When there is more than one capture available, you may choose which one to make. On CardArena, highlighted pieces are the ones that can move, and green dots show where the selected piece can go.',
    'When a piece reaches the far row it is crowned King. Kings move and capture diagonally both forwards and backwards, which makes them far more powerful. A piece that is crowned during a jump ends its move there.',
    'You win by capturing all of the computer’s pieces or by leaving it with no legal move. If 40 moves pass on each side with no capture and no ordinary piece moved, the game is a draw. Choose Easy, Normal, Hard or Expert, and use Undo and Hint while you learn.',
  ],
  strategy: [
    'Control the centre. Pieces in the middle of the board have more options and are harder to trap than pieces on the edge.',
    'Keep your back row. Leaving the pieces on your home row in place for as long as possible stops the computer from crowning kings.',
    'Move in groups. Pieces that back each other up can’t be jumped, because there is no empty square behind them to land on.',
    'Use compulsory captures to your advantage: offer one piece so that the forced capture lands an enemy piece where you can jump two in return.',
    'Trade when you are ahead. Exchanging pieces one for one makes a material lead count for more as the board empties.',
    'Get a king early in the endgame, and use two kings together to corner a lone enemy king.',
  ],
  aiNote: 'Choose from four computer levels. Easy looks one move ahead and sometimes blunders; Normal sees short exchanges coming; Hard reads five moves deep; Expert searches eight moves ahead and always plays out capture sequences to the end.',
  faq: [
    { q: 'Do you have to jump in Checkers?', a: 'Yes. In standard American and English checkers, captures are compulsory: if you can jump an opponent’s piece, you must. If several captures are available, you can choose which one to take.' },
    { q: 'Can kings move backwards?', a: 'Yes. A king moves one square diagonally in any direction and can capture both forwards and backwards. Ordinary pieces only move and capture forwards.' },
    { q: 'Who moves first in Checkers?', a: 'In tournament checkers the dark pieces move first. On CardArena you always move first, playing red against the computer’s black pieces.' },
    { q: 'Is Checkers the same as Draughts?', a: 'Yes — Checkers is the American name and Draughts the British name for the same game on an 8×8 board. International draughts is a different variant played on a 10×10 board.' },
    { q: 'Can I play Checkers online for free?', a: 'Yes — play Checkers free in your browser on CardArena against the computer at four levels, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
