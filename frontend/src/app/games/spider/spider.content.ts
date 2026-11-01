import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Spider Solitaire is a one-player patience game played with two decks — 104 cards. The goal is to build eight complete runs from King down to Ace, each in a single suit. Every finished run is cleared off the table, and the game is won when all eight are gone.',
    'The cards are dealt into ten tableau columns: six cards in each of the first four columns and five in the other six, with only the top card of each column face up. The remaining 50 cards stay in the stock, ready for five more deals.',
    'You can place any card on a card one rank higher, whatever its suit — a 7 of hearts can go on an 8 of spades. But you can only move several cards together when they form a run in one suit, such as 9-8-7 of spades. When you move the last face-up card off a column, the card below turns face up. Any card or run can be moved into an empty column.',
    'When you run out of useful moves, tap the stock to deal one new card face up onto every column. You can only deal when every column has at least one card in it, so fill any empty column first.',
    'Choose 1, 2 or 4 suits. With one suit all 104 cards are spades, which suits beginners; two suits mixes spades and hearts; four suits is the full, hardest version. On CardArena you can drag cards or tap them to move to the best spot, with unlimited undo and hints. Scoring follows the Windows standard: you start with 500, lose 1 point per move and gain 100 for every completed run.',
  ],
  strategy: [
    'Turn over face-down cards first. Moves that reveal a hidden card give you new options; moves that just shuffle face-up cards around rarely help.',
    'Build in suit whenever you can. A mixed-suit stack can only be moved one card at a time, while a same-suit run moves as a block and eventually clears itself.',
    'Empty columns are your most powerful tool. Use them to untangle mixed stacks and reorder runs, and avoid filling one with a single low card unless it reveals something.',
    'Before dealing, make every useful move you can and try to leave Kings or long same-suit runs at the bottom of columns — the deal puts a card on everything.',
    'Focus on one or two columns at a time rather than spreading low cards everywhere. Clearing a short column early gives you an empty column to work with.',
    'In 2-suit and 4-suit games, prefer placing a card on a higher card of its own suit, even if a different suit would also accept it.',
  ],
  faq: [
    { q: 'What is the difference between 1, 2 and 4 suit Spider?', a: 'The number of suits the 104 cards are spread over. One suit (all spades) is the easiest and most games can be won. Two suits is a good middle ground, and four suits is the classic hard version where only a skilled player wins regularly.' },
    { q: 'Can I deal when a column is empty?', a: 'No. In standard Spider rules every column must have at least one card before you deal a new row from the stock. Move any card or run into the empty column first.' },
    { q: 'How is Spider Solitaire scored?', a: 'CardArena uses Windows-style scoring: you start with 500 points, every move (including deals and undos) costs 1 point, and each completed King-to-Ace run adds 100 points.' },
    { q: 'Is Spider Solitaire harder than Klondike?', a: 'One-suit Spider is about as easy as Klondike Draw 1, but two-suit and especially four-suit Spider are much harder, because mixed suits block runs from moving together.' },
    { q: 'Can I play Spider Solitaire online for free?', a: 'Yes — play Spider Solitaire free in your browser on CardArena, on phone, tablet or desktop, with no download or sign-up needed.' },
  ],
};
