import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Sudoku is a logic puzzle played on a 9×9 grid, divided into nine 3×3 boxes. Some cells start with a digit filled in. Your goal is to fill every empty cell so that each row, each column and each 3×3 box contains the digits 1 to 9 exactly once.',
    'No maths is needed — the digits are just symbols. Every puzzle on CardArena has exactly one solution. Easier levels need only simple logic; Expert puzzles may call for advanced techniques.',
    'Tap a cell, then tap a digit to place it. The cell’s row, column and box are shaded, and every cell with the same digit lights up, so it’s easy to see where a digit can and can’t go. On a computer you can also type digits, move with the arrow keys and press Backspace to clear a cell.',
    'Turn on Notes to pencil in the digits a cell might be. When you place a digit, it’s removed from the notes in the same row, column and box automatically. “Fill in all notes” writes in every possibility at once.',
    'With Check on, a wrong digit turns red straight away and a mistake counter shows at the top; turn it off for a purer challenge where only clashing digits are marked. Wrong digits count as mistakes either way, and your total is shown when you finish. Use Undo to step back and Hint to fill in a cell for you.',
    'Choose Easy, Medium, Hard or Expert, or play the Daily puzzle — a Medium puzzle that is the same for everyone on the same date, with a new one from midnight your local time. Your game is saved as you play, so you can come back to it later.',
  ],
  strategy: [
    'Look for singles first: a cell where only one digit fits, or a digit that fits in only one cell of a row, column or box.',
    'Scan digit by digit. Pick a digit that already appears often, and check each box for the one place it can still go.',
    'Use notes once the easy cells are done. Pencil in the candidates, then look for cells left with a single candidate.',
    'Pairs: if two cells in a row, column or box can only be the same two digits, those digits can be removed from every other cell in that unit.',
    'Pointing: if a digit’s only spots in a box all lie in one row or column, it can’t appear elsewhere in that row or column.',
    'On Expert, slow down before you guess — look again for an intersection, pair or triple you’ve missed.',
  ],
  aiNote: 'Puzzles are generated fresh for you and graded by the techniques a person needs: Easy and Medium aim for puzzles that need only singles, and Hard for ones that need pointing, pairs or triples. Expert has the fewest clues and may need advanced techniques or some trial and error. The Daily puzzle is the same for every player on the same date, and your best time for each level is saved on your device.',
  faq: [
    { q: 'Does every Sudoku have one solution?', a: 'A proper Sudoku has exactly one solution, and every puzzle on CardArena is checked to make sure it does. Expert puzzles may still need advanced techniques, or some trial and error, to find it.' },
    { q: 'What are notes in Sudoku?', a: 'Notes, or pencil marks, are small digits you write in a cell to remember which digits it could still be. Turn on Notes and tap digits to add or remove them.' },
    { q: 'What is the daily Sudoku?', a: 'A Medium puzzle that is the same for every player on the same date, with a new one from midnight your local time. Once you’ve solved it, the Daily button shows a tick and you can replay it for practice. Finishing it, like finishing any game on CardArena, counts towards your daily play streak.' },
    { q: 'Do mistakes count when Check is off?', a: 'Yes. Every wrong digit you enter is counted, whether Check is on or off. With Check on, wrong digits turn red and the mistake counter is shown as you play; with it off, only digits that clash in a row, column or box are marked, and you see your total when you finish.' },
    { q: 'Is my progress saved?', a: 'Yes. Your current puzzle, notes and time are saved on your device as you play, so you can close the page and carry on later. Your best time for each level is kept too.' },
  ],
};
