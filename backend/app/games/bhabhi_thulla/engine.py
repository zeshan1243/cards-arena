"""Authoritative Bhabhi Thulla engine. A faithful port of
`frontend/src/app/games/bhabhi-thulla/engine/bhabhi-thulla.engine.ts`."""

from dataclasses import dataclass, field

from app.games.base_game import (
    Card,
    CardGameEngine,
    IllegalMoveError,
    create_standard_deck,
    deal_round_robin,
    seeded_rng,
    shuffle,
)
from app.games.bhabhi_thulla.rules import BhabhiRules, create_rules


@dataclass
class Seat:
    id: str
    name: str
    is_bot: bool
    hand: list[Card] = field(default_factory=list)
    finish_position: int | None = None
    pickups: int = 0


@dataclass
class TrickResult:
    trick_number: int
    outcome: str  # "cleared" | "thulla"
    highest_player_id: str
    picked_up_by: str | None
    escaped: list[str]
    next_leader_id: str | None


class BhabhiThullaEngine(CardGameEngine):
    def __init__(self, seats: list[tuple[str, str, bool]], seed: int, rules: BhabhiRules | None = None) -> None:
        self.rules = rules or create_rules("pakistan", len(seats))
        if len(seats) != self.rules.player_count:
            raise ValueError(f"Rules expect {self.rules.player_count} players, got {len(seats)}")
        self.seed = seed
        self.rng = seeded_rng(seed)
        self.players = [Seat(id=s[0], name=s[1], is_bot=s[2]) for s in seats]
        self.status = "waiting"
        self.current_player_id: str | None = None
        self.trick_number = 0
        self.trick: list[tuple[str, Card]] = []
        self.lead_suit: str | None = None
        self.trick_participants: list[str] = []
        self.awaiting_resolution = False
        self.discarded_count = 0
        self.finish_order: list[str] = []
        self.bhabhi_id: str | None = None
        self.deck: list[Card] = []

    # ------------------------------------------------------------ lifecycle

    def initialize_game(self) -> None:
        self.deck = shuffle(create_standard_deck(), self.rng)
        for seat, hand in zip(self.players, deal_round_robin(self.deck, len(self.players)), strict=True):
            seat.hand = hand
        self.deck = []
        self._start_trick(self.find_starting_player())
        self.status = "playing"

    def find_starting_player(self) -> str:
        if self.rules.open_with_ace_of_spades:
            for p in self.players:
                if any(c.id == "spades-A" for c in p.hand):
                    return p.id
        return self.players[int(self.rng() * len(self.players))].id

    # -------------------------------------------------------------- queries

    def active_players(self) -> list[Seat]:
        return [p for p in self.players if p.finish_position is None and p.hand]

    def get_valid_moves(self, player_id: str) -> list[Card]:
        if self.status != "playing" or self.awaiting_resolution or self.current_player_id != player_id:
            return []
        player = self._player(player_id)
        if self.trick_number == 1 and not self.trick and self.rules.open_with_ace_of_spades:
            ace = [c for c in player.hand if c.id == "spades-A"]
            if ace:
                return ace
        if self.lead_suit is None:
            return list(player.hand)
        following = [c for c in player.hand if c.suit == self.lead_suit]
        return following or list(player.hand)

    def is_game_over(self) -> bool:
        return self.status == "finished"

    def get_winner(self) -> str | None:
        return self.finish_order[0] if self.finish_order else None

    def calculate_score(self) -> dict[str, int]:
        scores: dict[str, int] = {}
        for p in self.players:
            if p.id == self.bhabhi_id:
                scores[p.id] = self.rules.bhabhi_penalty
            elif p.id in self.finish_order:
                idx = self.finish_order.index(p.id)
                points = self.rules.escape_order_points
                scores[p.id] = points[idx] if idx < len(points) else 0
            else:
                scores[p.id] = 0
        return scores

    # -------------------------------------------------------------- actions

    def play_card(self, player_id: str, card_id: str) -> None:
        if self.status != "playing":
            raise IllegalMoveError("Game is not in progress")
        if self.awaiting_resolution:
            raise IllegalMoveError("Trick is being resolved")
        if self.current_player_id != player_id:
            raise IllegalMoveError("Not your turn")
        player = self._player(player_id)
        card = next((c for c in player.hand if c.id == card_id), None)
        if card is None:
            raise IllegalMoveError("You do not hold that card")
        if not any(c.id == card_id for c in self.get_valid_moves(player_id)):
            raise IllegalMoveError("You must follow suit")

        player.hand = [c for c in player.hand if c.id != card_id]
        if self.lead_suit is None:
            self.lead_suit = card.suit
        self.trick.append((player_id, card))
        followed = card.suit == self.lead_suit
        thulla_allowed = self.trick_number > 1 or self.rules.first_trick_thulla

        if (not followed and thulla_allowed) or len(self.trick) == len(self.trick_participants):
            self.awaiting_resolution = True
            self.current_player_id = None
        else:
            self.current_player_id = self.trick_participants[len(self.trick)]

    def resolve_trick(self) -> TrickResult:
        if not self.awaiting_resolution or self.lead_suit is None:
            raise IllegalMoveError("No trick to resolve")
        lead = self.lead_suit
        highest_id, highest_card = self.trick[0]
        for pid, c in self.trick:
            if c.suit == lead and c.value > highest_card.value:
                highest_id, highest_card = pid, c
        last_card = self.trick[-1][1]
        thulla_allowed = self.trick_number > 1 or self.rules.first_trick_thulla
        is_thulla = thulla_allowed and last_card.suit != lead

        picked_up_by = None
        if is_thulla:
            picker = self._player(highest_id)
            picker.hand.extend(c for _, c in self.trick)
            picker.pickups += 1
            picked_up_by = picker.id
        else:
            self.discarded_count += len(self.trick)

        escaped: list[str] = []
        for pid, _ in self.trick:
            p = self._player(pid)
            if p.finish_position is None and not p.hand and pid not in escaped:
                self.finish_order.append(pid)
                p.finish_position = len(self.finish_order)
                escaped.append(pid)

        result = TrickResult(self.trick_number, "thulla" if is_thulla else "cleared", highest_id, picked_up_by, escaped, None)
        self.trick = []
        self.lead_suit = None
        self.awaiting_resolution = False

        if self._check_bhabhi():
            self.status = "finished"
            self.current_player_id = None
        else:
            result.next_leader_id = self._next_leader_after(highest_id)
            self._start_trick(result.next_leader_id)
        return result

    # -------------------------------------------------------------- helpers

    def _check_bhabhi(self) -> bool:
        remaining = self.active_players()
        if len(remaining) > 1:
            return False
        self.bhabhi_id = remaining[0].id if remaining else None
        return True

    def _start_trick(self, leader_id: str) -> None:
        self.trick_number += 1
        self.trick = []
        self.lead_suit = None
        ids = [p.id for p in self.players]
        start = ids.index(leader_id)
        order = ids[start:] + ids[:start]
        active = {p.id for p in self.active_players()}
        self.trick_participants = [pid for pid in order if pid in active]
        self.current_player_id = leader_id

    def _next_leader_after(self, player_id: str) -> str:
        n = len(self.players)
        start = next(i for i, p in enumerate(self.players) if p.id == player_id)
        for i in range(n):
            p = self.players[(start + i) % n]
            if p.finish_position is None and p.hand:
                return p.id
        raise IllegalMoveError("No active players remaining")

    def _player(self, player_id: str) -> Seat:
        for p in self.players:
            if p.id == player_id:
                return p
        raise IllegalMoveError(f"Unknown player {player_id}")


def replay_game(
    seats: list[tuple[str, str, bool]], seed: int, rules: BhabhiRules, moves: list[tuple[str, str]]
) -> BhabhiThullaEngine:
    """Re-run a finished game from its seed and move list, validating every move.

    Raises IllegalMoveError if any move is illegal or the game did not finish.
    """
    engine = BhabhiThullaEngine(seats, seed, rules)
    engine.initialize_game()
    for player_id, card_id in moves:
        if engine.awaiting_resolution:
            engine.resolve_trick()
        engine.play_card(player_id, card_id)
    if engine.awaiting_resolution:
        engine.resolve_trick()
    if not engine.is_game_over():
        raise IllegalMoveError("Game did not finish")
    return engine
