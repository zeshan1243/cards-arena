"""Shared card primitives. Must stay bit-for-bit compatible with frontend `games/core/deck.ts`
so the server can replay games that were played in the browser."""

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass

SUITS = ("spades", "hearts", "clubs", "diamonds")
RANKS = ("2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A")

_MASK = 0xFFFFFFFF


@dataclass(frozen=True)
class Card:
    suit: str
    rank: str

    @property
    def id(self) -> str:
        return f"{self.suit}-{self.rank}"

    @property
    def value(self) -> int:
        return RANKS.index(self.rank) + 2


def seeded_rng(seed: int) -> Callable[[], float]:
    """mulberry32, matching the TypeScript implementation exactly."""
    state = seed & _MASK

    def rng() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & _MASK
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & _MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & _MASK)) & _MASK)) & _MASK
        return ((t ^ (t >> 14)) & _MASK) / 4294967296

    return rng


def create_standard_deck() -> list[Card]:
    return [Card(s, r) for s in SUITS for r in RANKS]


def shuffle[T](items: list[T], rng: Callable[[], float]) -> list[T]:
    out = list(items)
    for i in range(len(out) - 1, 0, -1):
        j = int(rng() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out


def deal_round_robin(deck: list[Card], seats: int) -> list[list[Card]]:
    hands: list[list[Card]] = [[] for _ in range(seats)]
    for i, card in enumerate(deck):
        hands[i % seats].append(card)
    return hands


class IllegalMoveError(Exception):
    pass


class CardGameEngine(ABC):
    """Interface every server-side game engine implements (spec §15)."""

    @abstractmethod
    def initialize_game(self) -> None: ...

    @abstractmethod
    def get_valid_moves(self, player_id: str) -> list[Card]: ...

    @abstractmethod
    def play_card(self, player_id: str, card_id: str) -> None: ...

    @abstractmethod
    def is_game_over(self) -> bool: ...

    @abstractmethod
    def calculate_score(self) -> dict[str, int]: ...

    @abstractmethod
    def get_winner(self) -> str | None: ...
