"""Server-side engines for replaying table games, keyed by game slug.

Modules are imported lazily so one broken engine can't take the others down.
Each module exposes `create(seats, seed, settings) -> BaseTableEngine`.
"""

import importlib

from app.games.table.base import BaseTableEngine, SeatConfig

ENGINES: dict[str, str] = {
    "court-piece": "app.games.court_piece.engine:CourtPieceEngine",
    "hokm": "app.games.hokm.engine:HokmEngine",
    "29": "app.games.twenty_nine.engine:TwentyNineEngine",
    "seep": "app.games.seep.engine:SeepEngine",
    "call-break": "app.games.call_break.engine:CallBreakEngine",
    "tarneeb": "app.games.tarneeb.engine:TarneebEngine",
    "baloot": "app.games.baloot.engine:BalootEngine",
    "spades": "app.games.spades.engine:SpadesEngine",
    "hearts": "app.games.hearts.engine:HeartsEngine",
    "thirteen": "app.games.thirteen.engine:ThirteenEngine",
}


def create_engine(slug: str, seats: list[SeatConfig], seed: int, settings: dict) -> BaseTableEngine:
    module_name, cls_name = ENGINES[slug].split(":")
    cls = getattr(importlib.import_module(module_name), cls_name)
    return cls(seats, seed, settings)


def supported(slug: str) -> bool:
    return slug in ENGINES
