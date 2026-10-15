"""Port of frontend/src/app/games/baloot/baloot.engine.ts (core Baloot, no projects except Baloot).

See the TypeScript file for the full rules. RNG order: one rng() for the first dealer,
then one shuffle per deal (redeals included). Integers only.
"""

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
)

# Low -> high.
PLAIN_ORDER: tuple[str, ...] = ("7", "8", "9", "J", "Q", "K", "10", "A")
TRUMP_ORDER: tuple[str, ...] = ("7", "8", "Q", "K", "10", "A", "9", "J")

PLAIN_POINTS = {"A": 11, "10": 10, "K": 4, "Q": 3, "J": 2}
TRUMP_POINTS = {"J": 20, "9": 14, "A": 11, "10": 10, "K": 4, "Q": 3}

LAST_TRICK_BONUS = 10
BALOOT_BONUS = 2
MAX_DEALS = 250


def card_points(card: Card, trump: str | None) -> int:
    return (TRUMP_POINTS if card.suit == trump else PLAIN_POINTS).get(card.rank, 0)


def rank_index(card: Card, trump: str | None) -> int:
    return (TRUMP_ORDER if card.suit == trump else PLAIN_ORDER).index(card.rank)


def baloot_trick_winner(plays: list[Play], trump: str | None) -> Play:
    best = plays[0]
    for p in plays[1:]:
        p_trump = trump is not None and p.card.suit == trump
        best_trump = trump is not None and best.card.suit == trump
        if p_trump and not best_trump:
            best = p
        elif p.card.suit == best.card.suit and rank_index(p.card, trump) > rank_index(best.card, trump):
            best = p
    return best


def hand_value(contract: str) -> int:
    return 26 if contract == "sun" else 16


def buyer_game_points(raw: int, contract: str) -> int:
    return (raw * 2 + 5) // 10 if contract == "sun" else (raw + 5) // 10


def score_contract(buyer_raw: int, contract: str) -> tuple[int, int, bool]:
    total = hand_value(contract)
    buyer = buyer_game_points(buyer_raw, contract)
    made = buyer * 2 > total
    return (buyer, total - buyer, True) if made else (0, total, False)


def legal_cards(hand: list[Card], trick: list[Play], trump: str | None, partner_winning: bool) -> list[Card]:
    if not trick:
        return list(hand)
    lead = trick[0].card.suit
    trumps = [] if trump is None else [c for c in hand if c.suit == trump]
    top_trump = max([rank_index(p.card, trump) for p in trick if p.card.suit == trump], default=-1)

    def trump_choices() -> list[Card]:
        over = [c for c in trumps if rank_index(c, trump) > top_trump]
        return over or trumps

    if lead == trump:
        return trump_choices() if trumps else list(hand)
    same = [c for c in hand if c.suit == lead]
    if same:
        return same
    if not trumps:
        return list(hand)
    if partner_winning:
        return [c for c in hand if c.suit != trump] + trump_choices()
    return trump_choices()


class BalootEngine(BaseTableEngine):
    slug = "baloot"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Baloot needs exactly 4 players")
        self.target = int(settings.get("target", 101))
        self.hands: list[list[Card]] = [[], [], [], []]
        self.stock: list[Card] = []
        self.buyer_card: Card | None = None
        self.phase = "bid"
        self.dealer = 0
        self.bid_round = 1
        self.bid_count = 0
        self.hokm_bidder: int | None = None
        self.hokm_suit: str | None = None
        self.contract: str | None = None
        self.trump: str | None = None
        self.buyer: int | None = None
        self.turn: int | None = None
        self.trick: list[Play] = []
        self.played_count = 0
        self.raw = [0, 0]
        self.kq = [0, 0, 0, 0]
        self.baloot_teams: list[int] = []
        self.points = [0, 0]
        self.deals = 0
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False
        self.winner = 0

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * 4)
        self._start_deal()

    # ------------------------------------------------------------------ flow

    def _start_deal(self) -> None:
        self.deals += 1
        deck = shuffle(create_short_deck(), self.rng)
        self.hands = [[], [], [], []]
        for i in range(20):
            self.hands[(self.dealer + 1 + i) % 4].append(deck[i])
        self.buyer_card = deck[20]
        self.stock = deck[21:]
        self.phase = "bid"
        self.bid_round = 1
        self.bid_count = 0
        self.hokm_bidder = None
        self.hokm_suit = None
        self.contract = None
        self.trump = None
        self.buyer = None
        self.trick = []
        self.played_count = 0
        self.raw = [0, 0]
        self.kq = [0, 0, 0, 0]
        self.baloot_teams = []
        self.turn = (self.dealer + 1) % 4

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        kind = action["type"]
        if self.phase == "bid":
            if kind == "choose" and action.get("value") == "sun":
                self._buy(seat, "sun", None)
                return
            if kind == "choose" and action.get("value") == "hokm":
                self.hokm_bidder = seat
                self.hokm_suit = self.buyer_card.suit
            elif kind == "trump":
                self.hokm_bidder = seat
                self.hokm_suit = action["suit"]
            self.bid_count += 1
            if self.bid_count < 4:
                self.turn = (seat + 1) % 4
                return
            if self.hokm_bidder is not None:
                self._buy(self.hokm_bidder, "hokm", self.hokm_suit)
                return
            if self.bid_round == 1:
                self.bid_round = 2
                self.bid_count = 0
                self.turn = (self.dealer + 1) % 4
                return
            self.dealer = (self.dealer + 1) % 4
            if self.deals >= MAX_DEALS:
                self._finish()
                return
            self._start_deal()
            return

        card = find_card(self.hands[seat], action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        if self.trump is not None and card.suit == self.trump and card.rank in ("K", "Q"):
            self.kq[seat] |= 1 if card.rank == "K" else 2
            if self.kq[seat] == 3:
                self.baloot_teams.append(seat % 2)
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = baloot_trick_winner(self.trick, self.trump).player_id
            self.pending_state = "trick"
        else:
            self.turn = (seat + 1) % 4

    def _buy(self, seat: int, contract: str, trump: str | None) -> None:
        self.contract = contract
        self.trump = trump
        self.buyer = seat
        for i in range(4):
            s = (self.dealer + 1 + i) % 4
            if s == seat:
                self.hands[s].append(self.buyer_card)
                self.hands[s].extend(self.stock[:2])
                self.stock = self.stock[2:]
            else:
                self.hands[s].extend(self.stock[:3])
                self.stock = self.stock[3:]
        self.buyer_card = None
        self.phase = "play"
        self.turn = (self.dealer + 1) % 4

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
        for p in self.trick:
            self.raw[team] += card_points(p.card, self.trump)
        self.played_count += len(self.trick)
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        if self.played_count < 32:
            self.turn = winner
            return
        self.raw[team] += LAST_TRICK_BONUS
        self._score_hand()

    def _score_hand(self) -> None:
        bt = self.buyer % 2
        buyer, defenders, _made = score_contract(self.raw[bt], self.contract)
        gained = [0, 0]
        gained[bt] = buyer
        gained[1 - bt] = defenders
        for t in self.baloot_teams:
            gained[t] += BALOOT_BONUS
        self.points[0] += gained[0]
        self.points[1] += gained[1]
        self.turn = None
        self.pending_state = "hand"

    def _resolve_hand(self) -> None:
        self.pending_state = None
        a, b = self.points
        if (a >= self.target or b >= self.target) and a != b:
            self._finish()
            return
        self.dealer = (self.dealer + 1) % 4
        if self.deals >= MAX_DEALS:
            self._finish()
            return
        self._start_deal()

    def _finish(self) -> None:
        self.finished = True
        self.turn = None
        self.winner = 0 if self.points[0] >= self.points[1] else 1

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
            out: list[Action] = [{"type": "choose", "value": "sun"}]
            if self.hokm_bidder is None:
                bs = self.buyer_card.suit
                if self.bid_round == 1:
                    out.append({"type": "choose", "value": "hokm"})
                else:
                    out.extend({"type": "trump", "suit": s} for s in SUITS if s != bs)
            out.append({"type": "pass"})
            return out
        partner_winning = bool(self.trick) and (
            baloot_trick_winner(self.trick, self.trump).player_id == self.seats[(seat + 2) % 4].id
        )
        return play_actions(legal_cards(self.hands[seat], self.trick, self.trump, partner_winning))

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        if self.finished:
            win_team = self.winner
        else:
            win_team = 0 if self.points[0] >= self.points[1] else 1
        return [
            SeatOutcome(s.id, 1 if i % 2 == win_team else 2, "win" if i % 2 == win_team else "loss", self.points[i % 2])
            for i, s in enumerate(self.seats)
        ]
