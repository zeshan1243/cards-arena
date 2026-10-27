"""Port of frontend/src/app/games/rummy/rummy.engine.ts and rummy.rules.ts."""

from app.games.base_game import Card, create_standard_deck, deal_round_robin, shuffle
from app.games.table.base import Action, BaseTableEngine, IllegalActionError, SeatConfig, SeatOutcome

RANK_ORDER = ("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")
SUIT_ORDER = ("spades", "hearts", "clubs", "diamonds")
MAX_RESHUFFLES = 3


def rank_value(c: Card) -> int:
    return RANK_ORDER.index(c.rank) + 1


def card_points(c: Card) -> int:
    return min(10, rank_value(c))


def classify_meld(cards: list[Card]) -> tuple[str, list[Card]] | None:
    if len(cards) < 3:
        return None
    ordered = sorted(cards, key=lambda c: (rank_value(c), SUIT_ORDER.index(c.suit)))
    if len(cards) <= 4 and all(c.rank == cards[0].rank for c in cards):
        return ("set", ordered)
    if not all(c.suit == cards[0].suit for c in cards):
        return None
    if all(rank_value(c) == rank_value(ordered[0]) + i for i, c in enumerate(ordered)):
        return ("run", ordered)
    return None


def lay_off(meld: tuple[str, list[Card]], cards: list[Card]) -> tuple[str, list[Card]] | None:
    combined = classify_meld(meld[1] + cards)
    return combined if combined and combined[0] == meld[0] else None


class RummyEngine(BaseTableEngine):
    slug = "rummy"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if not 2 <= len(seats) <= 4:
            raise ValueError("Rummy needs 2 to 4 players")
        self.n = len(seats)
        self.target = int(settings.get("target", 100))
        self.totals = [0] * self.n
        self.hands: list[list[Card]] = []
        self.stock: list[Card] = []
        self.discard: list[Card] = []
        self.melds: list[tuple[int, tuple[str, list[Card]]]] = []
        self.hand_number = 0
        self.turn: int | None = None
        self.phase = "draw"
        self.taken_from_discard: str | None = None
        self.reshuffles = 0
        self.pending_state: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self._start_hand()

    # ------------------------------------------------------------------ flow

    def _start_hand(self) -> None:
        self.hand_number += 1
        size = 10 if self.n == 2 else 7
        deck = shuffle(create_standard_deck(), self.rng)
        self.hands = deal_round_robin(deck[: size * self.n], self.n)
        self.stock = deck[size * self.n :]
        self.discard = [self.stock.pop()]
        self.melds = []
        self.reshuffles = 0
        dealer = (self.hand_number - 1) % self.n
        self.turn = (dealer + 1) % self.n
        self.phase = "draw"
        self.taken_from_discard = None

    def _can_draw_stock(self) -> bool:
        return len(self.stock) > 0 or (len(self.discard) > 1 and self.reshuffles < MAX_RESHUFFLES)

    def _lay_off_target(self, cards: list[Card]) -> int:
        for i, (_, meld) in enumerate(self.melds):
            if lay_off(meld, cards) is not None:
                return i
        return -1

    def validate(self, player_id: str, action: Action) -> None:
        kind = action.get("type")
        if kind == "draw":
            super().validate(player_id, action)
            return
        if self.phase != "play":
            raise IllegalActionError("Draw a card first")
        hand = {c.id: c for c in self.hands[self.seat_index(player_id)]}
        ids = [action.get("cardId") or ""] if kind == "discard" else (action.get("cardIds") or [])
        if not ids or len(set(ids)) != len(ids) or not all(i in hand for i in ids):
            raise IllegalActionError("Choose cards from your hand")
        cards = [hand[i] for i in ids]
        if kind == "meld":
            if classify_meld(cards) is None:
                raise IllegalActionError("Not a meld")
        elif kind == "lay-off":
            if self._lay_off_target(cards) < 0:
                raise IllegalActionError("Those cards don't fit any meld")
        elif kind == "discard":
            if ids[0] == self.taken_from_discard and len(hand) > 1:
                raise IllegalActionError("You can't throw back the card you just picked up")
        else:
            raise IllegalActionError(f"Illegal action {kind}")

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        kind = action["type"]
        if kind == "draw":
            if action.get("value") == "discard":
                card = self.discard.pop()
                self.hands[seat].append(card)
                self.taken_from_discard = card.id
            else:
                if not self.stock:
                    self._reshuffle()
                self.hands[seat].append(self.stock.pop())
                self.taken_from_discard = None
            self.phase = "play"
            return
        ids = [action["cardId"]] if kind == "discard" else action["cardIds"]
        cards = [next(c for c in self.hands[seat] if c.id == i) for i in ids]
        self.hands[seat] = [c for c in self.hands[seat] if c.id not in ids]
        if kind == "meld":
            self.melds.append((seat, classify_meld(cards)))
        elif kind == "lay-off":
            i = self._lay_off_target(cards)
            owner, meld = self.melds[i]
            self.melds[i] = (owner, lay_off(meld, cards))
        else:
            self.discard.append(cards[0])
        if not self.hands[seat]:
            self._end_hand(seat)
            return
        if kind == "discard":
            self.turn = (seat + 1) % self.n
            self.phase = "draw"
            self.taken_from_discard = None
            if not self._can_draw_stock():
                self._end_hand(None)

    def _reshuffle(self) -> None:
        top = self.discard.pop()
        self.stock = shuffle(self.discard, self.rng)
        self.discard = [top]
        self.reshuffles += 1

    def _end_hand(self, winner: int | None) -> None:
        self.turn = None
        self.pending_state = "hand"
        if winner is not None:
            self.totals[winner] += sum(card_points(c) for h in self.hands for c in h)

    def pending(self) -> str | None:
        return self.pending_state

    def resolve(self) -> None:
        if self.pending_state != "hand":
            raise IllegalActionError("Nothing to resolve")
        self.pending_state = None
        if any(t >= self.target for t in self.totals):
            self.finished = True
            return
        self._start_hand()

    # --------------------------------------------------------------- queries

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id or self.phase != "draw":
            return []
        out: list[Action] = []
        if self._can_draw_stock():
            out.append({"type": "draw", "value": "stock"})
        if self.discard:
            out.append({"type": "draw", "value": "discard"})
        return out

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
