import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Spades is a four-player partnership trick-taking game played with a standard 52-card deck. Partners sit opposite each other, Aces are high, and spades are always the trump suit. Each player is dealt 13 cards.',
    'After the deal, each player — starting with the player to the left of the dealer — bids the number of tricks they expect to win, from 0 to 13. A bid of zero is called Nil. Your team’s contract is the total of both partners’ bids, not counting a Nil.',
    'The player to the left of the dealer leads the first trick. Everyone must follow the suit led if they can; if you cannot, you may play any card, including a spade. The highest spade wins the trick, or the highest card of the suit led if no spade was played. The winner leads the next trick.',
    'Spades cannot be led until they have been “broken” — that is, until someone has played a spade on an earlier trick because they could not follow suit. The only exception is when the leader holds nothing but spades.',
    'If your team wins at least as many tricks as its contract, you score 10 points per trick bid plus 1 point for each extra trick, called a bag. Fall short and you lose 10 points per trick bid. A successful Nil earns 100 points, a failed Nil costs 100, and every 10 bags you collect costs 100 points. The match ends when a team reaches the target score (200, 300 or 500) or falls to −200, and the higher score wins.',
  ],
  strategy: [
    'Bid what you can count: Aces, Kings with at least one card to protect them, and spades beyond your third are your most reliable tricks.',
    'Don’t ignore bags. Taking a couple of overtricks is harmless, but they add up — every tenth bag costs 100 points, so once your contract is safe, consider ducking.',
    'Bid Nil only with a genuinely weak hand: no Aces or Kings, few spades and no high spades, and low cards to escape with in every suit.',
    'Protect your partner’s Nil. Play high to win tricks your partner might otherwise be forced to take, and lead suits they are likely void in so they can discard.',
    'Count spades as they fall. Once the high trumps are gone, your small spades become sure winners late in the hand.',
    'Setting the opponents is as valuable as making your own bid. If they are one trick short, spend your high cards to stop them.',
  ],
  faq: [
    { q: 'What does “breaking spades” mean?', a: 'Spades are broken the first time a spade is played on a trick, usually because a player could not follow suit. Until then, nobody may lead a spade unless they hold only spades.' },
    { q: 'Do a Nil bidder’s tricks count for the team?', a: 'Yes. On CardArena, tricks taken by a failed Nil bidder still count toward the partnership’s contract and bags — but the Nil itself costs 100 points.' },
    { q: 'What are bags in Spades?', a: 'Bags (or sandbags) are tricks won beyond your team’s contract. Each is worth 1 point, but every time a team accumulates 10 bags it loses 100 points.' },
    { q: 'How does a game of Spades end?', a: 'After any hand in which a team reaches the target score (300 by default) or falls to −200. The team with the higher score wins; if the scores are tied, another hand is played.' },
    { q: 'Can I play Spades online for free?', a: 'Yes — play Spades free in your browser with an AI partner against two AI opponents, with no download or account needed.' },
  ],
};
