import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Hearts is a classic four-player trick-taking card game played with a standard 52-card deck. There are no teams and no trumps: every player plays for themselves, Aces rank highest, and the goal is to finish with the fewest points.',
    'Each player is dealt 13 cards. Before play begins, everyone chooses three cards to pass to another player. On the first hand you pass to the left, on the second to the right, on the third across the table, and on the fourth hand nobody passes. The cycle then repeats.',
    'The player holding the 2 of Clubs leads it to start the first trick. Everyone must follow the suit that was led if they can; if you cannot, you may play any card. The highest card of the suit led wins the trick, and the winner leads the next one. On the very first trick you may not throw a heart or the Queen of Spades unless you have no other choice.',
    'Hearts cannot be led until a heart has been played on an earlier trick — this is called “breaking hearts”. The only exception is when the leader holds nothing but hearts.',
    'At the end of each hand every heart you took counts 1 point and the Queen of Spades counts 13. If one player takes all 13 hearts and the Queen of Spades, they have “shot the moon”: they score 0 and every other player scores 26. When someone reaches the target score (50 or 100 on CardArena) the game ends after that hand, and the player with the lowest total wins.',
  ],
  strategy: [
    'Pass your danger cards. The Queen of Spades is the obvious choice, but the Ace and King of Spades are also risky when you have few low spades to protect them. High hearts are good passes too.',
    'Create a void. Passing all of a short suit such as clubs or diamonds lets you discard hearts and the Queen of Spades as soon as that suit is led.',
    'Keep low spades. Four or more small spades protect you if someone tries to force out the Queen, and they let you lead spades safely to flush her out.',
    'Play the highest card that still loses. When following suit, ducking under the current winner with your highest losing card keeps your low cards for later tricks.',
    'Count the cards, especially the spades and hearts. Knowing whether the Queen of Spades is still out tells you when it is safe to play your Ace or King of Spades.',
    'Watch for moon shots. If one opponent is collecting every point, take a single heart yourself to stop them — 1 point is far cheaper than 26.',
  ],
  faq: [
    { q: 'Who leads first in Hearts?', a: 'The player holding the 2 of Clubs leads it to the first trick of every hand, after the cards have been passed.' },
    { q: 'What does “breaking hearts” mean?', a: 'Hearts cannot be led until someone has discarded a heart on a trick because they could not follow suit. Once that happens, hearts are broken and anyone may lead them. A player holding only hearts may lead one at any time.' },
    { q: 'How does shooting the moon work?', a: 'If you take all 13 hearts and the Queen of Spades in a single hand, you score 0 for that hand and each of your three opponents scores 26 points instead.' },
    { q: 'Which way do I pass cards?', a: 'Passing rotates every hand: left, then right, then across the table, then a hold hand with no passing. Passed cards are exchanged only after all four players have chosen.' },
    { q: 'Can I play Hearts online for free?', a: 'Yes — play Hearts free in your browser on CardArena against AI opponents at four difficulty levels, with no download or sign-up needed.' },
  ],
};
