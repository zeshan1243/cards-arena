import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Tarneeb is a four-player partnership trick-taking game hugely popular across the Levant — in Lebanon, Syria, Jordan and Palestine — and among Arab communities worldwide. It is played with a standard 52-card deck, Aces high, and partners sit opposite each other. Every player receives 13 cards.',
    'After the deal comes the auction. Starting with the player after the dealer and going around the table, each player either bids a number of tricks from 7 to 13 that their team promises to win, or passes. Every bid must be higher than the one before, and once you pass you cannot come back in. The auction ends when the other three players have all passed after a bid. If all four players pass, the cards are thrown in and the next dealer redeals.',
    'The winner of the auction names the trump suit — the “tarneeb” that gives the game its name — and leads the first trick. Everyone must follow the suit that was led if they can. If you cannot follow suit you may play any card, including a trump.',
    'Each trick is won by the highest trump played, or by the highest card of the suit led if no trump was played. The winner of a trick leads the next one, and play continues until all 13 tricks have been played.',
    'If the bidding team wins at least as many tricks as it bid, it scores the number of tricks it took and the opponents score nothing; bidding and making all 13 tricks (a “kaboot”) is worth 16 points. If the bidding team falls short, it loses the amount it bid and the opponents score the tricks they won. The deal passes clockwise, and the first team to reach the target — 31 points by default — wins the match.',
  ],
  strategy: [
    'Count your likely tricks before you bid: Aces are almost sure winners, guarded Kings usually win, and every trump beyond the third in a long suit is worth roughly a trick. Then add about two tricks for your partner.',
    'Name your longest suit as trumps rather than the suit with the single highest card. Length lets you keep control after the opponents run out of trumps.',
    'As the bidder, consider drawing trumps early by leading your high trumps, so opponents cannot ruff your side-suit Aces and Kings.',
    'Cash side-suit Aces early, before opponents become void in that suit and can trump them.',
    'If your partner is already winning a trick, play low and save your high cards. When you must ruff, use the smallest trump that still wins.',
    'On defence you only need to stop the bidders, not win the hand: count how many tricks they still need and focus on taking the few you need to set them.',
  ],
  faq: [
    { q: 'What does Tarneeb mean?', a: 'Tarneeb is Arabic for “trump”. The game is named after the trump suit that the winning bidder chooses each hand.' },
    { q: 'What is the minimum bid in Tarneeb?', a: 'The minimum bid is 7 tricks — more than half of the 13 tricks in a hand. The maximum is 13, and making a bid of 13 scores a 16-point kaboot bonus.' },
    { q: 'What happens if everybody passes?', a: 'If all four players pass without a bid, the cards are reshuffled and the next player clockwise deals a new hand.' },
    { q: 'How many points do you play to?', a: 'Tarneeb is traditionally played to 31 points. On CardArena you can choose 21 for a quicker match, 31 for the standard game, or 41 for a longer one.' },
    { q: 'Can I play Tarneeb online for free?', a: 'Yes — play Tarneeb free in your browser against AI partners and opponents, with no download or account needed.' },
  ],
};
