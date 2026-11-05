from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "lib" / "roadmaps.ts"
TARGET = ROOT / "backend" / "app" / "roadmaps" / "catalog.json"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", normalized))


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    roadmap_matches = list(
        re.finditer(r'^    slug: "(?P<slug>[^"]+)",$', source, re.MULTILINE)
    )
    catalog: dict[str, list[str]] = {}
    for index, match in enumerate(roadmap_matches):
        end = (
            roadmap_matches[index + 1].start()
            if index + 1 < len(roadmap_matches)
            else len(source)
        )
        block = source[match.start() : end]
        topics: list[str] = []
        for topic_block in re.findall(r"topics:\s*\[(.*?)\]", block, re.DOTALL):
            for raw_topic in re.findall(r'"((?:[^"\\]|\\.)*)"', topic_block):
                topics.append(json.loads(f'"{raw_topic}"'))
        slugs = [slugify(topic) for topic in topics]
        if len(slugs) != 60 or len(set(slugs)) != 60:
            raise RuntimeError(
                f"Expected 60 unique topics for {match.group('slug')}, found {len(slugs)}"
            )
        catalog[match.group("slug")] = slugs

    if len(catalog) != 5 or sum(map(len, catalog.values())) != 300:
        raise RuntimeError("Expected five roadmaps and 300 topics")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps({"roadmaps": catalog}, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generated backend allowlist for {len(catalog)} roadmaps and 300 topics.")


if __name__ == "__main__":
    main()
