from __future__ import annotations

import argparse
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


def generated_catalog(source: str) -> dict[str, dict[str, list[str]]]:
    roadmap_matches = list(re.finditer(r'^    slug: "(?P<slug>[^"]+)",$', source, re.MULTILINE))
    catalog: dict[str, list[str]] = {}
    for index, match in enumerate(roadmap_matches):
        slug = match.group("slug")
        if slug in catalog or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise RuntimeError("Expected unique canonical roadmap identifiers")
        end = (
            roadmap_matches[index + 1].start() if index + 1 < len(roadmap_matches) else len(source)
        )
        block = source[match.start() : end]
        topics: list[str] = []
        for topic_block in re.findall(r"topics:\s*\[(.*?)\]", block, re.DOTALL):
            for raw_topic in re.findall(r'"((?:[^"\\]|\\.)*)"', topic_block):
                topics.append(json.loads(f'"{raw_topic}"'))
        slugs = [slugify(topic) for topic in topics]
        if len(slugs) != 60 or len(set(slugs)) != 60 or any(not topic for topic in slugs):
            raise RuntimeError(
                f"Expected 60 unique topics for {match.group('slug')}, found {len(slugs)}"
            )
        catalog[slug] = slugs

    if len(catalog) != 5 or sum(map(len, catalog.values())) != 300:
        raise RuntimeError("Expected five roadmaps and 300 topics")
    return {"roadmaps": catalog}


def main(args: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Generate or verify the packaged public topic allowlist."
    )
    parser.add_argument("--check", action="store_true", help="Fail on drift without writing files.")
    options = parser.parse_args(args)
    catalog = generated_catalog(SOURCE.read_text(encoding="utf-8"))
    if options.check:
        try:
            current = json.loads(TARGET.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise SystemExit(
                "Public topic catalog is missing or invalid; regenerate it."
            ) from error
        if current != catalog:
            raise SystemExit(
                "Public topic catalog differs from the frontend. Regenerate and review it."
            )
        print("Verified public allowlist: five roadmaps and 300 topics; no files changed.")
        return
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print("Generated backend allowlist for five roadmaps and 300 topics.")


if __name__ == "__main__":
    main()
