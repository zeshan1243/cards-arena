"""Every Python table-game engine must reproduce the TypeScript engine exactly.

Fixtures come from `node scripts/export-replays.mjs <game-folder>` in frontend/.
"""

import json
from pathlib import Path

import pytest

from app.games.registry import create_engine, supported
from app.games.table.base import IllegalActionError, SeatConfig, replay

FIXTURES = sorted((Path(__file__).parent / "fixtures" / "replays").glob("*.json"))
CASES = [(f.stem, i, g) for f in FIXTURES for i, g in enumerate(json.loads(f.read_text()))]


def _run(game: dict, actions=None):
    seats = [SeatConfig(s["id"], s["name"], s["isBot"]) for s in game["seats"]]
    engine = create_engine(game["slug"], seats, game["seed"], game["settings"])
    acts = [(a["playerId"], a["action"]) for a in (actions if actions is not None else game["actions"])]
    return replay(engine, acts)


@pytest.mark.parametrize("slug,index,game", CASES, ids=[f"{s}-{i}" for s, i, _ in CASES])
def test_python_engine_matches_typescript(slug, index, game):
    assert supported(slug), f"No Python engine registered for {slug}"
    engine = _run(game)
    got = [{"id": o.id, "position": o.position, "result": o.result, "score": o.score} for o in engine.outcome()]
    assert got == game["outcome"]


@pytest.mark.parametrize("slug", sorted({c[0] for c in CASES}))
def test_tampered_actions_are_rejected(slug):
    game = next(g for s, _, g in CASES if s == slug)
    with pytest.raises(IllegalActionError):
        _run(game, game["actions"][:-1])  # truncated: game never finishes
    swapped = list(game["actions"])
    # Moving a later action earlier makes it someone else's turn.
    swapped[0], swapped[1] = swapped[1], swapped[0]
    if swapped[0]["playerId"] != swapped[1]["playerId"]:
        with pytest.raises(IllegalActionError):
            _run(game, swapped)
