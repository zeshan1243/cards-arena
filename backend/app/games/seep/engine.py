"""Port of frontend/src/app/games/seep/seep.engine.ts.

Seep (Sweep): a fishing game for 2 players, or 4 in partnerships (seats 0 & 2 vs 1 & 3).
See the TypeScript engine for the full rules. Legal-action generation (including option
ordering and caps) mirrors the TypeScript code exactly.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.games.base_game import Card, create_standard_deck, shuffle
from app.games.table.base import (
    Action,
    BaseTableEngine,
    IllegalActionError,
    SeatConfig,
    SeatOutcome,
    find_card,
)

VALUES = {"A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13}
SEEP_BONUS = 50
MAX_REDEALS = 20
CAPTURE_CAP = 8
BUILD_CAP = 6
ADD_CAP = 6


def card_value(c: Card) -> int:
    return VALUES[c.rank]


def card_points(c: Card) -> int:
    if c.suit == "spades":
        return VALUES[c.rank]
    if c.rank == "A":
        return 1
    if c.suit == "diamonds" and c.rank == "10":
        return 6
    return 0


def sum_subsets(values: list[int], target: int) -> list[list[int]]:
    """All index lists (ascending, lexicographic DFS order) whose values sum to `target`."""
    out: list[list[int]] = []
    chosen: list[int] = []

    def dfs(start: int, remaining: int) -> None:
        if remaining == 0:
            out.append(list(chosen))
            return
        for i in range(start, len(values)):
            if values[i] <= remaining:
                chosen.append(i)
                dfs(i + 1, remaining - values[i])
                chosen.pop()

    dfs(0, target)
    return out


@dataclass
class FloorItem:
    id: str
    cards: list[Card]
    value: int
    house: bool
    pakka: bool
    owner: int | None


@dataclass
class PlayOption:
    kind: str
    card: Card
    items: list[int]
    house: int
    total: int
    value: str


def _loose_item(c: Card) -> FloorItem:
    return FloorItem(c.id, [c], card_value(c), False, False, None)


class SeepEngine(BaseTableEngine):
    slug = "seep"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) not in (2, 4):
            raise ValueError("Seep needs 2 or 4 players")
        self.n = len(seats)
        self.rounds = 2 if int(settings.get("rounds", 1)) == 2 else 1
        self.hands: list[list[Card]] = []
        self.stock: list[Card] = []
        self.floor: list[FloorItem] = []
        self.captured: list[list[Card]] = [[], []]
        self.seeps = [0, 0]
        self.totals = [0, 0]
        self.phase = "bid"
        self.dealer = 0
        self.bidder = 0
        self.bid: int | None = None
        self.bid_play = False
        self.turn: int | None = None
        self.last_capturer: int | None = None
        self.house_seq = 0
        self.deal_number = 0
        self.pending_state: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * self.n)
        self._start_deal()

    # ------------------------------------------------------------------ flow

    def _start_deal(self) -> None:
        self.deal_number += 1
        self.bidder = (self.dealer + 1) % self.n
        deck = shuffle(create_standard_deck(), self.rng)
        attempts = 1
        while not any(card_value(c) >= 9 for c in deck[:4]):
            if attempts >= MAX_REDEALS:
                j = next(i for i, c in enumerate(deck) if i >= 4 and card_value(c) >= 9)
                deck[3], deck[j] = deck[j], deck[3]
                break
            deck = shuffle(create_standard_deck(), self.rng)
            attempts += 1
        self.hands = [[] for _ in range(self.n)]
        self.hands[self.bidder] = deck[:4]
        self.stock = deck[4:]
        self.floor = []
        self.captured = [[], []]
        self.seeps = [0, 0]
        self.last_capturer = None
        self.bid = None
        self.bid_play = False
        self.phase = "bid"
        self.turn = self.bidder

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "bid":
            self.bid = int(action["value"])
            for c in self.stock[:4]:
                self.floor.append(_loose_item(c))
            self.stock = self.stock[4:]
            self.hands[self.bidder].extend(self.stock[:8])
            self.stock = self.stock[8:]
            for k in range(1, self.n):
                s = (self.bidder + k) % self.n
                self.hands[s].extend(self.stock[:12])
                self.stock = self.stock[12:]
            self.phase = "play"
            self.bid_play = True
            self.turn = self.bidder
            return

        card = find_card(self.hands[seat], action.get("cardId"))
        opt = next((o for o in self._options(seat) if o.card.id == card.id and o.value == action.get("value")), None)
        if opt is None:
            raise IllegalActionError("Illegal play")
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        last_play = len(self.stock) == 0 and all(len(h) == 0 for h in self.hands)
        side = seat % 2

        if opt.kind == "capture":
            taken = set(opt.items)
            cards = [card]
            for i, f in enumerate(self.floor):
                if i in taken:
                    cards.extend(f.cards)
            self.floor = [f for i, f in enumerate(self.floor) if i not in taken]
            self.captured[side].extend(cards)
            self.last_capturer = seat
            if len(self.floor) == 0 and not last_play:
                self.seeps[side] += 1
        elif opt.kind == "build":
            used = set(opt.items)
            cards = []
            for i, f in enumerate(self.floor):
                if i in used:
                    cards.extend(f.cards)
            cards.append(card)
            self.floor = [f for i, f in enumerate(self.floor) if i not in used]
            self.house_seq += 1
            self.floor.append(FloorItem(f"house-{self.house_seq}", cards, opt.total, True, False, seat))
        elif opt.kind == "add":
            used = set(opt.items)
            h = self.floor[opt.house]
            for i, f in enumerate(self.floor):
                if i in used:
                    h.cards.extend(f.cards)
            h.cards.append(card)
            if opt.total == h.value:
                h.pakka = True
            else:
                h.value = opt.total
            h.owner = seat
            self.floor = [f for i, f in enumerate(self.floor) if i not in used]
        else:
            self.floor.append(_loose_item(card))
        self.bid_play = False

        if all(len(hh) == 0 for hh in self.hands):
            if self.stock:
                for k in range(self.n):
                    s = (self.bidder + k) % self.n
                    self.hands[s].extend(self.stock[:12])
                    self.stock = self.stock[12:]
                self.turn = (seat + 1) % self.n
            else:
                self._end_deal(seat)
        else:
            self.turn = (seat + 1) % self.n

    def _end_deal(self, last_seat: int) -> None:
        if self.floor:
            to = self.last_capturer if self.last_capturer is not None else last_seat
            for f in self.floor:
                self.captured[to % 2].extend(f.cards)
            self.floor = []
        pts = self._deal_points()
        for t in (0, 1):
            self.totals[t] += pts[t]
        self.turn = None
        self.pending_state = "hand"

    def _deal_points(self) -> list[int]:
        return [sum(card_points(c) for c in self.captured[t]) + SEEP_BONUS * self.seeps[t] for t in (0, 1)]

    def pending(self) -> str | None:
        return self.pending_state

    def resolve(self) -> None:
        if self.pending_state != "hand":
            raise IllegalActionError("Nothing to resolve")
        self.pending_state = None
        if self.deal_number >= self.rounds:
            self.finished = True
            self.turn = None
            return
        self.dealer = (self.dealer + 1) % self.n
        self._start_deal()

    # ----------------------------------------------------------- legal plays

    def _keeps_houses(self, seat: int, rest: list[Card], removed: list[int], extra: list[int]) -> bool:
        gone = set(removed)
        need = [f.value for i, f in enumerate(self.floor) if f.house and f.owner == seat and i not in gone]
        need.extend(extra)
        return all(any(card_value(c) == v for c in rest) for v in need)

    def _loose_indices(self) -> list[int]:
        return [i for i, f in enumerate(self.floor) if not f.house]

    def _has_house(self, value: int, except_idx: int) -> bool:
        return any(i != except_idx and f.house and f.value == value for i, f in enumerate(self.floor))

    def _ids(self, items: list[int]) -> str:
        return ",".join(self.floor[i].id for i in items)

    def _capture_options(self, seat: int, card: Card, rest: list[Card]) -> list[PlayOption]:
        v = card_value(card)
        eligible = [i for i, f in enumerate(self.floor) if not f.house or f.value == v]
        subs = [[eligible[k] for k in s] for s in sum_subsets([self.floor[i].value for i in eligible], v)]
        subs = [items for items in subs if self._keeps_houses(seat, rest, items, [])]

        def has_house(items: list[int]) -> int:
            return 1 if any(self.floor[i].house for i in items) else 0

        subs.sort(key=lambda items: (-has_house(items), -len(items), items))
        return [PlayOption("capture", card, items, -1, v, f"capture:{self._ids(items)}") for items in subs[:CAPTURE_CAP]]

    def _build_options(self, seat: int, card: Card, rest: list[Card], only: int | None) -> list[PlayOption]:
        v = card_value(card)
        loose = self._loose_indices()
        found: list[tuple[int, list[int]]] = []
        for total in range(9, 14):
            if only is not None and total != only:
                continue
            if self._has_house(total, -1):
                continue
            need = total - v
            if need < 1:
                continue
            for s in sum_subsets([self.floor[i].value for i in loose], need):
                items = [loose[k] for k in s]
                if self._keeps_houses(seat, rest, items, [total]):
                    found.append((total, items))
        found.sort(key=lambda f: (f[0], -len(f[1]), f[1]))
        return [PlayOption("build", card, items, -1, total, f"build:{total}:{self._ids(items)}") for total, items in found[:BUILD_CAP]]

    def _add_options(self, seat: int, card: Card, rest: list[Card]) -> list[PlayOption]:
        v = card_value(card)
        loose = self._loose_indices()
        found: list[tuple[int, int, list[int]]] = []
        for hi, h in enumerate(self.floor):
            if not h.house:
                continue
            targets = [h.value]
            if not h.pakka:
                for t in range(h.value + 1, 14):
                    if not self._has_house(t, hi):
                        targets.append(t)
            for total in targets:
                need = h.value - v if total == h.value else total - h.value - v
                if need < 0:
                    continue
                for s in sum_subsets([self.floor[i].value for i in loose], need):
                    items = [loose[k] for k in s]
                    if self._keeps_houses(seat, rest, [*items, hi], [total]):
                        found.append((hi, total, items))
        found.sort(key=lambda f: (f[0], f[1], -len(f[2]), f[2]))
        return [
            PlayOption("add", card, items, house, total, f"add:{self.floor[house].id}:{total}:{self._ids(items)}")
            for house, total, items in found[:ADD_CAP]
        ]

    def _options(self, seat: int) -> list[PlayOption]:
        hand = self.hands[seat]
        out: list[PlayOption] = []
        owns_house = any(f.house and f.owner == seat for f in self.floor)
        for card in hand:
            v = card_value(card)
            rest = [c for c in hand if c.id != card.id]
            if self.bid_play:
                if v == self.bid:
                    out.extend(self._capture_options(seat, card, rest))
                out.extend(self._build_options(seat, card, rest, self.bid))
                continue
            out.extend(self._capture_options(seat, card, rest))
            out.extend(self._build_options(seat, card, rest, None))
            out.extend(self._add_options(seat, card, rest))
            if not owns_house:
                out.append(PlayOption("throw", card, [], -1, v, "throw"))
        if self.bid_play and not out:
            for card in hand:
                if card_value(card) == self.bid:
                    out.append(PlayOption("throw", card, [], -1, self.bid, "throw"))
        return out

    # --------------------------------------------------------------- queries

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id:
            return []
        seat = self.seat_index(player_id)
        if self.phase == "bid":
            return [
                {"type": "bid", "value": v}
                for v in range(9, 14)
                if any(card_value(c) == v for c in self.hands[seat])
            ]
        return [{"type": "play", "cardId": o.card.id, "value": o.value} for o in self._options(seat)]

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        a, b = self.totals
        draw = a == b
        win = 0 if a > b else 1
        return [
            SeatOutcome(
                s.id,
                1 if draw or i % 2 == win else 2,
                "draw" if draw else ("win" if i % 2 == win else "loss"),
                self.totals[i % 2],
            )
            for i, s in enumerate(self.seats)
        ]
