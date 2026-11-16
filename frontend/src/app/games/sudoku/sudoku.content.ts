import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Sudoku is a logic puzzle played on a 9×9 grid, divided into nine 3×3 boxes. Some cells start with a digit filled in. Your goal is to fill every empty cell so that each row, each column and each 3×3 box contains the digits 1 to 9 exactly once.',
    'No maths is needed — the digits are just symbols. Every puzzle on CardArena has exactly one solution, and you can always reach it by logic alone, without guessing.',
    'Tap a cell, then tap a digit to place it. The cell’s row, column and box are shaded, and every cell with the same digit lights up, so it’s easy to see where a digit can and can’t go. On a computer you can also type digits, move with the arrow keys and press Backspace to clear a cell.',
    'Turn on Notes to pencil in the digits a cell might be. When you place a digit, it’s removed from the notes in the same row, column and box automatically. “Fill in all notes” writes in every possibility at once.',
    'With Check on, a wrong digit turns red straight away and counts as a mistake; turn it off for a purer challenge where only clashing digits are marked. Use Undo to step back and Hint to fill in a cell for you.',
    'Choose Easy, Medium, Hard or Expert, or play the Daily puzzle — the same Medium puzzle for everyone, new each day. Your game is saved as you play, so you can come back to it later.',
  ],
  strategy: [
    'Look for singles first: a cell where only one digit fits, or a digit that fits in only one cell of a row, column or box.',
    'Scan digit by digit. Pick a digit that already appears often, and check each box for the one place it can still go.',
    'Use notes once the easy cells are done. Pencil in the candidates, then look for cells left with a single candidate.',
    'Pairs: if two cells in a row, column or box can only be the same two digits, those digits can be removed from every other cell in that unit.',
    'Pointing: if a digit’s only spots in a box all lie in one row or column, it can’t appear elsewhere in that row or column.',
    'Never guess on Expert — slow down, and look again for an intersection or a pair you’ve missed.',
  ],
  aiNote: 'Puzzles are generated fresh for you and graded by the techniques needed: Easy and Medium need only singles, Hard needs pointing or pairs, and Expert needs advanced techniques. The Daily puzzle is the same for every player on the same day.',
  faq: [
    { q: 'Can I play Sudoku online for free?', a: 'Yes — play Sudoku free in your browser on CardArena at four difficulty levels, plus a daily puzzle, on phone, tablet or desktop, with no download or sign-up.' },
    { q: 'Does every Sudoku have one solution?', a: 'A proper Sudoku has exactly one solution, and every puzzle on CardArena is checked to make sure it does — so it can always be solved by logic, without guessing.' },
    { q: 'What are notes in Sudoku?', a: 'Notes, or pencil marks, are small digits you write in a cell to remember which digits it could still be. Turn on Notes and tap digits to add or remove them.' },
    { q: 'What is the daily Sudoku?', a: 'A new Medium puzzle each day that is the same for every player. Solve it to keep your daily streak going.' },
    { q: 'Is my progress saved?', a: 'Yes. Your current puzzle, notes and time are saved on your device as you play, so you can close the page and carry on later. Your best time for each level is kept too.' },
  ],
};
