import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Rummy is one of the world’s best-known card games: a draw-and-discard game for two to four players using a standard 52-card deck. The aim is to get rid of all your cards by forming them into melds — sets and runs — before your opponents do.',
    'With two players each gets 10 cards; with three or four players each gets 7. The remaining cards form the face-down stock, and the top card is turned over to start the discard pile. The player to the dealer’s left goes first, and the deal moves around the table each hand.',
    'Every turn has three parts. First you draw — either the top card of the stock or the top card of the discard pile. Then you may lay melds face up on the table: a set is three or four cards of the same rank (such as 8♠ 8♥ 8♦), and a run is three or more cards in a row of the same suit (such as 4♣ 5♣ 6♣). Aces are low, so A-2-3 is a run but Q-K-A is not. You may also lay off single cards onto any meld already on the table, whoever made it. Finally you discard one card face up, which ends your turn. You may not discard the same card you just picked up from the discard pile.',
    'You go out when you have no cards left, either by discarding your last card or by melding all of them. The hand ends immediately and you score the value of every card still held by the other players: Aces 1 point, number cards their face value, and Jacks, Queens and Kings 10 points each. If the stock runs out, the discard pile (except its top card) is shuffled to make a new stock.',
    'On CardArena a game is played to 100 or 200 points over several hands. Tap cards to select them, then press Meld, Lay off or Discard; draw by tapping the stock or the discard pile.',
  ],
  strategy: [
    'Get rid of high cards early. Kings, Queens and Jacks cost 10 points each if an opponent goes out while you still hold them.',
    'Watch the discard pile. If an opponent picks up a 7, they are probably collecting 7s or building a run around it — so don’t hand them another one.',
    'Don’t take the discard just because it’s there. Taking a card shows your plan; only pick it up when it completes or clearly improves a meld.',
    'Lay off onto other players’ melds. It costs you nothing and is often the fastest way to empty your hand.',
    'Keep flexible cards. A 6♥ that can join 5♥-7♥ or a set of 6s is worth more than a card with only one way to meld.',
    'Count down near the end. When an opponent is down to one or two cards, dump your highest cards first to keep their score low.',
  ],
  faq: [
    { q: 'How many cards do you get in Rummy?', a: 'With two players each player gets 10 cards. With three or four players each gets 7 cards.' },
    { q: 'Are Aces high or low in Rummy?', a: 'In classic Rummy Aces are low: A-2-3 of a suit is a valid run, but Q-K-A is not. An Ace is worth 1 point when counting leftover cards.' },
    { q: 'What is laying off in Rummy?', a: 'Laying off means adding one or more cards from your hand to a meld that is already on the table — for example adding the 9♦ to a run of 6♦ 7♦ 8♦, or the fourth Queen to a set of three Queens. You can lay off onto anyone’s melds.' },
    { q: 'How is Rummy scored?', a: 'The player who goes out scores the total value of the cards left in their opponents’ hands: Aces 1, number cards their face value, and face cards 10. The first player to reach the target score wins the game.' },
    { q: 'Can I play Rummy online for free?', a: 'Yes — play classic Rummy free in your browser on CardArena against AI opponents at four difficulty levels, with two to four players and no download or sign-up.' },
  ],
};
