import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Baloot is the most popular card game in Saudi Arabia and across the Gulf. Four players form two partnerships, with partners sitting opposite each other, and play with a 32-card deck from 7 up to Ace.',
    'Each player receives five cards and the next card is turned face up — the buyer card. In the first round of bidding each player, starting after the dealer, may choose Sun (no trumps), Hokm (the buyer card’s suit becomes trumps) or pass. Sun outranks Hokm: once someone chooses Hokm, the players still to speak may overtake it with Sun, and choosing Sun ends the bidding at once. If everyone passes there is a second round in which players may choose Sun or Hokm in any suit other than the buyer card’s. If all four pass again, the cards are reshuffled and the deal moves on.',
    'The player who buys takes the face-up card plus two more cards, and everyone else receives three more, so each player holds eight. The player after the dealer leads the first trick. You must follow the suit that was led. In Hokm, if you cannot follow suit you must play a trump, unless your partner is already winning the trick; and whenever you play a trump on a trick that already contains one, you must beat it if you can, including when trumps are led.',
    'In plain suits and in Sun the cards rank A, 10, K, Q, J, 9, 8, 7. In the trump suit the order changes to J, 9, A, 10, K, Q, 8, 7. Card values are Ace 11, Ten 10, King 4, Queen 3 and Jack 2; in trumps the Jack is worth 20 and the Nine 14. The last trick earns a 10-point bonus, so a Sun hand holds 130 card points and a Hokm hand 162.',
    'At the end of the hand the card points become game points: a Sun hand is worth 26 and a Hokm hand 16. The buying team’s score is rounded half-up (Sun: points × 2 ÷ 10, Hokm: points ÷ 10) and the defenders receive the rest. If the buyers get half or less, the contract fails and the defenders take everything. A player who holds both the King and Queen of trumps in Hokm scores Baloot, worth 2 extra game points. The first team to reach the target — 52, 101 or 152 — wins the match.',
  ],
  strategy: [
    'Buy Sun with several Aces and Tens. Without trumps, every Ace is a sure trick and an Ace–Ten combination in the same suit can collect 21 points on its own.',
    'Buy Hokm when you hold the Jack or Nine of the buyer card’s suit plus some length. The Jack (20) and Nine (14) are the two highest trumps and the most valuable cards in the deck.',
    'Draw trumps early as the buyer in Hokm. Leading the Jack of trumps forces opponents to give up their trumps and protects your side-suit Aces and Tens.',
    'When your partner is winning the trick, give them points — a Ten or a King — rather than a worthless 7 or 8. When the opponents are winning, discard the cheapest card you have.',
    'Remember the over-trump rule: once a trump is on the table, every later trump must beat it if possible. Keep a low trump when you can, so you are not forced to waste a big one.',
    'Count the Aces and Tens that have been played. Once they are gone, your Kings and Queens become winners, and the 10-point bonus for the last trick can decide a close contract.',
  ],
  faq: [
    { q: 'What is the difference between Sun and Hokm in Baloot?', a: 'Sun is played without trumps and the hand is worth 26 game points. Hokm has a trump suit, in which the Jack and Nine become the highest and most valuable cards, and the hand is worth 16 game points.' },
    { q: 'What does Baloot mean in the game?', a: 'Baloot is the bonus for holding the King and Queen of trumps in a Hokm hand. On CardArena it is announced automatically when the second of the two cards is played and adds 2 game points to that team, even if their contract fails.' },
    { q: 'Are projects such as Sira, Fifty and Hundred included?', a: 'Not yet. CardArena currently plays core Baloot: bidding, Sun and Hokm play, card points and the Baloot bonus. Other projects (melds), doubling and the Ashkal bid are not yet included.' },
    { q: 'What happens if the buying team scores exactly half?', a: 'The contract fails. The buyers must score more than half of the hand’s game points — more than 13 in Sun or more than 8 in Hokm — otherwise the opponents take all of them.' },
    { q: 'Can I play Baloot online for free?', a: 'Yes. Play Baloot free in your browser against AI partners and opponents at three difficulty levels — no download or account needed.' },
  ],
};
