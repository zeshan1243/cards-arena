import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Farkle is a push-your-luck dice game played with six dice. Players take turns rolling, and the first to bank 10,000 points — or 5,000 in a quick game — triggers the end of the game. Play solo to reach the target in as few turns as you can, or against one to three computer players.',
    'Start your turn by rolling all six dice. After every roll you must set aside at least one scoring die: a 1 is worth 100, a 5 is worth 50, and sets score more. You can then roll the remaining dice to add more points, or bank everything you’ve scored this turn.',
    'If a roll contains nothing that scores, that’s a Farkle: you lose all the points from this turn and the dice pass to the next player. The fewer dice you roll, the more likely a Farkle becomes — that’s the gamble.',
    'Score all six dice in one turn and you have hot dice: pick all six up and keep rolling, with your turn total still growing.',
    'Scoring: three of a kind is worth 100 times the number (three 1s are 1,000). Four of a kind is 1,000, five of a kind 2,000 and six of a kind 3,000. A 1-2-3-4-5-6 straight, three pairs, or four of a kind with a pair each score 1,500, and two triplets score 2,500. Dice only count in the roll they were thrown — you can’t combine dice across rolls.',
    'When a player banks enough to reach the target, every other player gets one final turn to beat them. The highest total then wins.',
  ],
  strategy: [
    'Don’t take every scoring die. With 1-5-3-3-4-6, keeping just the 1 and rolling five dice is usually worth more than keeping the 1 and the 5 and rolling four.',
    'Know when to stop. With only one or two dice left, a Farkle is likely — bank 300 or more rather than risking it.',
    'Roll six dice whenever you can: with six dice you farkle only about 2% of the time, so hot dice are always worth rolling.',
    'Play to the scoreboard. When an opponent is close to the target, you have to take bigger risks to catch up.',
    'In the final round, keep rolling until you beat the leader — banking less than their total can’t win.',
  ],
  aiNote: 'Play against up to three computers at three levels. Easy keeps every scoring die and banks early; Normal keeps fewer dice to roll more; Hard banks by how many dice are left and plays bolder when someone is close to winning.',
  faq: [
    { q: 'What is a Farkle?', a: 'A roll with no scoring dice — no 1s, no 5s and no scoring sets. You lose all the points you’ve built up this turn and your turn ends.' },
    { q: 'How much is three of a kind worth in Farkle?', a: '100 times the number shown: three 4s score 400 and three 6s score 600. Three 1s are the exception at 1,000 points.' },
    { q: 'What are hot dice?', a: 'If every one of your six dice has been set aside as scoring dice during a turn, you can roll all six again and keep adding to your turn total.' },
    { q: 'Are there different Farkle rules?', a: 'Yes — Farkle is a folk game with many house rules. CardArena uses the popular scoring of 1,000 / 2,000 / 3,000 for four, five and six of a kind, 1,500 for a straight or three pairs, and 2,500 for two triplets, with no minimum score to get on the board.' },
    { q: 'Can I play Farkle online for free?', a: 'Yes — play Farkle free in your browser on CardArena, solo or against the computer, on phone, tablet or desktop, with no download or sign-up.' },
  ],
};
