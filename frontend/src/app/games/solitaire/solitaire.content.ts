import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Klondike Solitaire is the classic one-player patience game played with a standard 52-card deck. The goal is to move every card onto the four foundations, building each one up by suit from Ace to King.',
    'The game starts with seven tableau columns: the first has one card, the second two, and so on up to seven, with only the top card of each column face up. The remaining 24 cards form the stock in the top-left corner.',
    'In the tableau you build down in alternating colours — a red 6 goes on a black 7, a black Queen on a red King. You can move a single face-up card or a whole run of face-up cards together. When you move the last face-up card off a column, the card underneath turns face up. Only a King, or a run starting with a King, can be moved into an empty column.',
    'Tap the stock to turn cards over onto the waste pile — one at a time in Draw 1, or three at a time in Draw 3, where only the top card of the three can be played. When the stock runs out, tap it again to turn the waste back over and go through it once more.',
    'On CardArena you can drag cards or simply tap one to send it to the best spot automatically. Undo takes back a move, Hint shows a useful move, and once every card is face up the Finish button sends them all home. Scoring follows the Windows standard: +10 for each card on a foundation, +5 for moving a card from the waste to the tableau or turning a tableau card over, and a penalty for turning the waste over.',
  ],
  strategy: [
    'Turn over face-down cards first. Uncovering the tableau gives you more options than playing from the stock, so look for moves that reveal a hidden card before drawing.',
    'Work on the tallest columns. The columns on the right hide the most face-down cards; freeing them early keeps the game from getting stuck.',
    'Don’t empty a column without a King to put there. An empty column is only useful for a King, so clear one when you have a King ready to move.',
    'Don’t rush cards to the foundations. Low cards are always safe to move up, but a 5 or 6 may still be needed in the tableau to hold a red or black 4.',
    'Think about colour when choosing a King for an empty column — pick the one whose Queen of the opposite colour is easiest to reach.',
    'Draw 3 is much harder than Draw 1: plan ahead, because only every third card of the stock is reachable on each pass.',
  ],
  faq: [
    { q: 'Is Klondike the same as Solitaire?', a: 'Yes — Klondike is the version most people simply call Solitaire, the one that came with Windows. There are many other solitaire games, such as Spider and FreeCell, but Klondike is the classic.' },
    { q: 'What is the difference between Draw 1 and Draw 3?', a: 'In Draw 1 you turn one card from the stock at a time, so every card is reachable. In Draw 3 you turn three and can only play the top one, which makes the game noticeably harder.' },
    { q: 'Can every game of Solitaire be won?', a: 'No. Most Draw 1 deals can be won with careful play, but some deals are impossible whatever you do. If you get stuck, use Undo to try a different line or start a new game.' },
    { q: 'How is Solitaire scored?', a: 'CardArena uses Windows-style scoring: 10 points for each card placed on a foundation, 5 points for moving a card from the waste to the tableau or turning over a tableau card, minus 15 for moving a card back off a foundation, and a penalty each time you turn the waste back over.' },
    { q: 'Can I play Solitaire online for free?', a: 'Yes — play Klondike Solitaire free in your browser on CardArena, on phone, tablet or desktop, with no download or sign-up needed.' },
  ],
};
