import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Donkey is a quick draw-and-match card game for two or three players, played with a standard 52-card deck. Each player is dealt four cards, four more are placed face up in the middle of the table, and the rest of the deck is placed face down.',
    'On your turn, draw the top card of the deck. If it has the same rank as one of the face-up cards on the table — a 7 with a 7, a King with a King — take the pair and put it on your own pile. Then draw again: you keep going for as long as your cards keep matching.',
    'You can also steal. If the card you draw matches the top card of an opponent’s pile, take that card from them and pair it on your own pile instead.',
    'When the card you draw matches nothing, your turn ends with a throw: put the drawn card face up on the table, or keep it and throw one of the cards from your hand instead. The thrown card is now there for anyone to match.',
    'When the deck runs out, players take turns playing the cards left in their hands, one card per turn. A card that matches captures as usual; any other card is placed on the table. The round ends when every hand is empty.',
    'Only captured cards score: every card from 2 to 9 is worth 5 points, 10, Jack, Queen and King are worth 10, and each Ace is worth 20 — 400 points in the whole deck. Rounds continue until a player reaches 300 or 500 points, and the highest total wins.',
  ],
  strategy: [
    'Throw cheap cards. A thrown card is worth twice its value to whoever draws its pair, so give away 2–9s before tens, picture cards or Aces.',
    'Count what’s gone. A rank whose other three cards have already been captured or thrown is a safe throw — nobody can pair it.',
    'Keep Aces and picture cards in your hand for the end. Once the deck is empty, a high card in your hand can capture a big card left on the table.',
    'Watch the tops of the other piles. A big card on top of the leader’s pile is a target: stealing it gains you points and costs them at the same time.',
    'Avoid topping your own pile with an Ace when you can help it — it invites everyone to come and take it.',
  ],
  aiNote: 'Choose from four bot levels. Easy bots throw almost at random; Normal bots throw their cheapest cards; Hard bots count which ranks are still unseen before throwing; Expert bots also keep their Aces for the end game and always rob the leader’s pile.',
  faq: [
    { q: 'How many players can play Donkey?', a: 'Two or three. Each player gets four cards, four go face up on the table, and the rest of the deck is drawn from during play.' },
    { q: 'How are cards scored?', a: 'Every card you capture scores: 2 to 9 are 5 points each, 10, Jack, Queen and King are 10, and Aces are 20. The full deck is worth 400 points.' },
    { q: 'Can I take cards from another player?', a: 'Yes. If the card you draw has the same rank as the top card of an opponent’s pile, you can take that card and pair it on your own pile.' },
    { q: 'What happens when the deck runs out?', a: 'Players take turns playing the cards left in their hands, one per turn. A matching card captures; otherwise it is placed face up on the table. The round ends when all hands are empty.' },
    { q: 'Can I play Donkey online for free?', a: 'Yes — play Donkey free in your browser on CardArena against AI opponents, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
