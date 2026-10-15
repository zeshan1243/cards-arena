"""Port of frontend/src/app/games/hearts/hearts.engine.ts."""

from app.games.base_game import Card, create_standard_deck, deal_round_robin, shuffle
from app.games.table.base import (
    Action,
    BaseTableEngine,
    IllegalActionError,
    Play,
    SeatConfig,
    SeatOutcome,
    play_actions,
    trick_winner,
)

PASS_CYCLE = ("left", "right", "across", "hold")
PASS_OFFSET = {"left": 1, "right": 3, "across": 2, "hold": 0}
QUEEN_ID = "spades-Q"
TWO_CLUBS_ID = "clubs-2"
MOON_POINTS = 26


def card_points(c: Card) -> int:
    if c.suit == "hearts":
        return 1
    return 13 if c.id == QUEEN_ID else 0


class HeartsEngine(BaseTableEngine):
    slug = "hearts"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Hearts needs exactly 4 players")
        self.target = int(settings.get("target", 50))
        self.hands: list[list[Card]] = []
        self.phase = "pass"
        self.hand_number = 0
        self.passes: list[list[Card] | None] = [None, None, None, None]
        self.turn: int | None = None
        self.trick: list[Play] = []
        self.tricks_played = 0
        self.hearts_broken = False
        self.hand_points = [0, 0, 0, 0]
        self.hearts_taken = [0, 0, 0, 0]
        self.queen_taker: int | None = None
        self.totals = [0, 0, 0, 0]
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self._start_hand()

    def pass_direction(self) -> str:
        return PASS_CYCLE[(self.hand_number - 1) % 4]

    # ------------------------------------------------------------------ flow

    def _start_hand(self) -> None:
        self.hand_number += 1
        self.hands = deal_round_robin(shuffle(create_standard_deck(), self.rng), 4)
        self.passes = [None, None, None, None]
        self.trick = []
        self.tricks_played = 0
        self.hearts_broken = False
        self.hand_points = [0, 0, 0, 0]
        self.hearts_taken = [0, 0, 0, 0]
        self.queen_taker = None
        if self.pass_direction() == "hold":
            self._start_play()
        else:
            self.phase = "pass"
            self.turn = 0

    def _start_play(self) -> None:
        self.phase = "play"
        self.turn = next(i for i, h in enumerate(self.hands) if any(c.id == TWO_CLUBS_ID for c in h))

    def validate(self, player_id: str, action: Action) -> None:
        if self.phase == "pass" and action.get("type") == "pass-cards":
            ids = action.get("cardIds") or []
            hand = self.hands[self.seat_index(player_id)]
            held = {c.id for c in hand}
            if len(ids) != 3 or len(set(ids)) != 3 or not all(i in held for i in ids):
                raise IllegalActionError("Choose exactly 3 cards from your hand to pass")
            return
        super().validate(player_id, action)

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "pass-cards":
            ids = action["cardIds"]
            self.passes[seat] = [next(c for c in self.hands[seat] if c.id == i) for i in ids]
            self.hands[seat] = [c for c in self.hands[seat] if c.id not in ids]
            if seat < 3:
                self.turn = seat + 1
                return
            offset = PASS_OFFSET[self.pass_direction()]
            for s in range(4):
                self.hands[(s + offset) % 4].extend(self.passes[s])
            self._start_play()
            return
        card = next(c for c in self.hands[seat] if c.id == action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        if card.suit == "hearts":
            self.hearts_broken = True
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = trick_winner(self.trick, None).player_id
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
        for p in self.trick:
            self.hand_points[winner] += card_points(p.card)
            if p.card.suit == "hearts":
                self.hearts_taken[winner] += 1
            if p.card.id == QUEEN_ID:
                self.queen_taker = winner
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        self.tricks_played += 1
        if self.tricks_played < 13:
            self.turn = winner
            return
        self._end_hand()

    def _end_hand(self) -> None:
        shooter = None
        for s in range(4):
            if self.hearts_taken[s] == 13 and self.queen_taker == s:
                shooter = s
        if shooter is None:
            gained = list(self.hand_points)
        else:
            gained = [0 if s == shooter else MOON_POINTS for s in range(4)]
        for s in range(4):
            self.totals[s] += gained[s]
        self.turn = None
        self.pending_state = "hand"

    def _resolve_hand(self) -> None:
        self.pending_state = None
        if any(t >= self.target for t in self.totals):
            self.finished = True
            self.turn = None
            return
        self._start_hand()

    # --------------------------------------------------------------- queries

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id or self.phase != "play":
            return []
        return play_actions(self._valid_cards(self.seat_index(player_id)))

    def _valid_cards(self, seat: int) -> list[Card]:
        hand = self.hands[seat]
        first_trick = self.tricks_played == 0
        if not self.trick:
            if first_trick:
                return [c for c in hand if c.id == TWO_CLUBS_ID]
            if not self.hearts_broken:
                non_hearts = [c for c in hand if c.suit != "hearts"]
                if non_hearts:
                    return non_hearts
            return list(hand)
        lead = self.trick[0].card.suit
        same = [c for c in hand if c.suit == lead]
        if same:
            return same
        if first_trick:
            clean = [c for c in hand if card_points(c) == 0]
            if clean:
                return clean
        return list(hand)

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        positions = [1 + sum(1 for o in self.totals if o < t) for t in self.totals]
        worst = max(positions)
        firsts = sum(1 for p in positions if p == 1)

        def result(p: int) -> str:
            if p == 1:
                return "draw" if firsts > 1 else "win"
            return "loss" if p == worst else "safe"

        return [SeatOutcome(s.id, positions[i], result(positions[i]), self.totals[i]) for i, s in enumerate(self.seats)]
