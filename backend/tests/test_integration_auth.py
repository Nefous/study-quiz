import pytest
from uuid import uuid4


@pytest.mark.asyncio
@pytest.mark.integration
async def test_auth_register_login_me(async_client):
    email = f"user_{uuid4().hex}@example.com"
    password = "password123"

    register = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register.status_code == 200
    register_payload = register.json()
    assert register_payload.get("access_token")

    login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    login_payload = login.json()
    token = login_payload["access_token"]

    me = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    me_payload = me.json()
    assert me_payload["email"] == email
