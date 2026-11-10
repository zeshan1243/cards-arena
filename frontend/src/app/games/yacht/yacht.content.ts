import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Yacht Dice is the classic five-dice game of luck and judgement. A game lasts 13 rounds, and in each round you fill exactly one of the 13 boxes on your scorecard. The goal is the highest total once every box is filled. Play solo to beat your best score, or against one to three computer players.',
    'On your turn, roll all five dice. You may then roll again up to two more times — three rolls in all. Before each re-roll, tap the dice you want to keep: held dice stay put and only the others are rolled. You can stop and score after any roll.',
    'When you score, choose one empty box. The upper section has Ones to Sixes: you score the total of the dice showing that number, so three 5s in Fives is 15. If your six upper boxes add up to 63 or more — three of each number — you earn a 35-point bonus.',
    'The lower section scores combinations. Three of a kind and Four of a kind score the total of all five dice. A Full House (three of one number and two of another) scores 25. A Small Straight (four numbers in a row) scores 30 and a Large Straight (five in a row) scores 40. Five of a kind — a Yacht — scores 50. Chance scores the total of any dice.',
    'You must fill a box every turn, even if the dice don’t fit it — then you score 0 there. Each extra Yacht after scoring 50 in the Yacht box earns a 100-point bonus and counts as a joker: it goes in its matching upper box if that is open, otherwise it scores full points in any open lower box.',
  ],
  strategy: [
    'Chase the upper bonus. Three of each number earns the 35 points; scoring four 5s or 6s gives you room to come up short elsewhere.',
    'Keep Chance for a bad turn. It’s your safety net when the dice fit nothing else.',
    'Scratch wisely. If you have to take a zero, put it in Ones or in a box you’re unlikely to fill, such as Yacht late in the game.',
    'Go for straights early. With an open run like 2-3-4-5, re-rolling the odd die gives two ways to finish a Large Straight.',
    'Three of a kind on the first roll? Keep the three and roll the rest twice — you’re chasing Four of a kind, a Full House or even a Yacht.',
  ],
  aiNote: 'Play against up to three computers at three levels. Easy keeps whatever it rolled most of and often grabs the biggest score; Normal looks one roll ahead; Hard works out the exact odds of every way to hold the dice across all its remaining rolls.',
  faq: [
    { q: 'How many rolls do you get in Yacht Dice?', a: 'Three per turn: one roll of all five dice, then up to two re-rolls of any dice you choose not to hold. You can stop and score after any of them.' },
    { q: 'How do you get the upper bonus?', a: 'Score 63 or more across Ones to Sixes — three of each number adds up to exactly 63 — and you get a 35-point bonus.' },
    { q: 'What happens if I roll a second Yacht?', a: 'If you already scored 50 in the Yacht box, every further Yacht earns a 100-point bonus. It then plays as a joker: it must go in its matching upper box if that is open, otherwise it can score full points in any open lower box.' },
    { q: 'What is a good score?', a: 'Around 200 is a solid game and anything above 250 is excellent. The maximum possible score, with a Yacht every turn, is 1575.' },
    { q: 'Can I play Yacht Dice online for free?', a: 'Yes — play free in your browser on CardArena, solo or against the computer, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
