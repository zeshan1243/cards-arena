"""The Python engine must reach exactly the same outcome as the TypeScript engine
for games played in the browser. Regenerate the fixture with
`npm run export-replays` in frontend/."""

import json
from pathlib import Path

import pytest

from app.games.bhabhi_thulla.engine import replay_game
from app.games.bhabhi_thulla.rules import create_rules

GAMES = json.loads((Path(__file__).parent / "fixtures" / "ts_replays.json").read_text())


@pytest.mark.parametrize("game", GAMES, ids=[f"{g['variant']}-{len(g['seats'])}p-{g['seed']}" for g in GAMES])
def test_python_replay_matches_typescript(game):
    seats = [(s["id"], s["name"], s["isBot"]) for s in game["seats"]]
    engine = replay_game(
        seats, game["seed"], create_rules(game["variant"], len(seats)), [(m["playerId"], m["cardId"]) for m in game["moves"]]
    )
    assert engine.finish_order == game["finishOrder"]
    assert engine.bhabhi_id == game["bhabhiId"]
    assert engine.trick_number == game["tricks"]
    assert engine.calculate_score() == game["scores"]
