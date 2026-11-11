import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Chess is a two-player strategy game played on an 8×8 board. Each side starts with sixteen pieces: a king, a queen, two rooks, two bishops, two knights and eight pawns. White always moves first. On CardArena you play against the computer and can choose to play White or Black.',
    'Each piece moves its own way. The king moves one square in any direction. The queen moves any distance in a straight line or diagonally; the rook in straight lines and the bishop diagonally. The knight jumps in an L shape — two squares one way and one to the side — and is the only piece that can jump over others. Pawns move one square forward (two on their first move) but capture one square diagonally forward.',
    'You capture by moving onto a square held by an enemy piece. When your king is attacked it is in check, and your next move must get it out of check — by moving the king, blocking the attack or capturing the attacker. If there is no way out, that is checkmate and the game is over.',
    'Three special moves: castling moves your king two squares towards a rook, and the rook jumps to the king’s other side — allowed only if neither has moved, the squares between are empty and the king is not in, through or into check. En passant lets a pawn capture an enemy pawn that has just moved two squares past it, as if it had moved one. A pawn reaching the far rank is promoted to a queen, rook, bishop or knight of your choice.',
    'A game is drawn by stalemate (the side to move has no legal move but is not in check), by the same position appearing three times, by fifty moves each without a capture or pawn move, or when neither side has enough pieces left to checkmate.',
    'Tap a piece to see where it can go — dots mark empty squares and rings mark captures — then tap a square to move. Use Hint for a suggested move, Undo to take a move back, and switch between Easy, Normal, Hard and Expert at any time.',
  ],
  strategy: [
    'Control the centre. Pawns and pieces on or aimed at the four middle squares have the most room and restrict your opponent.',
    'Develop your knights and bishops early, castle to tuck your king away, and connect your rooks — before going hunting with the queen.',
    'Count before you capture. Pieces are worth roughly pawn 1, knight 3, bishop 3, rook 5 and queen 9; make sure a trade gains material rather than losing it.',
    'Check every move for what your opponent is threatening, and look for forks — a knight or pawn attacking two pieces at once — pins and loose pieces.',
    'Every check, capture and threat first: when looking for a good move, consider forcing moves before quiet ones.',
    'In the endgame the king becomes a strong piece — bring it towards the centre — and passed pawns that can run to promotion decide many games.',
  ],
  aiNote: 'Play the computer at four levels. Easy looks a move ahead and often blunders; Normal sees simple exchanges; Hard searches several moves deep and punishes loose pieces; Expert thinks for up to two seconds a move and rarely misses a tactic.',
  faq: [
    { q: 'Can I play chess against the computer for free?', a: 'Yes — play chess free in your browser on CardArena against the computer at four levels, on phone, tablet or desktop, with no download or sign-up.' },
    { q: 'Can I play as Black?', a: 'Yes. Tap Play Black and the board turns round; the computer then plays White and makes the first move. Tap Play White to switch back.' },
    { q: 'How does castling work?', a: 'Move your king two squares towards a rook and the rook jumps over to the square beside it. You can only castle if the king and that rook haven’t moved, the squares between them are empty, and your king isn’t in check and doesn’t pass through or land on an attacked square.' },
    { q: 'What is en passant?', a: 'If an enemy pawn moves two squares forward and lands beside your pawn, your pawn may capture it as if it had moved only one square — but only on the very next move.' },
    { q: 'What is the difference between checkmate and stalemate?', a: 'Both mean the side to move has no legal move. If their king is in check, it is checkmate and they lose; if it is not in check, it is stalemate and the game is a draw.' },
    { q: 'Can I take back a move?', a: 'Yes — Undo takes back your last move and the computer’s reply, as many times as you like while the game is going.' },
  ],
};
