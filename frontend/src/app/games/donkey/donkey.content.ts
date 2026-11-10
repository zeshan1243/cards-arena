import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Donkey is a quick draw-and-match card game for two to six players, played with a standard 52-card deck. Each player is dealt four cards, four more are placed face up in the middle of the table, and the rest of the deck is placed face down.',
    'On your turn, draw the top card of the deck into your hand, then play any card from your hand. If it has the same rank as one of the face-up cards on the table — a 7 with a 7, a King with a King — take the pair and put it on your own pile. Then draw again: you keep going for as long as you can make a match.',
    'Piles count too. If a card in your hand matches the top card of an opponent’s pile, steal it — together with any other cards of that rank sitting on top, such as a captured pair — and put them on your own pile. If it matches the top card of your own pile, it simply joins your pile — and either way you draw again.',
    'When you play a card that matches nothing, it is thrown face up on the table and your turn ends — so you always finish your turn with four cards in hand. Choose the throw carefully: the card is now there for anyone to match.',
    'When the deck runs out, players take turns playing the cards left in their hands, one card per turn. A card that matches captures as usual; any other card is placed on the table. The round ends when every hand is empty.',
    'Only captured cards score: every card from 2 to 9 is worth 5 points, 10, Jack, Queen and King are worth 10, and each Ace is worth 20 — 400 points in the whole deck. Rounds continue until a player reaches 500 or 1000 points, and the highest total wins.',
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
    { q: 'How many players can play Donkey?', a: 'Two to six. Each player gets four cards, four go face up on the table, and the rest of the deck is drawn from during play.' },
    { q: 'How are cards scored?', a: 'Every card you capture scores: 2 to 9 are 5 points each, 10, Jack, Queen and King are 10, and Aces are 20. The full deck is worth 400 points.' },
    { q: 'Can I take cards from another player?', a: 'Yes. If a card in your hand has the same rank as the top card of an opponent’s pile, you take every card of that rank on top of their pile — a captured pair of 3s comes over together — and put them on your own pile. A card matching the top of your own pile can be added to it as well.' },
    { q: 'What happens when the deck runs out?', a: 'Players take turns playing the cards left in their hands, one per turn. A matching card captures; otherwise it is placed face up on the table. The round ends when all hands are empty.' },
    { q: 'Can I play Donkey online for free?', a: 'Yes — play Donkey free in your browser on CardArena against AI opponents, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
