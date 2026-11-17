import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Klondike Solitaire is the classic one-player patience game played with a standard 52-card deck. The goal is to move every card onto the four foundations, building each one up by suit from Ace to King.',
    'The game starts with seven tableau columns: the first has one card, the second two, and so on up to seven, with only the top card of each column face up. The remaining 24 cards form the stock in the top-left corner.',
    'In the tableau you build down in alternating colours — a red 6 goes on a black 7, a black Queen on a red King. You can move a single face-up card or a whole run of face-up cards together. When you move the last face-up card off a column, the card underneath turns face up. Only a King, or a run starting with a King, can be moved into an empty column.',
    'Tap the stock to turn cards over onto the waste pile — one at a time in Draw 1, or three at a time in Draw 3, where only the top card of the three can be played. When the stock runs out, tap it again to turn the waste back over and start another pass. There is no limit on passes, but each one costs points.',
    'On CardArena you can drag cards or simply tap one to send it to the best spot automatically — a foundation if it can go there, otherwise a tableau column. Undo takes back a move and Hint shows a useful one. Once the stock and waste are empty and every tableau card is face up, the Finish button sends the rest home.',
    'Scoring follows the Windows standard: +10 for each card moved to a foundation, +5 for moving a card from the waste to the tableau or turning a tableau card over, and −15 for moving a card back off a foundation. Turning the waste back over costs 100 points in Draw 1 and 20 in Draw 3. The score never drops below 0.',
  ],
  strategy: [
    'Turn over face-down cards first. Uncovering the tableau gives you more options than playing from the stock, so look for moves that reveal a hidden card before drawing.',
    'Work on the tallest columns. The columns on the right hide the most face-down cards; freeing them early keeps the game from getting stuck.',
    'Don’t empty a column without a King to put there. An empty column is only useful for a King, so clear one when you have a King ready to move.',
    'Don’t rush cards to the foundations. Low cards are always safe to move up, but a 5 or 6 may still be needed in the tableau to hold a red or black 4.',
    'Think about colour when choosing a King for an empty column — pick the one whose Queen of the opposite colour is easiest to reach.',
    'Draw 3 is much harder than Draw 1: plan ahead, because only every third card of the stock is reachable on each pass.',
  ],
  aiNote: 'The game screen shows your score, moves and time. Choose Draw 1 or Draw 3: switching before your first move deals a new game straight away, otherwise the change applies from your next game. Undo costs no points but counts as a move, Hint points out a useful move or tells you to draw, and your games won, best score and best time are saved on your device.',
  faq: [
    { q: 'Is Klondike the same as Solitaire?', a: 'Yes — Klondike is the version most people simply call Solitaire, the one that came with Windows. There are many other solitaire games, such as Spider and FreeCell, but Klondike is the classic.' },
    { q: 'What is the difference between Draw 1 and Draw 3?', a: 'In Draw 1 you turn one card from the stock at a time, so every card is reachable. In Draw 3 you turn three and can only play the top one, which makes the game noticeably harder.' },
    { q: 'How many times can I go through the stock?', a: 'As many times as you like. When the stock is empty, tap it to turn the waste back over. Each pass costs 100 points in Draw 1 and 20 points in Draw 3, though your score never goes below 0.' },
    { q: 'Can every game of Solitaire be won?', a: 'No. Most Draw 1 deals can be won with careful play, but some deals are impossible whatever you do. If you get stuck, use Undo to try a different line or start a new game.' },
    { q: 'How is Solitaire scored?', a: 'CardArena uses Windows-style scoring: 10 points for each card moved to a foundation, from the waste or the tableau; 5 points for moving a card from the waste to the tableau or turning over a tableau card; minus 15 for moving a card back off a foundation; and minus 100 (Draw 1) or minus 20 (Draw 3) each time you turn the waste back over. The score never drops below 0.' },
  ],
};
