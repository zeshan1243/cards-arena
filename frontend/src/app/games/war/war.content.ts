import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'War is the classic two-player card game of pure luck, played with a standard 52-card deck. On CardArena you play against the computer. The deck is shuffled and split evenly, so each player starts with 26 cards face down.',
    'In each battle both players turn over the top card of their deck. The higher card wins, and its owner takes both cards. Cards rank from 2 (lowest) up to King and Ace (highest); suits don’t matter.',
    'If the two cards are the same rank, it’s War! Each player lays three cards face down and then one more face up. The higher of the new face-up cards wins the whole pile — all ten cards. If those match too, the war repeats, and the pot keeps growing. A player who runs short during a war plays as many cards as they have, and if they can’t turn a card face up at all, they lose.',
    'In Classic mode the cards you win go to the bottom of your deck, and the game ends when one player has all 52 cards. Quick mode is a single pass through the deck: winnings are set aside, and when either deck runs out, the player holding more cards wins.',
    'Tap your deck (or press the space bar) to flip. Turn on Auto to let battles play themselves, and Fast to speed them up — a Classic game usually takes around two hundred battles.',
  ],
  strategy: [
    'War is a game of chance: no decision you make changes who wins. That makes it a perfect first card game for children learning to compare numbers and face cards.',
    'Aces are the strongest cards in the deck. Whoever holds more of them usually wins in the long run, but every Ace can still be lost in a war.',
    'Wars swing the game. A single war moves at least ten cards, so a player down to a handful of cards can climb back quickly.',
    'Short on time? Play Quick mode — one pass through the deck decides the game in a minute or two.',
    'Use Auto with Fast for a relaxing watch, and step in with taps when a big war is coming.',
  ],
  faq: [
    { q: 'What happens when the cards tie in War?', a: 'It’s a war: each player puts three cards face down and one face up. The higher face-up card takes every card on the table. If they tie again, the war repeats.' },
    { q: 'What if a player doesn’t have enough cards for a war?', a: 'They play every card they have, keeping the last one to turn face up. If they have no card left to turn up, they lose the war and the game.' },
    { q: 'Is the Ace high or low in War?', a: 'Ace is the highest card. The order from low to high is 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace.' },
    { q: 'How long does a game of War take?', a: 'A Classic game, played until one player has all 52 cards, usually lasts a couple of hundred battles — a few minutes with Auto and Fast on. Quick mode ends after one pass through the deck.' },
    { q: 'Can I play War online for free?', a: 'Yes — play War free in your browser on CardArena against the computer, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
