"""Port of frontend/src/app/games/call-break/call-break.engine.ts (game logic only, no view/bot)."""

from app.games.base_game import RANKS, Card, create_standard_deck, shuffle
from app.games.table.base import (
    Action,
    BaseTableEngine,
    IllegalActionError,
    Play,
    SeatConfig,
    SeatOutcome,
    find_card,
    play_actions,
    trick_winner,
)

TRUMP = "spades"
MIN_CALL = 1
MAX_CALL = 8


def _rank_idx(c: Card) -> int:
    return RANKS.index(c.rank)


def _highest_of(trick: list[Play], suit: str) -> Card | None:
    best: Card | None = None
    for p in trick:
        if p.card.suit == suit and (best is None or _rank_idx(p.card) > _rank_idx(best)):
            best = p.card
    return best


def legal_cards(hand: list[Card], trick: list[Play]) -> list[Card]:
    if not trick:
        return list(hand)
    lead = trick[0].card.suit
    same = [c for c in hand if c.suit == lead]
    if same:
        if lead != TRUMP and _highest_of(trick, TRUMP) is not None:
            return same
        top = _highest_of(trick, lead)
        beaters = [c for c in same if _rank_idx(c) > _rank_idx(top)]
        return beaters or same
    spades = [c for c in hand if c.suit == TRUMP]
    if spades:
        top = _highest_of(trick, TRUMP)
        if top is None:
            return spades
        beaters = [c for c in spades if _rank_idx(c) > _rank_idx(top)]
        return beaters or spades
    return list(hand)


def round_score(call: int, won: int) -> int:
    return call * 10 + (won - call) if won >= call else -call * 10


class CallBreakEngine(BaseTableEngine):
    slug = "call-break"

    def __init__(self, seats: list[SeatConfig], seed: int, settings: dict) -> None:
        super().__init__(seats, seed)
        if len(seats) != 4:
            raise ValueError("Call Break needs exactly 4 players")
        self.rounds = 5 if int(settings.get("rounds", 3)) == 5 else 3
        self.hands: list[list[Card]] = [[], [], [], []]
        self.phase = "bid"
        self.dealer = 0
        self.turn: int | None = None
        self.calls: list[int | None] = [None, None, None, None]
        self.won = [0, 0, 0, 0]
        self.trick: list[Play] = []
        self.round_scores: list[list[int]] = []
        self.totals = [0, 0, 0, 0]
        self.round = 0
        self.pending_state: str | None = None
        self.last_winner: str | None = None
        self.finished = False

    def initialize_game(self) -> None:
        self.dealer = int(self.rng() * 4)
        self._start_round()

    def _start_round(self) -> None:
        self.round += 1
        deck = shuffle(create_standard_deck(), self.rng)
        self.hands = [[], [], [], []]
        for i in range(52):
            self.hands[(self.dealer + 1 + i) % 4].append(deck[i])
        self.phase = "bid"
        self.calls = [None, None, None, None]
        self.won = [0, 0, 0, 0]
        self.trick = []
        self.turn = (self.dealer + 1) % 4

    def handle(self, player_id: str, action: Action) -> None:
        seat = self.seat_index(player_id)
        if action["type"] == "bid":
            self.calls[seat] = int(action["value"])
            if all(c is not None for c in self.calls):
                self.phase = "play"
                self.turn = (self.dealer + 1) % 4
            else:
                self.turn = (seat + 1) % 4
            return
        card = find_card(self.hands[seat], action.get("cardId"))
        self.hands[seat] = [c for c in self.hands[seat] if c.id != card.id]
        self.trick.append(Play(player_id, card))
        if len(self.trick) == 4:
            self.turn = None
            self.last_winner = trick_winner(self.trick, TRUMP).player_id
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
        self.won[winner] += 1
        self.trick = []
        self.last_winner = None
        self.pending_state = None
        if all(len(h) == 0 for h in self.hands):
            scores = [round_score(self.calls[i], self.won[i]) for i in range(4)]
            self.round_scores.append(scores)
            for i in range(4):
                self.totals[i] += scores[i]
            self.turn = None
            self.pending_state = "hand"
            return
        self.turn = winner

    def _resolve_hand(self) -> None:
        self.pending_state = None
        if self.round >= self.rounds:
            self.finished = True
            self.turn = None
            return
        self.dealer = (self.dealer + 1) % 4
        self._start_round()

    def current_player_id(self) -> str | None:
        if self.pending_state or self.finished or self.turn is None:
            return None
        return self.seats[self.turn].id

    def legal_actions(self, player_id: str) -> list[Action]:
        if self.current_player_id() != player_id:
            return []
        seat = self.seat_index(player_id)
        if self.phase == "bid":
            return [{"type": "bid", "value": v} for v in range(MIN_CALL, MAX_CALL + 1)]
        return play_actions(legal_cards(self.hands[seat], self.trick))

    def is_game_over(self) -> bool:
        return self.finished

    def outcome(self) -> list[SeatOutcome]:
        positions = [1 + sum(1 for o in self.totals if o > t) for t in self.totals]
        worst = max(positions)
        top_count = sum(1 for p in positions if p == 1)
        out: list[SeatOutcome] = []
        for i, s in enumerate(self.seats):
            pos = positions[i]
            if pos == 1:
                result = "draw" if top_count > 1 else "win"
            elif pos == worst:
                result = "loss"
            else:
                result = "safe"
            out.append(SeatOutcome(s.id, pos, result, self.totals[i]))
        return out
