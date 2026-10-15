import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Hokm is the classic Persian trick-taking card game for four players in two partnerships. Partners sit opposite each other, it uses a standard 52-card deck, and Aces are high. The name means “command” in Persian: one player, the Hakem, commands which suit is trumps.',
    'At the start of the match the first Hakem is chosen at random. The cards are shuffled and five are dealt to each player, starting with the Hakem. Looking only at those five cards, the Hakem names the trump suit, called the Hokm. The remaining 32 cards are then dealt so that everyone holds 13.',
    'The Hakem leads the first trick. Every player must follow the suit that was led if they can. If you have no card of the led suit you may play anything, including a trump. The highest trump wins the trick; if no trump was played, the highest card of the led suit wins. The winner of each trick leads the next one.',
    'A hand ends the moment one team has won seven tricks — the remaining cards are not played. The winning team scores 1 point. Winning seven tricks to none is a Kot and scores 2 points, and if the team that was swept is the Hakem’s own team, the Kot is worth 3 points.',
    'If the Hakem’s team wins the hand, the same player stays Hakem for the next hand. If the Hakem’s team loses, the role passes to the next player clockwise. The first team to reach the target score (3, 5 or 7 points; 5 by default) wins the match.',
  ],
  strategy: [
    'As Hakem, choose the suit where you hold the most cards among your first five. Length in trumps wins more tricks than a single high card, and you will receive eight more cards later.',
    'Cash your side-suit Aces early. Once opponents run out of a suit they can trump your winners, so play them before that happens.',
    'Do not overtake a partner who is already winning the trick. Play your lowest card and save your high cards for tricks you actually need.',
    'Keep track of trumps. There are 13 in the deck; once the high ones are gone, your small trumps become sure winners.',
    'When you are void in the led suit and your partner is not winning, trump in with the lowest trump that still takes the trick.',
    'Against the Hakem, every trick matters early: taking even one trick prevents a Kot and denies the Hakem’s team 2 points, while a sweep of the Hakem earns your team 3.',
  ],
  faq: [
    {
      q: 'What does Hakem mean in Hokm?',
      a: 'The Hakem is the “ruler” for the hand. They receive five cards first, choose the trump suit (the Hokm) and lead the first trick. They keep the role as long as their team keeps winning hands.',
    },
    {
      q: 'What is a Kot in Hokm?',
      a: 'A Kot is winning a hand seven tricks to none. It scores 2 points instead of 1. If the team that is swept is the Hakem’s team, the Kot scores 3 points for the opponents.',
    },
    {
      q: 'Is Hokm the same as Court Piece?',
      a: 'They are close relatives. Both are four-player partnership games where one player chooses trumps after seeing five cards. In Hokm the Hakem stays in charge while their team wins and Kot scoring rewards sweeps; Court Piece (Rang) is the South Asian variant with its own deal rotation and Court bonus.',
    },
    {
      q: 'Why does a Hokm hand end before all 13 tricks are played?',
      a: 'Only the first team to seven tricks matters, so the hand stops as soon as a team reaches seven. This keeps games fast — a typical match to 5 points takes about 5–10 minutes.',
    },
    {
      q: 'Can I play Hokm online for free?',
      a: 'Yes. On CardArena you can play Hokm free in your browser with AI partners and opponents — no download or account needed.',
    },
  ],
};
