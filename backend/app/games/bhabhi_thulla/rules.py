from dataclasses import dataclass, field
from typing import Literal

Variant = Literal["pakistan", "india", "custom"]


@dataclass(frozen=True)
class BhabhiRules:
    variant: Variant
    player_count: int
    open_with_ace_of_spades: bool
    first_trick_thulla: bool
    escape_order_points: list[int] = field(default_factory=list)
    bhabhi_penalty: int = -10


def create_rules(variant: Variant = "pakistan", player_count: int = 4) -> BhabhiRules:
    """Mirror of frontend `createRules`."""
    if not 3 <= player_count <= 6:
        raise ValueError("Bhabhi Thulla supports 3 to 6 players")
    points = [(player_count - 1 - i) * 5 for i in range(player_count - 1)]
    if variant == "pakistan":
        return BhabhiRules(variant, player_count, True, False, points)
    if variant == "india":
        return BhabhiRules(variant, player_count, True, True, points)
    if variant == "custom":
        return BhabhiRules(variant, player_count, False, True, points)
    raise ValueError(f"Unknown variant {variant}")
