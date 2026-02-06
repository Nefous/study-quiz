import pytest


@pytest.mark.asyncio
@pytest.mark.integration
async def test_meta_and_health(async_client):
    health = await async_client.get("/api/v1/health")
    assert health.status_code == 200

    meta = await async_client.get("/api/v1/meta")
    assert meta.status_code == 200
    payload = meta.json()
    assert "topics" in payload
    assert "difficulties" in payload

    options = await async_client.get("/api/v1/meta/question-options")
    assert options.status_code == 200
    options_payload = options.json()
    assert "topics" in options_payload
    assert "difficulties" in options_payload
