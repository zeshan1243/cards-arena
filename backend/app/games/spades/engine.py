"""Port of frontend/src/app/games/spades/spades.engine.ts (rules only, no view/bot)."""

from app.games.base_game import Card, create_standard_deck, shuffle
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

NIL_BONUS = 100
BAG_LIMIT = 10
BAG_PENALTY = 100
LOSS_FLOOR = -200
MAX_HANDS = 50


def score_team(bids: list[int], tricks: list[int], seats: list[int], bags_before: int) -> tuple[int, int]:
    """Returns (delta, bags_after) for one team. Mirrors `scoreTeam`."""
    contract = 0
    team_tricks = 0
    nil_points = 0
    for s in seats:
        team_tricks += tricks[s]
        if bids[s] == 0:
            nil_points += NIL_BONUS if tricks[s] == 0 else -NIL_BONUS
        else:
            contract += bids[s]
    contract_points = 0
    new_bags = 0
    if contract > 0:
        if team_tricks >= contract:
            new_bags = team_tricks - contract
            contract_points = 10 * contract + new_bags
        else:
            contract_points = -10 * contract
    bags = bags_before + new_bags
    penalties = 0
    while bags >= BAG_LIMIT:
        bags -= BAG_LIMIT
        penalties += 1
    return contract_points + nil_points - BAG_PENALTY * penalties, bags


def match_result(scores: list[int], bags: list[int], target: int, hands_played: int):
    """0 / 1 = winning team, "draw", or None to keep playing. Mirrors `matchResult`."""
    over = any(s >= target or s <= LOSS_FLOOR for s in scores) or hands_played >= MAX_HANDS
    if not over:
        return None
    if scores[0] != scores[1]:
        return 0 if scores[0] > scores[1] else 1
    if hands_played < MAX_HANDS:
        return None
    if bags[0] != bags[1]:
        return 0 if bags[0] < bags[1] else 1
    return "draw"


class SpadesEngine(BaseTableEngine):
    slug = "spades"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Spades needs exactly 4 players")
        self.target = int(settings.get("target", 300))
        self.hands: list[list[Card]] = []
        self.phase = "bid"
        self.dealer = 0
        self.turn: int | None = None
        self.bids: list[int | None] = [None, None, None, None]
        self.tricks_taken = [0, 0, 0, 0]
        self.trick: list[Play] = []
        self.broken = False
        self.scores = [0, 0]
        self.bags = [0, 0]
        self.hand_number = 0
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False
        self.result = None

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
        self.bids = [None, None, None, None]
        self.tricks_taken = [0, 0, 0, 0]
        self.trick = []
        self.broken = False
        self.turn = (self.dealer + 1) % 4

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "bid":
            self.bids[seat] = int(action["value"])
            if all(b is not None for b in self.bids):
                self.phase = "play"
                self.turn = (self.dealer + 1) % 4
            else:
                self.turn = (seat + 1) % 4
            return
        card = find_card(self.hands[seat], action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        if card.suit == "spades":
            self.broken = True
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = trick_winner(self.trick, "spades").player_id
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
        self.tricks_taken[winner] += 1
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        if not self.hands[winner]:
            self._end_hand()
            return
        self.turn = winner

    def _end_hand(self) -> None:
        bids = [b or 0 for b in self.bids]
        for t in (0, 1):
            delta, bags = score_team(bids, self.tricks_taken, [t, t + 2], self.bags[t])
            self.scores[t] += delta
            self.bags[t] = bags
        self.result = match_result(self.scores, self.bags, self.target, self.hand_number)
        self.turn = None
        self.pending_state = "hand"

    def _resolve_hand(self) -> None:
        self.pending_state = None
        if self.result is not None:
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
            return [{"type": "bid", "value": v} for v in range(14)]
        return play_actions(self._playable(seat))

    def _playable(self, seat: int) -> list[Card]:
        hand = self.hands[seat]
        if not self.trick:
            if self.broken:
                return list(hand)
            non_spades = [c for c in hand if c.suit != "spades"]
            return non_spades or list(hand)
        return follow_suit(hand, self.trick[0].card.suit)

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        if self.result == "draw":
            return [SeatOutcome(s.id, 1, "draw", self.scores[i % 2]) for i, s in enumerate(self.seats)]
        win_team = self.result
        if win_team is None:
            win_team = 0 if self.scores[0] >= self.scores[1] else 1
        return [
            SeatOutcome(s.id, 1 if i % 2 == win_team else 2, "win" if i % 2 == win_team else "loss", self.scores[i % 2])
            for i, s in enumerate(self.seats)
        ]
