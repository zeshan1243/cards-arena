"""Server-side bot for future multiplayer tables (fills empty seats / disconnected players).

A compact version of the frontend strategy: duck under the current high card,
dump the highest card when last to act, lead low, thulla with high cards.
"""

from collections import Counter

from app.games.base_game import Card
from app.games.bhabhi_thulla.engine import BhabhiThullaEngine


def choose_card(engine: BhabhiThullaEngine, player_id: str) -> Card:
    valid = sorted(engine.get_valid_moves(player_id), key=lambda c: c.value)
    if not valid:
        raise ValueError("No valid moves")
    if len(valid) == 1:
        return valid[0]

    if not engine.trick:
        return valid[0]

    lead = engine.lead_suit
    if valid[0].suit == lead:
        remaining = len(engine.trick_participants) - len(engine.trick) - 1
        if remaining == 0:
            return valid[-1]
        high = max(c.value for _, c in engine.trick if c.suit == lead)
        under = [c for c in valid if c.value < high]
        return under[-1] if under else valid[-1]

    hand = engine._player(player_id).hand
    counts = Counter(c.suit for c in hand)
    return max(valid, key=lambda c: c.value + (6 if counts[c.suit] == 1 else 0))
