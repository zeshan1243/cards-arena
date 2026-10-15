import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    '29 (Twenty-Nine) is a four-player partnership trick-taking card game hugely popular in South Asia. Partners sit opposite each other and play with a 32-card deck — the 7, 8, 9, 10, J, Q, K and A of each suit. In every suit the cards rank, from high to low, J, 9, A, 10, K, Q, 8, 7, so the Jack and the Nine are the most powerful cards.',
    'Only four ranks score: each Jack is worth 3 points, each Nine 2, each Ace 1 and each Ten 1, for 28 card points in the whole deck. The aim of each hand is for the bidding team to collect at least as many card points as they bid.',
    'Every player is dealt four cards. Starting with the player after the dealer and going clockwise, players bid a number from 16 to 28 or pass. Each bid must be higher than the current highest, and a player who passes is out of the auction. Bidding ends when only one bidder remains. If the first three players all pass, the dealer is forced to bid at least 16. The winner of the auction secretly picks a trump suit, and then four more cards are dealt so everyone holds eight.',
    'The player after the dealer leads the first trick and the winner of each trick leads the next. You must follow the suit led if you can. Until trump is revealed, no suit is trump and the highest card of the suit led wins. A player who cannot follow suit may ask for trump to be revealed — after which they must play a trump if they have one — or simply play any card without revealing. Once trump is out, the highest trump wins every trick it appears in, including cards already played to the current trick.',
    'With the Pair rule on, a team that wins a trick after trump is revealed while one of its players holds both the King and Queen of trump declares a pair: it lowers the bidder’s target by 4 if the bidding team holds it, or raises it by 4 if the defenders do. After eight tricks the bidding team wins one game point if they reached their target, or loses one if they fell short. The first team to the game-point target (3 or 6) wins the match, and a team that sinks to minus the target loses.',
  ],
  strategy: [
    'Bid on Jacks and Nines, not on long suits alone. A four-card hand with a Jack and a Nine in the same suit is a solid opening bid of 16–18; two Jacks can support more.',
    'Choose as trump the suit where you hold the most cards, ideally including its Jack or Nine — trump length wins the late tricks where most points are taken.',
    'When your partner is already winning a trick, throw your point cards (Aces and Tens, even a Nine) onto it. When the opponents are winning and you cannot beat them, play a 7 or 8 instead.',
    'Think before revealing trump. Revealing lets you cut a trick full of points, but it also tells the defenders exactly which suit to fear and turns on their trumps too.',
    'Count the Jacks and Nines as they fall. Once the Jack of a suit is gone, the Nine becomes the boss card and can be led safely.',
    'Keep the pair in mind: as bidder, a King–Queen of trump can make a high bid realistic, while defenders holding it can push the target out of reach.',
  ],
  faq: [
    { q: 'Why is the game called 29 if there are only 28 points?', a: 'Traditional versions award one extra point for winning the last trick, making 29 in total. CardArena uses the common 28-point count (J 3, 9 2, A 1, 10 1) and keeps the classic name.' },
    { q: 'What is the highest card in 29?', a: 'The Jack of each suit is the highest card, followed by the Nine, Ace, Ten, King, Queen, 8 and 7. Once trump is revealed, any trump beats every card of the other suits.' },
    { q: 'When does the trump suit take effect?', a: 'Only after it is revealed. Until then the bidder’s chosen suit is secret and no suit is trump. A player who cannot follow suit can reveal it, and from then on trumps win for the rest of the hand.' },
    { q: 'What is a pair (marriage) in 29?', a: 'The King and Queen of the trump suit held by one player. After trump is revealed, the pair is declared when that player’s team wins a trick, moving the bidding target 4 points down for the bidders or 4 points up if the defenders hold it.' },
    { q: 'Can I play 29 online for free?', a: 'Yes — play 29 free in your browser against AI partners and opponents, with no download or sign-up required.' },
  ],
};
