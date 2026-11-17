import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    '29 (Twenty-Nine) is a four-player partnership trick-taking card game hugely popular in South Asia. Partners sit opposite each other and play with a 32-card deck — the 7, 8, 9, 10, J, Q, K and A of each suit. In every suit the cards rank, from high to low, J, 9, A, 10, K, Q, 8, 7, so the Jack and the Nine are the most powerful cards.',
    'Only four ranks score: each Jack is worth 3 points, each Nine 2, each Ace 1 and each Ten 1, for 28 card points in the whole deck. The aim of each hand is for the bidding team to collect at least as many card points as they bid.',
    'Every player is dealt four cards. Starting with the player after the dealer and going clockwise, players bid a number from 16 to 28 or pass. Each bid must be higher than the current highest, and a player who passes is out of the auction. Bidding ends when only one bidder remains, or at once if someone bids the maximum of 28. If the first three players all pass, the dealer is forced to bid at least 16. The winner of the auction secretly picks a trump suit, and then four more cards are dealt so everyone holds eight.',
    'The player after the dealer leads the first trick and the winner of each trick leads the next. You must follow the suit led if you can. Until trump is revealed, no suit is trump and the highest card of the suit led wins. A player who cannot follow suit may ask for trump to be revealed — after which they must play a trump if they have one — or simply play any card without revealing. Once trump is out, the highest trump wins every trick it appears in, including cards already played to the current trick.',
    'With the Pair rule on, a team that wins a trick after trump is revealed while one of its players holds both the King and Queen of trump declares a pair: it lowers the bidder’s target by 4 if the bidding team holds it, or raises it by 4 if the defenders do, but never below 16 or above 28. Only one pair can be declared per hand, and only while that player still holds both cards. After eight tricks the bidding team wins one game point if they reached their target, or loses one if they fell short. The first team to the game-point target (3 or 6) wins the match, and a team that sinks to minus the target loses.',
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
    { q: 'How many card points are there in 29?', a: 'CardArena counts 28 card points in the deck: Jack 3, Nine 2, Ace 1 and Ten 1 in each of the four suits. Bids run from 16 up to that maximum of 28.' },
    { q: 'What is the highest card in 29?', a: 'The Jack of each suit is the highest card, followed by the Nine, Ace, Ten, King, Queen, 8 and 7. Once trump is revealed, any trump beats every card of the other suits.' },
    { q: 'When does the trump suit take effect?', a: 'Only after it is revealed. Until then the bidder’s chosen suit is secret and no suit is trump. A player who cannot follow suit can reveal it, and from then on trumps win for the rest of the hand.' },
    { q: 'What is a pair (marriage) in 29?', a: 'The King and Queen of the trump suit held by one player. After trump is revealed, the pair is declared when that player’s team wins a trick while they still hold both cards, moving the bidding target 4 points down for the bidders or 4 points up if the defenders hold it. The target stays between 16 and 28, and only one pair counts per hand. You can switch the rule off before the game.' },
    { q: 'What happens if everyone passes?', a: 'If the first three players pass, the dealer cannot pass and must bid at least 16. The dealer’s team then plays the hand as the bidding team.' },
  ],
  aiNote: 'Bots value their first four cards by Jacks, Nines, Aces, Tens and trump length when bidding; Easy bots bid a little erratically, play a random legal card about 40% of the time and reveal trump at random, while Expert bots bid one point more boldly. From Normal up, bots reveal trump only when it is worth cutting, feed point cards to a partner who is sure to win the trick, and avoid throwing Jacks and Nines to the opponents.',
};
