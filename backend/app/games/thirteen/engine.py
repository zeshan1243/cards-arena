"""Port of frontend/src/app/games/thirteen/thirteen.engine.ts and thirteen.rules.ts."""

from dataclasses import dataclass

from app.games.base_game import Card, create_standard_deck, deal_round_robin, shuffle
from app.games.table.base import Action, BaseTableEngine, IllegalActionError, SeatConfig, SeatOutcome

RANK_ORDER = ("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2")
SUIT_ORDER = ("spades", "clubs", "diamonds", "hearts")
TWO = RANK_ORDER.index("2")
SET_TYPES = ("single", "pair", "triple", "quad")


@dataclass(frozen=True)
class Combo:
    type: str
    size: int
    top: int


def rank_index(c: Card) -> int:
    return RANK_ORDER.index(c.rank)


def power(c: Card) -> int:
    return rank_index(c) * 4 + SUIT_ORDER.index(c.suit)


def classify(cards: list[Card]) -> Combo | None:
    n = len(cards)
    if not n:
        return None
    ranks = [rank_index(c) for c in sorted(cards, key=power)]
    top = max(power(c) for c in cards)
    if all(r == ranks[0] for r in ranks):
        return Combo(SET_TYPES[n - 1], n, top) if n <= 4 else None
    if ranks[-1] == TWO:
        return None
    if n >= 3 and all(r == ranks[0] + i for i, r in enumerate(ranks)):
        return Combo("run", n, top)
    if n >= 6 and n % 2 == 0 and all(r == ranks[0] + i // 2 for i, r in enumerate(ranks)):
        return Combo("pairs-run", n, top)
    return None


def beats(play: Combo, table: Combo) -> bool:
    if play.type == table.type and play.size == table.size:
        return play.top > table.top
    pairs = play.size // 2 if play.type == "pairs-run" else 0
    twos = table.top // 4 == TWO
    if twos and table.type == "single":
        return play.type == "quad" or pairs >= 3
    if twos and table.type == "pair":
        return pairs >= 4
    if twos and table.type == "triple":
        return pairs >= 5
    if table.type == "pairs-run" and table.size == 6:
        return play.type == "quad"
    if table.type == "quad":
        return pairs >= 4
    return False


class ThirteenEngine(BaseTableEngine):
    slug = "thirteen"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if not 2 <= len(seats) <= 4:
            raise ValueError("Thirteen needs 2 to 4 players")
        self.n = len(seats)
        self.target = int(settings.get("target", 10))
        self.totals = [0] * self.n
        self.hands: list[list[Card]] = []
        self.hand_number = 0
        self.turn: int | None = None
        self.table: tuple[int, list[Card], Combo] | None = None
        self.passed = [False] * self.n
        self.must_include: str | None = None
        self.finish_order: list[int] = []
        self.next_leader: int | None = None
        self.round_winner: int | None = None
        self.pending_state: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self._start_hand()

    # ------------------------------------------------------------------ flow

    def _start_hand(self) -> None:
        self.hand_number += 1
        deck = shuffle(create_standard_deck(), self.rng)[: 13 * self.n]
        self.hands = deal_round_robin(deck, self.n)
        self.table = None
        self.passed = [False] * self.n
        self.finish_order = []
        if self.next_leader is None:
            lowest = min(deck, key=power)
            self.must_include = lowest.id
            self.turn = next(i for i, h in enumerate(self.hands) if any(c.id == lowest.id for c in h))
        else:
            self.must_include = None
            self.turn = self.next_leader

    def _active(self, seat: int) -> bool:
        return len(self.hands[seat]) > 0

    def validate(self, player_id: str, action: Action) -> None:
        if action.get("type") != "play":
            super().validate(player_id, action)
            return
        hand = {c.id: c for c in self.hands[self.seat_index(player_id)]}
        ids = action.get("cardIds") or []
        if not ids or len(set(ids)) != len(ids) or not all(i in hand for i in ids):
            raise IllegalActionError("Choose cards from your hand")
        combo = classify([hand[i] for i in ids])
        if combo is None:
            raise IllegalActionError("Those cards don't make a combination")
        if self.must_include and self.must_include not in ids:
            raise IllegalActionError("The first play must include the lowest card")
        if self.table and not beats(combo, self.table[2]):
            raise IllegalActionError("That doesn't beat the table")

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "pass":
            self.passed[seat] = True
            self._advance_from(seat)
            return
        ids = action["cardIds"]
        cards = sorted((c for c in self.hands[seat] if c.id in ids), key=power)
        self.hands[seat] = [c for c in self.hands[seat] if c.id not in ids]
        self.table = (seat, cards, classify(cards))
        self.must_include = None
        if not self._active(seat):
            self.finish_order.append(seat)
            left = [s for s in range(self.n) if self._active(s)]
            if len(left) == 1:
                self.finish_order.append(left[0])
                self._end_hand()
                return
        self._advance_from(seat)

    def _advance_from(self, seat: int) -> None:
        last = self.table[0]
        for k in range(1, self.n + 1):
            s = (seat + k) % self.n
            if s == last:
                self._end_round()
                return
            if self._active(s) and not self.passed[s]:
                self.turn = s
                return
        self._end_round()

    def _end_round(self) -> None:
        leader = self.table[0]
        while not self._active(leader):
            leader = (leader + 1) % self.n
        self.round_winner = leader
        self.turn = None
        self.pending_state = "trick"

    def _end_hand(self) -> None:
        for place, seat in enumerate(self.finish_order):
            self.totals[seat] += self.n - 1 - place
        self.next_leader = self.finish_order[0]
        self.turn = None
        self.pending_state = "hand"

    def pending(self) -> str | None:
        return self.pending_state

    def resolve(self) -> None:
        if self.pending_state == "trick":
            self.pending_state = None
            self.table = None
            self.passed = [False] * self.n
            self.turn = self.round_winner
            self.round_winner = None
        elif self.pending_state == "hand":
            self.pending_state = None
            if any(t >= self.target for t in self.totals):
                self.finished = True
                return
            self._start_hand()
        else:
            raise IllegalActionError("Nothing to resolve")

    # --------------------------------------------------------------- queries

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id or not self.table:
            return []
        return [{"type": "pass"}]

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        positions = [1 + sum(1 for o in self.totals if o > t) for t in self.totals]
        worst = max(positions)
        firsts = sum(1 for p in positions if p == 1)

        def result(p: int) -> str:
            if p == 1:
                return "draw" if firsts > 1 else "win"
            return "loss" if p == worst else "safe"

        return [SeatOutcome(s.id, positions[i], result(positions[i]), self.totals[i]) for i, s in enumerate(self.seats)]
