import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Seep — also spelled Sweep or Siwi — is a fishing card game from India and Pakistan for two players, or four players in two partnerships sitting opposite each other. It uses a standard 52-card deck. Cards have a numeric value: Ace 1, 2 to 10 at face value, Jack 11, Queen 12 and King 13. Unlike trick-taking games, you win cards by capturing them from the open floor in the middle of the table.',
    'Every deal starts with a bid. The player after the dealer receives four cards and must bid a house value from 9 to 13 (9 up to King) matching a card they hold; if they have no 9, 10, J, Q or K the cards are reshuffled and dealt again. Four cards are then placed face up on the floor and the rest are dealt: with four players everyone ends up with 12 cards, and with two players each gets 12 now and another 12 once both hands are empty. The bidder plays first and must use the bid — capture cards totalling the bid with a card of that value, or build a house of the bid value. If neither is possible, they throw a card of the bid value onto the floor.',
    'On your turn you play exactly one card and choose one move. Capture: take loose floor cards (or a house) whose values add up exactly to your card. Build a house: combine your card with loose floor cards to make a pile worth 9 to 13 — you must still hold a card of that value to capture it later. Add to a house: cement it at the same value to make it pakka (fixed), or raise a kacha (unfixed) house to a higher value up to 13, again only if you hold a card of the new value. Throw: put the card loose on the floor — not allowed while you own a house.',
    'Houses can only be captured with a card of exactly the house value, and only one house of each value may sit on the floor. Whoever last built or added to a house owns it and must keep a matching card until the house is taken. Clearing every card from the floor with a capture is a Seep and earns a 50-point bonus, except on the very last play of the deal. When all cards are played, any cards left on the floor go to the player who made the last capture.',
    'Scoring counts captured card points: every spade is worth its value (A♠ = 1 up to K♠ = 13), the other three aces are worth 1 each and the 10 of diamonds is worth 6, for exactly 100 points per deal, plus 50 for each Seep. On CardArena you can play one or two deals; totals are added and the side with the most points wins, with equal totals a draw.',
  ],
  strategy: [
    'Spades are where the points are. The K♠, Q♠ and J♠ alone are worth 36 — capture high spades whenever you can and avoid throwing them loose.',
    'Watch the floor total after your move. If the loose cards add up to 13 or less, the next player may sweep everything for a 50-point Seep, so leave the floor large or awkward.',
    'Build houses with points inside. A house containing high spades or the 10♦ that only you can capture is a safe store of points — cement it to pakka so opponents cannot raise it away from you.',
    'Raise an opponent’s kacha house when you hold the higher card: you take ownership, and the points inside become yours to capture.',
    'Count the court cards. Each value has only four cards; once three Queens are gone, a house of 12 is almost uncatchable for anyone but the holder of the last Queen.',
    'As bidder, bid the value you hold twice if possible — it lets you build a house of that value on your first play and still keep a card to capture it.',
  ],
  faq: [
    { q: 'Is Seep the same as Sweep or Siwi?', a: 'Yes. Seep, Sweep and Siwi are regional names for the same fishing game, popular in North India and Pakistan. It is related to the Italian game Scopa and the Indian game Casino.' },
    { q: 'How many points are in a Seep deck?', a: 'Exactly 100: the spades are worth 91 (A♠ 1 to K♠ 13), the other three aces 1 each, and the 10 of diamonds 6. Each Seep (clearing the floor) adds 50 more.' },
    { q: 'What is the difference between a kacha and a pakka house?', a: 'A kacha (unfixed) house can be raised to a higher value by any player who holds a card of the new value. A pakka (cemented) house has been fixed at its value and can no longer be raised — it can only be captured with a card of exactly that value.' },
    { q: 'Does clearing the floor on the last play count as a Seep?', a: 'No. A capture that empties the floor on the very last play of the deal scores only the card points, not the 50-point Seep bonus.' },
    { q: 'Can I play Seep online for free?', a: 'Yes — play Seep free in your browser against AI opponents, with two players or four in partnerships, no download or account needed.' },
  ],
};
