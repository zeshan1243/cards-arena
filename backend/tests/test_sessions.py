from tests.conftest import finish_payload, find_seed, register

API = "/api/v1"


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def start(client, token) -> str:
    res = await client.post(f"{API}/sessions", json={"gameSlug": "bhabhi-thulla", "mode": "ai", "settings": {"difficulty": "hard"}}, headers=auth(token))
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


async def test_games_catalog(client):
    res = await client.get(f"{API}/games")
    games = res.json()["data"]
    assert games[0]["slug"] == "bhabhi-thulla" and games[0]["isAvailable"] is True
    assert (await client.get(f"{API}/games/bhabhi-thulla/rules")).json()["data"]["core"]
    assert (await client.get(f"{API}/games/nope")).status_code == 404


async def test_unavailable_game_and_multiplayer_rejected(client, token, db):
    from sqlalchemy import update

    from app.models import Game

    await db.execute(update(Game).where(Game.slug == "hearts").values(is_available=False))
    await db.commit()
    res = await client.post(f"{API}/sessions", json={"gameSlug": "hearts"}, headers=auth(token))
    assert res.status_code == 400
    res = await client.post(f"{API}/sessions", json={"gameSlug": "bhabhi-thulla", "mode": "multiplayer"}, headers=auth(token))
    assert res.status_code == 400


async def test_finish_win_updates_stats_xp_and_achievements(client, token):
    seed, engine, moves = find_seed(lambda e: e.get_winner() == "you")
    sid = await start(client, token)
    res = await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed, moves), headers=auth(token))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["result"] == "win" and data["position"] == 1
    assert data["score"] == 15
    # +10 played, +30 won, +100 First Victory
    assert data["xpAwarded"] == 140
    assert [a["code"] for a in data["achievementsUnlocked"]] == ["first_victory"]
    assert data["level"] == 2 and data["leveledUp"] is True

    stats = (await client.get(f"{API}/statistics/me", headers=auth(token))).json()["data"]
    assert stats["totals"] == {"gamesPlayed": 1, "gamesWon": 1, "gamesLost": 0, "winRate": 100.0}
    assert stats["games"][0]["bestScore"] == 15
    assert stats["user"]["xp"] == 140

    history = (await client.get(f"{API}/statistics/me/history", headers=auth(token))).json()["data"]
    assert history[0]["result"] == "win"
    assert [p["name"] for p in history[0]["players"]] == ["ahmed", "Ayesha", "Bilal", "Sana"]

    session = (await client.get(f"{API}/sessions/{sid}", headers=auth(token))).json()["data"]
    assert session["status"] == "finished" and len(session["players"]) == 4


async def test_finish_as_bhabhi_counts_loss(client, token):
    seed, _, moves = find_seed(lambda e: e.bhabhi_id == "you")
    sid = await start(client, token)
    data = (await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed, moves), headers=auth(token))).json()["data"]
    assert data["result"] == "loss" and data["score"] == -10 and data["xpAwarded"] == 10
    stats = (await client.get(f"{API}/statistics/me", headers=auth(token))).json()["data"]
    assert stats["totals"]["gamesLost"] == 1


async def test_server_rejects_tampered_game(client, token):
    seed, _, moves = find_seed(lambda e: e.get_winner() == "you")
    sid = await start(client, token)
    res = await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed + 1, moves), headers=auth(token))
    assert res.status_code == 400
    assert res.json()["message"].startswith("Game could not be verified")
    payload = finish_payload(seed, moves)
    payload["seats"][1]["isBot"] = False
    assert (await client.post(f"{API}/sessions/{sid}/finish", json=payload, headers=auth(token))).status_code == 400


async def test_cannot_finish_twice_or_touch_other_users_session(client, token):
    seed, _, moves = find_seed(lambda e: True)
    sid = await start(client, token)
    assert (await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed, moves), headers=auth(token))).status_code == 200
    assert (await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed, moves), headers=auth(token))).status_code == 409
    other = await register(client, "ali")
    assert (await client.get(f"{API}/sessions/{sid}", headers=auth(other))).status_code == 404


async def test_leave_cancels_session(client, token):
    sid = await start(client, token)
    res = await client.post(f"{API}/sessions/{sid}/leave", headers=auth(token))
    assert res.json()["data"]["status"] == "cancelled"


async def test_leaderboard_and_public_profile(client, token):
    seed, _, moves = find_seed(lambda e: e.get_winner() == "you")
    sid = await start(client, token)
    await client.post(f"{API}/sessions/{sid}/finish", json=finish_payload(seed, moves), headers=auth(token))
    await register(client, "ali")  # no XP: not ranked

    for period in ("all", "daily", "weekly", "monthly"):
        board = (await client.get(f"{API}/leaderboard", params={"period": period})).json()["data"]
        assert [r["username"] for r in board] == ["ahmed"], period
        assert board[0]["xp"] == 140 and board[0]["gamesWon"] == 1
    by_game = (await client.get(f"{API}/leaderboard", params={"game": "bhabhi-thulla"})).json()["data"]
    assert by_game[0]["username"] == "ahmed"

    public = (await client.get(f"{API}/users/ahmed/statistics")).json()["data"]
    assert public["user"]["email"] is None and public["totals"]["gamesWon"] == 1
    hits = (await client.get(f"{API}/users/search", params={"q": "ah"})).json()["data"]
    assert hits[0]["username"] == "ahmed"


async def test_update_avatar(client, token):
    res = await client.put(f"{API}/users/me", json={"avatarUrl": "🦊"}, headers=auth(token))
    assert res.json()["data"]["avatarUrl"] == "🦊"


async def test_finish_table_game_via_replay(client, token):
    import json
    from pathlib import Path

    game = json.loads((Path(__file__).parent / "fixtures" / "replays" / "court-piece.json").read_text())[0]
    res = await client.post(f"{API}/sessions", json={"gameSlug": "court-piece"}, headers=auth(token))
    sid = res.json()["data"]["id"]
    payload = {
        "seed": game["seed"],
        "seats": game["seats"],
        "selfSeatId": "you",
        "settings": game["settings"],
        "actions": game["actions"],
    }
    data = (await client.post(f"{API}/sessions/{sid}/finish", json=payload, headers=auth(token))).json()
    assert data["success"], data
    expected = next(o for o in game["outcome"] if o["id"] == "you")
    assert data["data"]["result"] == expected["result"]
    assert data["data"]["score"] == expected["score"]

    # Tampering is rejected.
    sid2 = (await client.post(f"{API}/sessions", json={"gameSlug": "court-piece"}, headers=auth(token))).json()["data"]["id"]
    payload["actions"] = payload["actions"][:-4]
    res = await client.post(f"{API}/sessions/{sid2}/finish", json=payload, headers=auth(token))
    assert res.status_code == 400
