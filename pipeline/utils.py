from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def write_json_idempotent(path: Path, payload: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, sort_keys=True, indent=2, default=str)
    if path.exists() and path.read_text(encoding="utf-8") == serialized:
        return path
    path.write_text(serialized, encoding="utf-8")
    return path

def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
