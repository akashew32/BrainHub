from collections import Counter

from app.challenges import runner
from app.challenges.catalog import CHALLENGES


def test_challenge_catalog_has_requested_mix_and_twenty_cases_each():
    assert len(CHALLENGES) == 50
    assert Counter(item["difficulty"] for item in CHALLENGES.values()) == {
        "Easy": 10,
        "Medium": 20,
        "Hard": 20,
    }
    assert all(len(item["cases"]) == 20 for item in CHALLENGES.values())
    assert all(len(item["samples"]) == 3 for item in CHALLENGES.values())
    assert len({item["number"] for item in CHALLENGES.values()}) == 50


def test_each_language_harness_contains_solution_and_case_markers():
    challenge = CHALLENGES["merge-strings-alternately"]
    for language in ("python", "java", "cpp"):
        source = challenge["starterCode"][language]
        harness = runner.build_harness(source, language, challenge, challenge["cases"][:3])
        assert "Solution" in harness
        assert runner.MARKER in harness
        assert "word1" in source


def test_challenge_run_endpoint_parses_results(client, monkeypatch):
    def fake_execute(source: str, language: str):
        assert language == "python"
        assert "_brainhub_cases" in source
        return {
            "status": {"id": 3, "description": "Accepted"},
            "stdout": "user print\n",
            "stderr": (
                f"{runner.MARKER}\t0\t1\tab\tab\n"
                f"{runner.MARKER}\t1\t0\tax\twrong\n"
                f"{runner.MARKER}\t2\t1\txy\txy\n"
            ),
            "compile_output": None,
            "time": "0.01",
            "memory": 1024,
        }

    monkeypatch.setattr(runner, "execute_remote", fake_execute)
    response = client.post(
        "/api/challenges/merge-strings-alternately/run",
        json={
            "language": "python",
            "source": CHALLENGES["merge-strings-alternately"]["starterCode"]["python"],
            "mode": "run",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] == 2
    assert body["total"] == 3
    assert body["terminal"] == "user print"
    assert body["results"][1]["actual"] == "wrong"


def test_challenge_run_rejects_unknown_problem(client):
    response = client.post(
        "/api/challenges/not-a-problem/run",
        json={"language": "python", "source": "class Solution: pass", "mode": "run"},
    )
    assert response.status_code == 404
