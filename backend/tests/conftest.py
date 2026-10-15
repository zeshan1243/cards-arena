import os
import random
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.api import auth as auth_api
from app.core.database import Base, get_db
from app.core.seed import ACHIEVEMENTS, GAMES
from app.games.bhabhi_thulla.bot import choose_card
from app.games.bhabhi_thulla.engine import BhabhiThullaEngine
from app.games.bhabhi_thulla.rules import create_rules
from app.main import app
from app.models import Achievement, Game

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", f"postgresql+asyncpg://{os.getenv('USER', 'postgres')}@localhost:5432/cardarena_test"
)


@pytest.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def db(engine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    async with factory() as session:
        session.add_all([Game(**g) for g in GAMES] + [Achievement(**a) for a in ACHIEVEMENTS])
        await session.commit()

    async def override() -> AsyncIterator[AsyncSession]:
        async with factory() as s:
            yield s

    app.dependency_overrides[get_db] = override
    auth_api.login_limiter.reset()
    auth_api.register_limiter.reset()
    async with factory() as session:
        yield session
    app.dependency_overrides.clear()


@pytest.fixture
async def client(db) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def register(client: AsyncClient, username: str = "ahmed", password: str = "supersecret") -> str:
    res = await client.post(
        "/api/v1/auth/register", json={"username": username, "email": f"{username}@example.com", "password": password}
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["accessToken"]


@pytest.fixture
async def token(client) -> str:
    return await register(client)


SEATS = [("you", "Ahmed", False), ("bot-ayesha", "Ayesha", True), ("bot-bilal", "Bilal", True), ("bot-sana", "Sana", True)]


def simulate_game(seed: int, variant: str = "pakistan", seats=SEATS) -> tuple[BhabhiThullaEngine, list[tuple[str, str]]]:
    """Play a whole game with bots in every seat and return the engine and move list."""
    engine = BhabhiThullaEngine(list(seats), seed, create_rules(variant, len(seats)))
    engine.initialize_game()
    moves = []
    while not engine.is_game_over():
        if engine.awaiting_resolution:
            engine.resolve_trick()
            continue
        pid = engine.current_player_id
        card = choose_card(engine, pid)
        engine.play_card(pid, card.id)
        moves.append((pid, card.id))
    return engine, moves


def find_seed(predicate, variant: str = "pakistan") -> tuple[int, BhabhiThullaEngine, list[tuple[str, str]]]:
    rnd = random.Random(1234)
    for _ in range(500):
        seed = rnd.randrange(2**31)
        engine, moves = simulate_game(seed, variant)
        if predicate(engine):
            return seed, engine, moves
    raise RuntimeError("No seed found")


def finish_payload(seed: int, moves, variant: str = "pakistan", seats=SEATS) -> dict:
    return {
        "seed": seed,
        "variant": variant,
        "selfSeatId": "you",
        "seats": [{"id": s[0], "name": s[1], "isBot": s[2]} for s in seats],
        "moves": [{"playerId": p, "cardId": c} for p, c in moves],
    }
