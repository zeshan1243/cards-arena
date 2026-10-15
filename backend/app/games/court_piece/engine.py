"""Port of frontend/src/app/games/court-piece/court-piece.engine.ts."""

from app.games.base_game import SUITS, Card, create_standard_deck, shuffle
from app.games.table.base import (
    Action,
    BaseTableEngine,
    IllegalActionError,
    Play,
    SeatConfig,
    SeatOutcome,
    find_card,
    follow_suit,
    play_actions,
    trick_winner,
)

TRICKS_TO_WIN = 7
COURT_POINTS = 3


class CourtPieceEngine(BaseTableEngine):
    slug = "court-piece"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Court Piece needs exactly 4 players")
        self.target = int(settings.get("target", 5))
        self.hands: list[list[Card]] = []
        self.undealt: list[Card] = []
        self.phase = "trump"
        self.dealer = 0
        self.caller = 0
        self.turn: int | None = None
        self.trump: str | None = None
        self.trick: list[Play] = []
        self.tricks_won = [0, 0]
        self.trick_history: list[int] = []
        self.points = [0, 0]
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * 4)
        self._start_hand()

    def _start_hand(self) -> None:
        self.caller = (self.dealer + 1) % 4
        deck = shuffle(create_standard_deck(), self.rng)
        self.hands = [[], [], [], []]
        for i in range(20):
            self.hands[(self.caller + i) % 4].append(deck[i])
        self.undealt = deck[20:]
        self.phase = "trump"
        self.trump = None
        self.trick = []
        self.tricks_won = [0, 0]
        self.trick_history = []
        self.turn = self.caller

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "trump":
            self.trump = action["suit"]
            for i, c in enumerate(self.undealt):
                self.hands[(self.caller + i) % 4].append(c)
            self.undealt = []
            self.phase = "play"
            self.turn = self.caller
            return
        card = find_card(self.hands[seat], action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = trick_winner(self.trick, self.trump).player_id
            self.pending_state = "trick"
        else:
            self.turn = (seat + 1) % 4

    def pending(self) -> str | None:
        return self.pending_state

    def resolve(self) -> None:
        if self.pending_state == "trick":
            self._resolve_trick()
        elif self.pending_state == "hand":
            self._resolve_hand()
        else:
            raise IllegalActionError("Nothing to resolve")

    def _resolve_trick(self) -> None:
        winner = self.seat_index(self.last_winner)
        team = winner % 2
        self.tricks_won[team] += 1
        self.trick_history.append(team)
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        if self.tricks_won[team] >= TRICKS_TO_WIN:
            court = len(self.trick_history) == TRICKS_TO_WIN and all(t == team for t in self.trick_history)
            self.points[team] += COURT_POINTS if court else 1
            self.turn = None
            self.pending_state = "hand"
            return
        self.turn = winner

    def _resolve_hand(self) -> None:
        self.pending_state = None
        if self.points[0] >= self.target or self.points[1] >= self.target:
            self.finished = True
            self.turn = None
            return
        self.dealer = (self.dealer + 1) % 4
        self._start_hand()

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id:
            return []
        seat = self.seat_index(player_id)
        if self.phase == "trump":
            return [{"type": "trump", "suit": s} for s in SUITS]
        lead = self.trick[0].card.suit if self.trick else None
        return play_actions(follow_suit(self.hands[seat], lead))

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        win_team = 0 if self.points[0] >= self.points[1] else 1
        return [
            SeatOutcome(s.id, 1 if i % 2 == win_team else 2, "win" if i % 2 == win_team else "loss", self.points[i % 2])
            for i, s in enumerate(self.seats)
        ]
