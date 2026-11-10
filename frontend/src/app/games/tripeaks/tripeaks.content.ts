import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Tri Peaks is a fast one-player solitaire game played with a standard 52-card deck. Twenty-eight cards are dealt into three overlapping pyramids — the peaks — and the goal is to clear every one of them.',
    'The peaks are built in four rows of 3, 6, 9 and 10 cards. Only the bottom row starts face up. A card turns face up, and becomes playable, once both cards overlapping it have been removed. The other 24 cards form the stock, with one card turned over to start the waste pile.',
    'You can move any face-up, uncovered card onto the waste if it is exactly one rank higher or lower than the waste card, whatever its suit. A 7 can take a 6 or an 8, and so on; Kings and Aces connect, so a King can go on an Ace and an Ace on a King. The card you play becomes the new waste card, so you can keep a chain going: 7, 8, 9, 8, 7…',
    'When you can’t play, tap the stock to turn its next card onto the waste. That starts a fresh chain. There is only one pass through the stock, so the game ends when it is empty and no peak card can be played — or when you clear all three peaks and win.',
    'Scoring rewards long chains: each card in a streak scores its place in the streak — 1 point for the first, 2 for the second, 3 for the third — and turning a stock card resets the streak. Clearing the top of a peak earns 15 bonus points, clearing all three another 30, and every stock card you didn’t need is worth 5 more.',
    'Turn on Endless mode to play board after board: clear all three peaks and a new deal follows, with your score carrying over. The run ends when you get stuck, so chase the most boards and the highest total.',
  ],
  strategy: [
    'Look ahead before you play. When two cards fit the waste, pick the one that lets you keep the streak going longest, not just the first one you see.',
    'Free face-down cards. Cards that uncover others are worth more than cards at the edge of the bottom row, because every new face-up card opens more options.',
    'Work all three peaks evenly. Clearing one peak completely while the other two stay buried leaves you with few playable cards later.',
    'Don’t draw too early. Make every move you can from the peaks before turning a stock card, since drawing ends your streak.',
    'Remember the wrap-around: a King and an Ace connect, so a chain like Q-K-A-2 is legal and can rescue a stuck position.',
    'Use undo to try a different branch when a chain has two possible continuations — the best line is often not obvious.',
  ],
  faq: [
    { q: 'Can a King be played on an Ace in Tri Peaks?', a: 'Yes. On CardArena ranks wrap around, so a King can go on an Ace and an Ace on a King, as in most modern versions of Tri Peaks.' },
    { q: 'Does the suit or colour matter in Tri Peaks?', a: 'No. Only the rank matters: any card one higher or one lower than the waste card can be played, whatever its suit or colour.' },
    { q: 'How is Tri Peaks scored?', a: 'Each card in a streak scores its position in the streak (1, 2, 3 …), so long chains score fast. Clearing a peak top adds 15 points, clearing all three adds 30, and each unused stock card adds 5.' },
    { q: 'Can every game of Tri Peaks be won?', a: 'No — some deals cannot be cleared whatever you do, because the stock only goes through once. Careful planning and undo help you win far more often.' },
    { q: 'Can I play Tri Peaks Solitaire online for free?', a: 'Yes — play Tri Peaks free in your browser on CardArena, on phone, tablet or desktop, with no download or sign-up needed.' },
    { q: 'Can I keep playing after clearing the peaks?', a: 'Yes. Turn on Endless mode and every cleared board deals a new one, with your score carrying over until you run out of moves.' },
  ],
};
