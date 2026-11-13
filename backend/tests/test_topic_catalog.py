"""The packaged public identifier allowlist must follow the actual frontend source."""

import json
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = spec_from_file_location(
    "topic_catalog_generator", ROOT / "tools/generate_roadmap_topic_catalog.py"
)
assert SPEC is not None and SPEC.loader is not None
generator = module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


def test_packaged_catalog_matches_generated_source():
    source = generator.SOURCE.read_text(encoding="utf-8")
    assert generator.generated_catalog(source) == json.loads(
        generator.TARGET.read_text(encoding="utf-8")
    )


def test_check_is_nonwriting_and_fails_on_drift(tmp_path, monkeypatch):
    target = tmp_path / "catalog.json"
    expected = generator.generated_catalog(generator.SOURCE.read_text(encoding="utf-8"))
    target.write_text(json.dumps(expected), encoding="utf-8")
    monkeypatch.setattr(generator, "TARGET", target)
    original = target.read_bytes(), target.stat().st_mtime_ns
    generator.main(["--check"])
    assert (target.read_bytes(), target.stat().st_mtime_ns) == original
    target.write_text('{"roadmaps":{}}', encoding="utf-8")
    drift = target.read_bytes(), target.stat().st_mtime_ns
    with pytest.raises(SystemExit, match="differs from the frontend"):
        generator.main(["--check"])
    assert (target.read_bytes(), target.stat().st_mtime_ns) == drift


def test_missing_or_malformed_catalog_is_never_silently_regenerated(tmp_path, monkeypatch):
    target = tmp_path / "catalog.json"
    monkeypatch.setattr(generator, "TARGET", target)
    with pytest.raises(SystemExit, match="missing or invalid"):
        generator.main(["--check"])
    assert not target.exists()
    target.write_text("not json", encoding="utf-8")
    with pytest.raises(SystemExit, match="missing or invalid"):
        generator.main(["--check"])
    assert target.read_text(encoding="utf-8") == "not json"


def test_generation_remains_an_explicit_action(tmp_path, monkeypatch):
    target = tmp_path / "catalog.json"
    monkeypatch.setattr(generator, "TARGET", target)
    generator.main([])
    assert json.loads(target.read_text(encoding="utf-8")) == generator.generated_catalog(
        generator.SOURCE.read_text(encoding="utf-8")
    )


@pytest.mark.parametrize(
    "change", ["duplicate_subject", "duplicate_topic", "missing_subject", "invalid_subject"]
)
def test_incomplete_or_ambiguous_source_is_rejected(change):
    source = generator.SOURCE.read_text(encoding="utf-8")
    if change == "duplicate_subject":
        source = source.replace('slug: "linear-algebra"', 'slug: "probability"', 1)
    elif change == "duplicate_topic":
        source = source.replace('"Permutations and combinations"', '"Sum and product rules"', 1)
    elif change == "missing_subject":
        source = source.replace('slug: "probability"', 'missing_slug: "probability"', 1)
    else:
        source = source.replace('slug: "probability"', 'slug: "../probability"', 1)
    with pytest.raises(RuntimeError):
        generator.generated_catalog(source)
