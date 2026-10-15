from tests.conftest import register

API = "/api/v1/auth"


async def test_register_returns_token_user_and_refresh_cookie(client):
    res = await client.post(f"{API}/register", json={"username": "ahmed", "email": "a@example.com", "password": "supersecret"})
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True and body["message"] is None
    assert body["data"]["user"]["username"] == "ahmed"
    assert body["data"]["user"]["level"] == 1
    assert "passwordHash" not in body["data"]["user"]
    assert "cardarena_refresh" in res.cookies
    assert "httponly" in res.headers["set-cookie"].lower()


async def test_duplicate_username_conflicts(client):
    await register(client, "ahmed")
    res = await client.post(f"{API}/register", json={"username": "AHMED", "email": "other@example.com", "password": "supersecret"})
    assert res.status_code == 409
    assert res.json() == {"success": False, "data": None, "message": "Username is already taken"}


async def test_validation_errors_use_envelope(client):
    res = await client.post(f"{API}/register", json={"username": "a", "email": "nope", "password": "short"})
    assert res.status_code == 422
    assert res.json()["success"] is False


async def test_login_with_username_or_email(client):
    await register(client, "ahmed", "supersecret")
    for login in ("ahmed", "AHMED@example.com"):
        res = await client.post(f"{API}/login", json={"login": login, "password": "supersecret"})
        assert res.status_code == 200, res.text
    bad = await client.post(f"{API}/login", json={"login": "ahmed", "password": "wrong-password"})
    assert bad.status_code == 401


async def test_me_requires_token(client, token):
    assert (await client.get(f"{API}/me")).status_code == 401
    res = await client.get(f"{API}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.json()["data"]["username"] == "ahmed"
    assert (await client.get(f"{API}/me", headers={"Authorization": "Bearer junk"})).status_code == 401


async def test_refresh_rotates_and_logout_revokes(client):
    await register(client)
    old_cookie = client.cookies.get("cardarena_refresh")
    res = await client.post(f"{API}/refresh")
    assert res.status_code == 200
    assert res.json()["data"]["accessToken"]
    new_cookie = client.cookies.get("cardarena_refresh")
    assert new_cookie != old_cookie

    # The rotated-out token can no longer be used.
    client.cookies.set("cardarena_refresh", old_cookie, path="/api/v1/auth")
    assert (await client.post(f"{API}/refresh")).status_code == 401

    client.cookies.set("cardarena_refresh", new_cookie, path="/api/v1/auth")
    assert (await client.post(f"{API}/logout")).status_code == 200
    client.cookies.set("cardarena_refresh", new_cookie, path="/api/v1/auth")
    assert (await client.post(f"{API}/refresh")).status_code == 401


async def test_login_is_rate_limited(client):
    statuses = [
        (await client.post(f"{API}/login", json={"login": "x", "password": "y"})).status_code for _ in range(11)
    ]
    assert statuses[-1] == 429
