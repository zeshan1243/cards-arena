import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Court Piece — also called Rang — is a four-player partnership trick-taking game played with a standard 52-card deck. Partners sit opposite each other.',
    'At the start of each hand the player after the dealer receives five cards and chooses the trump suit (the “rang”). The remaining cards are then dealt so everyone holds 13.',
    'The trump caller leads the first trick. Everyone must follow the suit that was led if they can. If you cannot, you may play any card, including a trump.',
    'The trick is won by the highest trump played, or by the highest card of the suit led if nobody played a trump. The winner leads the next trick.',
    'The first team to win seven tricks wins the hand. If a team wins the first seven tricks in a row, that is a Court — a big bonus.',
  ],
  strategy: [
    'As trump caller, pick the suit where you hold the most cards — length matters more than a single high card.',
    'Lead your Aces early in side suits before opponents run out of that suit and can trump them.',
    'If your partner is already winning the trick, play your lowest card instead of overtaking them.',
    'Count trumps. Once the high trumps are gone, your small trumps become winners.',
    'When you cannot follow suit and your partner is not winning, trump in with your lowest trump that still wins.',
  ],
  faq: [
    { q: 'Is Court Piece the same as Rang?', a: 'Yes. Court Piece and Rang are two names for the same game, popular in Pakistan and India. Hokm, from Iran, is a close relative.' },
    { q: 'What is a Court in Court Piece?', a: 'A Court is when one team wins the first seven tricks of a hand in a row. On CardArena it scores 3 points instead of 1.' },
    { q: 'How are trumps chosen?', a: 'The player after the dealer looks at their first five cards and chooses trumps before the rest of the deck is dealt.' },
    { q: 'Can I play Court Piece online for free?', a: 'Yes — play free in your browser against AI partners and opponents, with no download or account needed.' },
  ],
};
