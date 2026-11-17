import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Court Piece — also called Rang — is a four-player partnership trick-taking game played with a standard 52-card deck. Partners sit opposite each other. Aces are high and twos are low.',
    'The first dealer is chosen at random. At the start of each hand the player after the dealer receives five cards and chooses the trump suit (the “rang”). The remaining cards are then dealt so everyone holds 13.',
    'The trump caller leads the first trick. Everyone must follow the suit that was led if they can. If you cannot, you may play any card, including a trump.',
    'The trick is won by the highest trump played, or by the highest card of the suit led if nobody played a trump. The winner leads the next trick.',
    'The hand stops as soon as one team has won seven tricks. That team scores 1 point — or 3 points for a Court, which means winning the first seven tricks in a row.',
    'The deal then passes one seat clockwise, so the trump caller moves round too. The first team to reach the match target (3, 5 or 7 points; 5 by default) wins.',
  ],
  strategy: [
    'As trump caller, pick the suit where you hold the most cards — length matters more than a single high card.',
    'Lead your Aces early in side suits before opponents run out of that suit and can trump them.',
    'If your partner is already winning the trick, play your lowest card instead of overtaking them.',
    'Count trumps. Once the high trumps are gone, your small trumps become winners.',
    'When you cannot follow suit and your partner is not winning, trump in with your lowest trump that still wins.',
    'Only the first seven tricks count, so there is no point saving winners for the end — cash them while they still take tricks.',
    'If the other side has won every trick so far, take a trick as soon as you can, even cheaply: it stops a Court and holds them to 1 point.',
  ],
  faq: [
    { q: 'Is Court Piece the same as Rang?', a: 'Yes. Court Piece and Rang are two names for the same game, popular in Pakistan and India. Hokm, from Iran, is a close relative.' },
    { q: 'What is a Court in Court Piece?', a: 'A Court is when one team wins the first seven tricks of a hand in a row. On CardArena it scores 3 points instead of 1.' },
    { q: 'Are all 13 tricks played?', a: 'No. The hand ends the moment one team reaches seven tricks, because the other side can no longer win it. The remaining cards are not played.' },
    { q: 'How many points do you need to win a match?', a: 'You choose 3, 5 or 7 points before the game starts; the default is 5. A normal hand win is 1 point and a Court is 3, so a single Court can decide a short match.' },
  ],
  aiNote: 'Easy bots play a random legal card about 40% of the time and sometimes call a random trump suit. Normal, Hard and Expert bots call their longest suit as trumps, count played cards to lead the highest card left in a suit, and avoid overtaking a partner who is winning; Hard and Expert only hold back when the partner’s card is sure to win the trick.',
};
