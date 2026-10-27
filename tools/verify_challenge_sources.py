from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "frontend" / "lib" / "challenge-catalog.json"
LEETCODE_API = "https://leetcode.com/api/problems/all/"
NEETCODE_150 = "https://neetcode.io/practice/practice/neetcode150"


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "BrainHub source verifier/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def neetcode_150_slugs() -> set[str]:
    page = fetch_text(NEETCODE_150)
    script_match = re.search(r'<script[^>]+src="([^"]*main\.[^"]+\.js)"', page)
    if script_match is None:
        raise RuntimeError("Could not locate NeetCode's current application catalog")
    script_url = script_match.group(1)
    if not script_url.startswith("http"):
        script_url = f"https://neetcode.io/{script_url.lstrip('/')}"
    source = fetch_text(script_url)
    slugs: set[str] = set()
    for match in re.finditer(
        r'\{problem:"[^"]+"(?P<body>[^{}]*?neetcode150:!0[^{}]*?)\}', source
    ):
        link = re.search(r'link:"(?P<slug>[^"]+)/"', match.group("body"))
        if link:
            slugs.add(link.group("slug"))
    if len(slugs) != 150:
        raise RuntimeError(f"Expected 150 NeetCode entries, found {len(slugs)}")
    return slugs


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    problems = catalog["problems"]
    selected = {problem["slug"]: problem for problem in problems}

    leetcode = json.loads(fetch_text(LEETCODE_API))
    official = {
        item["stat"]["question__title_slug"]: item
        for item in leetcode["stat_status_pairs"]
        if item["stat"]["question__title_slug"] in selected
    }
    if official.keys() != selected.keys():
        missing = selected.keys() - official.keys()
        raise AssertionError(f"Missing from LeetCode metadata: {sorted(missing)}")

    levels = {1: "Easy", 2: "Medium", 3: "Hard"}
    for slug, problem in selected.items():
        item = official[slug]
        if item["paid_only"]:
            raise AssertionError(f"Selected problem is premium-only: {slug}")
        if str(item["stat"]["frontend_question_id"]) != str(problem["number"]):
            raise AssertionError(f"Problem number changed for {slug}")
        if levels[item["difficulty"]["level"]] != problem["difficulty"]:
            raise AssertionError(f"Difficulty changed for {slug}")

    overlap = selected.keys() & neetcode_150_slugs()
    if overlap:
        raise AssertionError(
            f"Selected challenges overlap NeetCode 150: {sorted(overlap)}"
        )

    counts = {difficulty: 0 for difficulty in ("Easy", "Medium", "Hard")}
    for problem in problems:
        counts[problem["difficulty"]] += 1
    if counts != {"Easy": 10, "Medium": 20, "Hard": 20}:
        raise AssertionError(f"Unexpected difficulty counts: {counts}")
    print(
        f"Verified {len(problems)} LeetCode sources, difficulty labels, and zero NeetCode 150 overlap."
    )


if __name__ == "__main__":
    main()
