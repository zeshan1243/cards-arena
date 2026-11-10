import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Pyramid Solitaire is a one-player card game played with a standard 52-card deck. Twenty-eight cards are dealt face up in a pyramid of seven rows, each row overlapping the one above it. The other 24 cards form the stock. Your goal is to remove every card from the pyramid.',
    'Cards are removed in pairs that add up to 13. Aces count 1, number cards their face value, Jacks 11 and Queens 12 — so a 6 pairs with a 7, a 4 with a 9, an Ace with a Queen and a 2 with a Jack. Kings count 13 and are removed on their own.',
    'You can only use cards that are uncovered: a card in the pyramid is free once both cards overlapping it from the row below are gone. One exception: a card may pair with the single card still covering it, such as a 4 sitting under a 9.',
    'When you run out of pairs, tap the stock to turn its top card onto the waste pile. The top card of the waste can pair with a free pyramid card. When the stock is empty you can turn the waste back over and go through it again: three passes by default, or choose one pass or unlimited passes.',
    'Each pair or King removed scores 5 points, each pyramid row cleared adds 25, and clearing the whole pyramid adds 250 plus 10 for every card left in the stock and waste. Use Undo to take back a move and Hint when you’re stuck.',
  ],
  strategy: [
    'Clear the bottom row evenly. Every card you uncover high in the pyramid needs both cards below it gone, so work across the row instead of digging down one side.',
    'Don’t rush to use the waste card. If a free pyramid card can pair with another pyramid card, that pair is usually better — the waste card will come round again on the next pass.',
    'Watch for cards that block their own partners. If a 5 sits on top of the only free 8, pair them together using the cover rule.',
    'Count the passes. With three passes, note which stock cards you’ll need and when they come up, and save pairs that need them for the right pass.',
    'Kings are free points: remove them as soon as they are uncovered.',
  ],
  faq: [
    { q: 'What adds up to 13 in Pyramid Solitaire?', a: 'Ace + Queen, 2 + Jack, 3 + 10, 4 + 9, 5 + 8 and 6 + 7. Kings are worth 13 on their own and are removed singly.' },
    { q: 'How many times can I go through the deck?', a: 'Three passes by default on CardArena. You can also choose a single pass for a harder game or unlimited passes for a relaxed one.' },
    { q: 'Can I pair a card with the card covering it?', a: 'Yes. If a card is covered by just one remaining card and the two add up to 13, you can remove them together.' },
    { q: 'Is every game of Pyramid Solitaire winnable?', a: 'No. Many deals can’t be cleared, especially with a single pass. With three passes and careful play you can win a good share of games.' },
    { q: 'Can I play Pyramid Solitaire online for free?', a: 'Yes — play free in your browser on CardArena, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
