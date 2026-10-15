import pytest

from app.games.base_game import IllegalMoveError, create_standard_deck, seeded_rng
from app.games.bhabhi_thulla.engine import BhabhiThullaEngine, replay_game
from app.games.bhabhi_thulla.rules import create_rules
from tests.conftest import SEATS, simulate_game


def new_engine(seed: int = 7, variant: str = "pakistan", seats=SEATS) -> BhabhiThullaEngine:
    e = BhabhiThullaEngine(list(seats), seed, create_rules(variant, len(seats)))
    e.initialize_game()
    return e


def test_rng_matches_javascript_mulberry32():
    # Values produced by the frontend implementation (games/core/deck.ts) for seed 1 and 42.
    r = seeded_rng(1)
    assert [r() for _ in range(2)] == [0.6270739405881613, 0.002735721180215478]
    r = seeded_rng(42)
    assert [r() for _ in range(2)] == [0.6011037519201636, 0.44829055899754167]


def test_deck_contains_52_cards():
    deck = create_standard_deck()
    assert len(deck) == 52
    assert len({c.id for c in deck}) == 52


def test_cards_are_dealt_correctly():
    e = new_engine()
    hands = [p.hand for p in e.players]
    assert [len(h) for h in hands] == [13, 13, 13, 13]
    assert len({c.id for h in hands for c in h}) == 52


def test_ace_of_spades_holder_starts():
    e = new_engine()
    holder = next(p for p in e.players if any(c.id == "spades-A" for c in p.hand))
    assert e.current_player_id == holder.id
    assert [c.id for c in e.get_valid_moves(holder.id)] == ["spades-A"]


def test_invalid_move_is_rejected():
    e = new_engine()
    other = next(p for p in e.players if p.id != e.current_player_id)
    with pytest.raises(IllegalMoveError, match="Not your turn"):
        e.play_card(other.id, other.hand[0].id)
    with pytest.raises(IllegalMoveError, match="do not hold"):
        e.play_card(e.current_player_id, next(c.id for c in other.hand))


def test_valid_move_is_accepted_and_turn_changes():
    e = new_engine()
    first = e.current_player_id
    e.play_card(first, "spades-A")
    assert e.current_player_id != first
    assert e.trick[0][1].id == "spades-A"


def test_must_follow_suit():
    e = new_engine()
    e.play_card(e.current_player_id, "spades-A")
    nxt = e._player(e.current_player_id)
    if any(c.suit == "spades" for c in nxt.hand):
        off = next((c for c in nxt.hand if c.suit != "spades"), None)
        if off:
            with pytest.raises(IllegalMoveError, match="follow suit"):
                e.play_card(nxt.id, off.id)


@pytest.mark.parametrize("variant", ["pakistan", "india", "custom"])
def test_game_ends_correctly(variant):
    for seed in range(1, 40):
        e, _ = simulate_game(seed, variant)
        assert e.is_game_over()
        in_hands = sum(len(p.hand) for p in e.players)
        assert in_hands + e.discarded_count == 52
        if e.bhabhi_id:
            assert len(e.finish_order) == len(e.players) - 1
            assert e.bhabhi_id not in e.finish_order


def test_winner_is_calculated():
    e, _ = simulate_game(11)
    assert e.get_winner() == e.finish_order[0]
    scores = e.calculate_score()
    assert scores[e.finish_order[0]] == 15
    if e.bhabhi_id:
        assert scores[e.bhabhi_id] == -10


def test_replay_reproduces_game():
    e, moves = simulate_game(99)
    replayed = replay_game(list(SEATS), 99, create_rules("pakistan", 4), moves)
    assert replayed.finish_order == e.finish_order
    assert replayed.bhabhi_id == e.bhabhi_id


def test_replay_rejects_tampered_moves():
    _, moves = simulate_game(99)
    with pytest.raises(IllegalMoveError):
        replay_game(list(SEATS), 100, create_rules("pakistan", 4), moves)  # wrong seed
    with pytest.raises(IllegalMoveError):
        replay_game(list(SEATS), 99, create_rules("pakistan", 4), moves[:-3])  # truncated
    swapped = list(moves)
    swapped[5], swapped[6] = swapped[6], swapped[5]
    with pytest.raises(IllegalMoveError):
        replay_game(list(SEATS), 99, create_rules("pakistan", 4), swapped)
