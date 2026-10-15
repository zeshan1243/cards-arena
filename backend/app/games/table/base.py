"""Python mirror of frontend `games/core/table-game.ts` + `tricks.ts`.

Each game engine here is a line-for-line port of its TypeScript engine, so a game
played in the browser can be replayed from (seed, settings, seats, actions) and the
server computes the result itself. Keep RNG usage, integer maths and tie-breaking
identical to the TypeScript code.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.games.base_game import RANKS, SUITS, Card, IllegalMoveError, seeded_rng

Action = dict[str, Any]

STANDARD_ORDER: tuple[str, ...] = RANKS
SHORT_RANKS: tuple[str, ...] = ("7", "8", "9", "10", "J", "Q", "K", "A")


class IllegalActionError(IllegalMoveError):
    pass


@dataclass(frozen=True)
class SeatConfig:
    id: str
    name: str
    is_bot: bool


@dataclass(frozen=True)
class Play:
    player_id: str
    card: Card


def create_short_deck(ranks: tuple[str, ...] = SHORT_RANKS) -> list[Card]:
    return [Card(s, r) for s in SUITS for r in ranks]


def trick_winner(plays: list[Play], trump: str | None, order: tuple[str, ...] = STANDARD_ORDER) -> Play:
    best = plays[0]
    for p in plays[1:]:
        p_trump = trump is not None and p.card.suit == trump
        best_trump = trump is not None and best.card.suit == trump
        if p_trump and not best_trump:
            best = p
        elif p.card.suit == best.card.suit and order.index(p.card.rank) > order.index(best.card.rank):
            best = p
    return best


def follow_suit(hand: list[Card], lead_suit: str | None) -> list[Card]:
    if lead_suit is None:
        return list(hand)
    same = [c for c in hand if c.suit == lead_suit]
    return same or list(hand)


def play_actions(cards: list[Card]) -> list[Action]:
    return [{"type": "play", "cardId": c.id} for c in cards]


def clean(action: Action) -> Action:
    out: Action = {"type": action["type"]}
    for key in ("cardId", "cardIds", "value", "suit"):
        if action.get(key) is not None:
            out[key] = action[key]
    return out


def same_action(a: Action, b: Action) -> bool:
    return (
        a.get("type") == b.get("type")
        and a.get("cardId") == b.get("cardId")
        and a.get("value") == b.get("value")
        and a.get("suit") == b.get("suit")
        and json.dumps(sorted(a.get("cardIds") or [])) == json.dumps(sorted(b.get("cardIds") or []))
    )


def find_card(hand: list[Card], card_id: str | None) -> Card:
    for c in hand:
        if c.id == card_id:
            return c
    raise IllegalActionError("You do not hold that card")


@dataclass
class SeatOutcome:
    id: str
    position: int
    result: str  # win | loss | draw | safe
    score: int


class BaseTableEngine(ABC):
    slug: str = ""

    def __init__(self, seats: list[SeatConfig], seed: int) -> None:
        self.seats = seats
        self.seed = seed
        self.rng = seeded_rng(seed)
        self.log: list[tuple[str, Action]] = []

    @abstractmethod
    def initialize_game(self) -> None: ...

    @abstractmethod
    def current_player_id(self) -> str | None: ...

    @abstractmethod
    def legal_actions(self, player_id: str) -> list[Action]: ...

    @abstractmethod
    def handle(self, player_id: str, action: Action) -> None: ...

    @abstractmethod
    def pending(self) -> str | None: ...

    @abstractmethod
    def resolve(self) -> None: ...

    @abstractmethod
    def is_game_over(self) -> bool: ...

    @abstractmethod
    def outcome(self) -> list[SeatOutcome]: ...

    def apply(self, player_id: str, action: Action) -> None:
        if self.current_player_id() != player_id:
            raise IllegalActionError("Not your turn")
        self.validate(player_id, action)
        self.log.append((player_id, clean(action)))
        self.handle(player_id, action)

    def validate(self, player_id: str, action: Action) -> None:
        if not any(same_action(a, action) for a in self.legal_actions(player_id)):
            raise IllegalActionError(f"Illegal action {action.get('type')}")

    def seat_index(self, player_id: str) -> int:
        for i, s in enumerate(self.seats):
            if s.id == player_id:
                return i
        raise IllegalActionError(f"Unknown player {player_id}")


def replay(engine: BaseTableEngine, actions: list[tuple[str, Action]]) -> BaseTableEngine:
    """Re-run a game from its action log, validating every action. Raises IllegalActionError."""
    engine.initialize_game()
    for player_id, action in actions:
        while engine.pending():
            engine.resolve()
        engine.apply(player_id, action)
    while engine.pending():
        engine.resolve()
    if not engine.is_game_over():
        raise IllegalActionError("Game did not finish")
    return engine
