import pytest

from factories import create_question


@pytest.mark.asyncio
@pytest.mark.integration
async def test_favorites_flow(async_client, db_session, auth_headers):
    question = await create_question(db_session, prompt="Favorite me")

    favorite = await async_client.post(
        f"/api/v1/questions/{question.id}/favorite",
        headers=auth_headers,
    )
    assert favorite.status_code == 200

    list_response = await async_client.get(
        "/api/v1/questions/favorites",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    favorites = list_response.json()
    assert any(item["id"] == str(question.id) for item in favorites)

    unfavorite = await async_client.delete(
        f"/api/v1/questions/{question.id}/favorite",
        headers=auth_headers,
    )
    assert unfavorite.status_code == 200

    list_response = await async_client.get(
        "/api/v1/questions/favorites",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    favorites = list_response.json()
    assert all(item["id"] != str(question.id) for item in favorites)
