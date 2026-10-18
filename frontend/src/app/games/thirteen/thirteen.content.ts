import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Thirteen — Tiến Lên in Vietnamese, also called Killer or Big Deuce — is a shedding card game for two to four players using a standard 52-card deck. Each player is dealt 13 cards, and the goal is simple: be the first to get rid of every card in your hand.',
    'Cards rank from 3 (lowest) through 10, J, Q, K and A, with the 2 as the highest card of all. When two cards have the same rank, the suit decides: Spades are lowest, then Clubs, Diamonds and Hearts highest. So the 3♠ is the weakest card in the deck and the 2♥ the strongest.',
    'The player holding the 3♠ starts the first hand by playing it, either on its own or as part of a combination. With fewer than four players the lowest card that was dealt starts instead. You can play a single card, a pair, three of a kind, four of a kind, a run of three or more consecutive ranks in any suits (such as 7-8-9), or a run of three or more consecutive pairs (such as 4-4-5-5-6-6). 2s can never be part of a run.',
    'Going around the table, each player must either beat the cards on the table or pass. To beat them you play the same kind of combination with the same number of cards and a higher top card — for example a higher pair on a pair, or a run of the same length with a higher top card. Once you pass you sit out until the round ends. When everyone else has passed, the last player to play clears the table and leads any combination they like.',
    'Bombs are the exception to “same kind”: four of a kind or three consecutive pairs can beat a single 2, four consecutive pairs can beat a pair of 2s, and five consecutive pairs can beat three 2s. Four of a kind also beats three consecutive pairs. Play continues until only one player has cards left. On CardArena, with four players 1st place scores 3 points, 2nd 2, 3rd 1 and last 0; the winner of a hand leads the next one, and the game ends when someone reaches the target score.',
  ],
  strategy: [
    'Get rid of your low singles early. Weak cards like 3s, 4s and 5s are hard to play later because almost anything beats them — lead them while you control the table.',
    'Keep combinations together. Breaking a pair or a run to play a single often leaves you with two awkward cards instead of one good play.',
    'Save your 2s. A 2 almost always wins the round, which gives you the lead. Use it when you need control, not just to beat any single.',
    'Hold bombs for the right moment. Four of a kind or three pairs in a row can stop an opponent’s 2 — and with it, their bid to go out.',
    'Watch the card counts. When an opponent is down to one card, never lead a single you can avoid; lead pairs or runs instead so they can’t follow.',
    'Count the 2s and Aces. Knowing which high cards are still out tells you when your King or Ace will hold the table.',
  ],
  faq: [
    { q: 'Is Thirteen the same as Tiến Lên?', a: 'Yes. Thirteen is the English name for Tiến Lên, the national card game of Vietnam. It is also known as Killer, Big Deuce or Viet Cong, and is closely related to Big Two (Pusoy Dos).' },
    { q: 'What is the highest card in Thirteen?', a: 'The 2 of Hearts. 2s are the highest rank, and Hearts are the highest suit, so the 2♥ beats every other single card.' },
    { q: 'Can I play a 2 in a run?', a: 'No. Runs go from 3 up to Ace at most, so a sequence like K-A-2 or A-2-3 is not allowed.' },
    { q: 'What is a bomb?', a: 'A combination that can beat 2s even though it is a different shape: four of a kind or three consecutive pairs beat a single 2, four consecutive pairs beat a pair of 2s, and five consecutive pairs beat three 2s.' },
    { q: 'Can I play Thirteen online for free?', a: 'Yes — play Thirteen free in your browser on CardArena against AI opponents at four difficulty levels, with two to four players and no download or sign-up needed.' },
  ],
};
