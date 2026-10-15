"""Port of frontend/src/app/games/twenty-nine/twenty-nine.engine.ts (game logic only)."""

from app.games.base_game import SUITS, Card, shuffle
from app.games.table.base import (
    Action,
    BaseTableEngine,
    IllegalActionError,
    Play,
    SeatConfig,
    SeatOutcome,
    create_short_deck,
    find_card,
    play_actions,
    trick_winner,
)

# Low -> high.
TWENTY_NINE_ORDER: tuple[str, ...] = ("7", "8", "Q", "K", "10", "A", "9", "J")
CARD_POINTS = {"J": 3, "9": 2, "A": 1, "10": 1}
MIN_BID = 16
MAX_BID = 28
PAIR_SHIFT = 4


def card_points(c: Card) -> int:
    return CARD_POINTS.get(c.rank, 0)


class TwentyNineEngine(BaseTableEngine):
    slug = "29"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("29 needs exactly 4 players")
        self.match_target = int(settings.get("target", 3))
        self.pair_rule = str(settings.get("pair", "on")) == "on"
        self.hands: list[list[Card]] = []
        self.undealt: list[Card] = []
        self.phase = "bid"
        self.dealer = 0
        self.turn: int | None = None
        self.bids: list = [None, None, None, None]
        self.high_bid: int | None = None
        self.high_bidder: int | None = None
        self.bidder: int | None = None
        self.target: int | None = None
        self.trump: str | None = None
        self.trump_revealed = False
        self.must_trump: int | None = None
        self.pair_team: int | None = None
        self.trick: list[Play] = []
        self.tricks_played = 0
        self.card_pts = [0, 0]
        self.game_pts = [0, 0]
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * 4)
        self._start_hand()

    def _start_hand(self) -> None:
        deck = shuffle(create_short_deck(), self.rng)
        first = (self.dealer + 1) % 4
        self.hands = [[], [], [], []]
        for i in range(16):
            self.hands[(first + i) % 4].append(deck[i])
        self.undealt = deck[16:]
        self.phase = "bid"
        self.bids = [None, None, None, None]
        self.high_bid = None
        self.high_bidder = None
        self.bidder = None
        self.target = None
        self.trump = None
        self.trump_revealed = False
        self.must_trump = None
        self.pair_team = None
        self.trick = []
        self.tricks_played = 0
        self.card_pts = [0, 0]
        self.turn = first

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        kind = action["type"]

        if kind in ("bid", "pass"):
            if kind == "bid":
                value = int(action["value"])
                self.bids[seat] = value
                self.high_bid = value
                self.high_bidder = seat
            else:
                self.bids[seat] = "pass"
            active = [i for i in range(4) if self.bids[i] != "pass"]
            if self.high_bid == MAX_BID or (len(active) == 1 and self.high_bid is not None):
                self.bidder = self.high_bidder
                self.target = self.high_bid
                self.phase = "trump"
                self.turn = self.bidder
                return
            nxt = (seat + 1) % 4
            while self.bids[nxt] == "pass":
                nxt = (nxt + 1) % 4
            self.turn = nxt
            return

        if kind == "trump":
            self.trump = action["suit"]
            first = (self.dealer + 1) % 4
            for i, c in enumerate(self.undealt):
                self.hands[(first + i) % 4].append(c)
            self.undealt = []
            self.phase = "play"
            self.turn = first
            return

        if kind == "reveal-trump":
            self.trump_revealed = True
            self.must_trump = seat
            return

        card = find_card(self.hands[seat], action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        self.must_trump = None
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = trick_winner(self.trick, self._effective_trump(), TWENTY_NINE_ORDER).player_id
            self.pending_state = "trick"
        else:
            self.turn = (seat + 1) % 4

    def _effective_trump(self) -> str | None:
        return self.trump if self.trump_revealed else None

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
        self.card_pts[team] += sum(card_points(p.card) for p in self.trick)
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        self.tricks_played += 1

        if self.pair_rule and self.trump_revealed and self.pair_team is None:
            for s in (team, team + 2):
                hand = self.hands[s]
                has_k = any(c.suit == self.trump and c.rank == "K" for c in hand)
                has_q = any(c.suit == self.trump and c.rank == "Q" for c in hand)
                if has_k and has_q:
                    self.pair_team = team
                    bid_team = self.bidder % 2
                    if team == bid_team:
                        self.target = max(MIN_BID, self.target - PAIR_SHIFT)
                    else:
                        self.target = min(MAX_BID, self.target + PAIR_SHIFT)
                    break

        if self.tricks_played == 8:
            bid_team = self.bidder % 2
            made = self.card_pts[bid_team] >= self.target
            self.game_pts[bid_team] += 1 if made else -1
            self.turn = None
            self.pending_state = "hand"
            return
        self.turn = winner

    def _resolve_hand(self) -> None:
        self.pending_state = None
        if self._match_over():
            self.finished = True
            self.turn = None
            return
        self.dealer = (self.dealer + 1) % 4
        self._start_hand()

    def _match_over(self) -> bool:
        return any(p >= self.match_target or p <= -self.match_target for p in self.game_pts)

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def _forced_bid(self) -> bool:
        return self.high_bid is None and sum(1 for b in self.bids if b == "pass") == 3

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id:
            return []
        seat = self.seat_index(player_id)
        if self.phase == "bid":
            lo = MIN_BID if self.high_bid is None else self.high_bid + 1
            out: list[Action] = [{"type": "bid", "value": v} for v in range(lo, MAX_BID + 1)]
            if not self._forced_bid():
                out.append({"type": "pass"})
            return out
        if self.phase == "trump":
            return [{"type": "trump", "suit": s} for s in SUITS]
        hand = self.hands[seat]
        if self.must_trump == seat:
            trumps = [c for c in hand if c.suit == self.trump]
            return play_actions(trumps or hand)
        lead = self.trick[0].card.suit if self.trick else None
        if lead is None:
            return play_actions(hand)
        same = [c for c in hand if c.suit == lead]
        if same:
            return play_actions(same)
        out = play_actions(hand)
        if not self.trump_revealed:
            out.insert(0, {"type": "reveal-trump"})
        return out

    def is_game_over(self) -> bool:
        return self.finished

    def _winning_team(self) -> int:
        a, b = self.game_pts
        t = self.match_target
        if a >= t:
            return 0
        if b >= t:
            return 1
        if a <= -t:
            return 1
        if b <= -t:
            return 0
        return 0 if a >= b else 1

    def outcome(self) -> list[SeatOutcome]:
        win_team = self._winning_team()
        return [
            SeatOutcome(s.id, 1 if i % 2 == win_team else 2, "win" if i % 2 == win_team else "loss", self.game_pts[i % 2])
            for i, s in enumerate(self.seats)
        ]
