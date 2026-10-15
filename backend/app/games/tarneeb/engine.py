"""Port of frontend/src/app/games/tarneeb/tarneeb.engine.ts."""

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

MIN_BID = 7
MAX_BID = 13
KABOOT_POINTS = 16
MAX_HANDS = 40


class TarneebEngine(BaseTableEngine):
    slug = "tarneeb"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Tarneeb needs exactly 4 players")
        self.target = int(settings.get("target", 31))
        self.hands: list[list[Card]] = []
        self.phase = "bid"
        self.dealer = 0
        self.bidder: int | None = None
        self.bid = 0
        self.passed = [False, False, False, False]
        self.turn: int | None = None
        self.trump: str | None = None
        self.trick: list[Play] = []
        self.played_count = 0
        self.tricks_won = [0, 0]
        self.points = [0, 0]
        self.hand_number = 0
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * 4)
        self._start_hand()

    def _start_hand(self) -> None:
        self.hand_number += 1
        deck = shuffle(create_standard_deck(), self.rng)
        self.hands = [[], [], [], []]
        for i in range(52):
            self.hands[(self.dealer + 1 + i) % 4].append(deck[i])
        self.phase = "bid"
        self.bidder = None
        self.bid = 0
        self.passed = [False, False, False, False]
        self.trump = None
        self.trick = []
        self.played_count = 0
        self.tricks_won = [0, 0]
        self.turn = (self.dealer + 1) % 4

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] in ("bid", "pass"):
            self._handle_bid(seat, action)
            return
        if action["type"] == "trump":
            self.trump = action["suit"]
            self.phase = "play"
            self.turn = seat
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

    def _handle_bid(self, seat: int, action: Action) -> None:
        if action["type"] == "bid":
            self.bid = int(action["value"])
            self.bidder = seat
        else:
            self.passed[seat] = True
        passes = sum(1 for p in self.passed if p)
        if self.bidder is None and passes == 4:
            if self.hand_number >= MAX_HANDS:
                self.finished = True
                self.turn = None
                return
            self.dealer = (self.dealer + 1) % 4
            self._start_hand()
            return
        if self.bidder is not None and passes == 3:
            self.phase = "trump"
            self.turn = self.bidder
            return
        nxt = (seat + 1) % 4
        while self.passed[nxt]:
            nxt = (nxt + 1) % 4
        self.turn = nxt

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
        self.tricks_won[winner % 2] += 1
        self.played_count += len(self.trick)
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        if self.played_count < 52:
            self.turn = winner
            return
        bt = self.bidder % 2
        ot = 1 - bt
        took = self.tricks_won[bt]
        gain = [0, 0]
        if took >= self.bid:
            gain[bt] = KABOOT_POINTS if self.bid == MAX_BID else took
        else:
            gain[bt] = -self.bid
            gain[ot] = self.tricks_won[ot]
        self.points[0] += gain[0]
        self.points[1] += gain[1]
        self.turn = None
        self.pending_state = "hand"

    def _resolve_hand(self) -> None:
        self.pending_state = None
        a, b = self.points
        if ((a >= self.target or b >= self.target) and a != b) or self.hand_number >= MAX_HANDS:
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
        if self.phase == "bid":
            out: list[Action] = [{"type": "bid", "value": v} for v in range(max(MIN_BID, self.bid + 1), MAX_BID + 1)]
            out.append({"type": "pass"})
            return out
        if self.phase == "trump":
            return [{"type": "trump", "suit": s} for s in SUITS]
        lead = self.trick[0].card.suit if self.trick else None
        return play_actions(follow_suit(self.hands[seat], lead))

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        a, b = self.points
        if a == b:
            return [SeatOutcome(s.id, 1, "draw", self.points[i % 2]) for i, s in enumerate(self.seats)]
        win_team = 0 if a > b else 1
        return [
            SeatOutcome(s.id, 1 if i % 2 == win_team else 2, "win" if i % 2 == win_team else "loss", self.points[i % 2])
            for i, s in enumerate(self.seats)
        ]
