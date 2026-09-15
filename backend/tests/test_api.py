def test_game_registry_and_stats(client):
    games = client.get("/api/games")
    assert games.status_code == 200
    assert len(games.json()) == 6
    stats = client.get("/api/stats").json()
    assert stats["games_played"] == 0
    assert len(stats["categories"]) == 6


def test_fermi_seed_bank_and_hidden_dice(client):
    questions = client.get("/api/games/fermi/questions")
    assert questions.status_code == 200
    assert len(questions.json()) == 40
    assert all(
        item["lower_bound"] <= item["reference"] <= item["upper_bound"] for item in questions.json()
    )
    dice = client.post("/api/games/liars-dice/sessions", json={"difficulty": "expert", "seed": 9})
    assert dice.status_code == 200
    assert "dice" not in dice.json()["state"]
    assert "your_dice" in dice.json()["state"]


def test_session_action_completion_and_recent_attempt(client):
    created = client.post(
        "/api/games/market-making/sessions", json={"difficulty": "easy", "seed": 5}
    )
    assert created.status_code == 200
    body = created.json()
    assert "fair_value" not in body["state"]
    assert "_quote_started_at" not in body["state"]
    session_id = body["id"]
    action = client.post(
        f"/api/games/market-making/sessions/{session_id}/actions",
        json={"action": {"bid": 80, "ask": 120, "elapsed_ms": 999_999}},
    )
    assert action.status_code == 200
    assert action.json()["state"]["history"][0]["side"] != "timeout"
    premature = client.post(
        f"/api/games/market-making/sessions/{session_id}/complete", json={"score": 99999}
    )
    assert premature.status_code == 409
    for _ in range(7):
        client.post(
            f"/api/games/market-making/sessions/{session_id}/actions",
            json={"action": {"bid": 80, "ask": 120}},
        )
    completed = client.post(
        f"/api/games/market-making/sessions/{session_id}/complete",
        json={"score": 99999, "duration_ms": 1},
    )
    assert completed.status_code == 200
    assert completed.json()["score"] != 99999
    assert client.get("/api/attempts/recent").json()[0]["score"] == completed.json()["score"]
    game_stats = client.get("/api/stats/market-making")
    assert game_stats.status_code == 200
    assert game_stats.json()["summary"]["attempts"] == 1
    duplicate = client.post(
        f"/api/games/market-making/sessions/{session_id}/complete", json={"score": 1}
    )
    assert duplicate.status_code == 409
