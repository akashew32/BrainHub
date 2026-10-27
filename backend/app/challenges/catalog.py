from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).with_name("catalog.json")
CATALOG: dict[str, Any] = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
CHALLENGES: dict[str, dict[str, Any]] = {
    problem["slug"]: problem for problem in CATALOG["problems"]
}
