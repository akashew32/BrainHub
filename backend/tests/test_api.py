def test_game_registry_and_stats(client):
    games = client.get("/api/games")
    assert games.status_code == 200
    assert len(games.json()) == 11
    stats = client.get("/api/stats").json()
    assert stats["games_played"] == 0
    assert len(stats["categories"]) == 6


def test_local_quant_drill_persists_through_generic_session_api(client):
    created = client.post(
        "/api/games/bayes-updating/sessions", json={"difficulty": "hard", "seed": 17}
    )
    assert created.status_code == 200
    assert created.json()["state"] == {"score": 0}
    session_id = created.json()["id"]
    completed = client.post(
        f"/api/games/bayes-updating/sessions/{session_id}/complete",
        json={
            "score": 612,
            "duration_ms": 42_000,
            "metrics": {"accuracy": 83, "average_response_ms": 6200},
        },
    )
    assert completed.status_code == 200
    assert completed.json()["game_slug"] == "bayes-updating"
    assert client.get("/api/stats/bayes-updating").json()["summary"]["attempts"] == 1


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


def test_roadmap_progress_requires_quiz_mastery_and_flows_into_stats(client):
    started = client.patch(
        "/api/roadmaps/linear-algebra/topics/gaussian-and-gauss-jordan-elimination",
        json={"status": "in_progress", "time_spent_seconds": 45},
    )
    assert started.status_code == 200
    assert started.json()["time_spent_seconds"] == 45

    blocked = client.patch(
        "/api/roadmaps/linear-algebra/topics/gaussian-and-gauss-jordan-elimination",
        json={"status": "completed", "quiz_score": 33},
    )
    assert blocked.status_code == 422

    completed = client.patch(
        "/api/roadmaps/linear-algebra/topics/gaussian-and-gauss-jordan-elimination",
        json={"status": "completed", "quiz_score": 100, "time_spent_seconds": 15},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["quiz_score"] == 100
    assert completed.json()["quiz_attempts"] == 1
    assert completed.json()["time_spent_seconds"] == 60

    progress = client.get("/api/roadmaps/progress").json()
    assert progress["summary"]["completed"] == 1
    assert progress["summary"]["roadmaps"][1]["percent"] == 2
    assert progress["items"][0]["topic_slug"] == "gaussian-and-gauss-jordan-elimination"

    stats = client.get("/api/stats").json()
    assert stats["roadmaps"]["completed"] == 1
    assert stats["roadmaps"]["time_spent_seconds"] == 60


def test_roadmap_progress_validates_route_identity(client):
    unknown = client.patch(
        "/api/roadmaps/not-a-roadmap/topics/vector-spaces",
        json={"status": "in_progress"},
    )
    assert unknown.status_code == 404

    invalid = client.patch(
        "/api/roadmaps/probability/topics/Not%20A%20Slug",
        json={"status": "in_progress"},
    )
    assert invalid.status_code == 422

    unknown_topic = client.patch(
        "/api/roadmaps/probability/topics/made-up-topic",
        json={"status": "in_progress"},
    )
    assert unknown_topic.status_code == 404
