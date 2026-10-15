import { GameContent } from '../../core/data/game-content';

export const content: GameContent = {
  howToPlay: [
    'Call Break is a four-player trick-taking card game hugely popular in Nepal, India and Bangladesh. It uses a standard 52-card deck with Aces high, there are no partnerships — every player plays for themselves — and spades are always the trump suit.',
    'Each round the dealer gives all 52 cards out, so everyone holds 13. Before any card is played, each player, starting with the person to the dealer’s left, makes a “call”: the number of tricks, from 1 to 8, they promise to win that round.',
    'The player to the dealer’s left leads the first trick. You must follow the suit that was led, and Call Break adds a twist: if no spade has been played to the trick, you must also beat the highest card of the led suit whenever you can. If you have none of the led suit, you must play a spade, and if someone has already played a spade you must play a higher one if possible. Only when you hold neither the led suit nor any spade may you discard freely.',
    'The highest spade wins the trick; if no spade was played, the highest card of the suit led wins. The winner of each trick leads the next one, and play continues until all 13 tricks are taken.',
    'Scoring is all about hitting your call. Win at least as many tricks as you called and you score your call as points, plus 0.1 for each extra trick (call 4, win 5 → 4.1). Fall short and you lose your call (call 4, win 3 → −4). The deal passes clockwise, and after the agreed number of rounds — 3 or 5 on CardArena — the player with the highest total wins.',
  ],
  strategy: [
    'Count sure winners when you call: Aces, guarded Kings and high spades are your bankable tricks. Long spade suits are powerful because every spade beyond the third usually wins a trick late in the round.',
    'Call slightly conservatively. Missing a call costs the full amount, while an extra trick only adds 0.1, so a safe call that you make comfortably beats an ambitious call that fails.',
    'Short side suits are valuable with spades in hand: once you are void in a suit you can ruff it, but remember the must-trump rule means you cannot save your spades for later when you are void.',
    'Use the must-beat rule against opponents. Leading a middle card in a suit forces players behind you to spend their high cards, which can set up your own Kings and Queens.',
    'Track the spades. Thirteen trumps are in play; once the Ace, King and Queen are gone, your small spades become winners and you can plan the endgame around them.',
    'Watch everyone’s call and tricks won. If an opponent still needs tricks, winning or blocking them can make them miss their call — a swing that matters as much as your own score.',
  ],
  faq: [
    {
      q: 'Is Call Break the same as Spades?',
      a: 'They are related, but different. Both use spades as permanent trumps and bidding, but Call Break is played individually rather than in partnerships, forces you to beat the current highest card when you can, and scores calls with a 0.1 bonus per extra trick instead of bags.',
    },
    {
      q: 'What happens if I win more tricks than I called?',
      a: 'You still make your call. Each extra trick adds 0.1 to your score, so calling 3 and winning 5 scores 3.2.',
    },
    {
      q: 'Do I have to play a spade if I cannot follow suit?',
      a: 'Yes. If you have no cards of the suit led you must play a spade if you hold one, and you must beat any spade already played to the trick if you can. Only when you have neither the led suit nor a spade can you play any card.',
    },
    {
      q: 'What are the minimum and maximum calls?',
      a: 'On CardArena every player must call at least 1 trick and at most 8 tricks each round.',
    },
    {
      q: 'Can I play Call Break online for free?',
      a: 'Yes — play Call Break free in your browser against AI opponents of different skill levels, with no download or sign-up required.',
    },
  ],
};
