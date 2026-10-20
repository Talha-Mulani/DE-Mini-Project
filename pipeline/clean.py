from __future__ import annotations
from pathlib import Path
from typing import Any
import pandas as pd
from config import QUARANTINE_DIR, PROCESSED_DIR
from .utils import write_json_idempotent

def _clean(name: str, rows: list[dict[str, Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(rows).drop_duplicates()
    if name == "apod":
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce").dt.date
        frame = frame.dropna(subset=["date"])
    elif name == "asteroids":
        frame["close_approach_date"] = pd.to_datetime(frame["close_approach_date"], errors="coerce").dt.date
        frame["miss_distance_km"] = pd.to_numeric(frame["miss_distance_km"], errors="coerce")
        frame["estimated_diameter_km"] = pd.to_numeric(frame["estimated_diameter_km"], errors="coerce")
        frame = frame.dropna(subset=["id", "close_approach_date", "miss_distance_km"])
    elif name == "flares":
        frame["begin"] = pd.to_datetime(frame["begin"], errors="coerce", utc=True)
        frame["peak"] = pd.to_datetime(frame["peak"], errors="coerce", utc=True)
        frame["flare_date"] = frame["begin"].dt.date
        frame["class_letter"] = frame["class_type"].astype(str).str[:1].str.upper()
        frame["class_value"] = pd.to_numeric(frame["class_type"].astype(str).str[1:], errors="coerce")
        frame = frame.dropna(subset=["id", "begin", "class_value"])
    elif name == "cmes":
        frame["start_time"] = pd.to_datetime(frame["start_time"], errors="coerce", utc=True)
        frame["cme_date"] = frame["start_time"].dt.date
        frame["speed_km_s"] = pd.to_numeric(frame["speed_km_s"], errors="coerce")
        frame = frame.dropna(subset=["id", "start_time", "speed_km_s"])
    elif name == "kp":
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce", utc=True)
        frame["date"] = frame["timestamp"].dt.date
        frame["kp"] = pd.to_numeric(frame["kp"], errors="coerce")
        invalid = frame[(frame["kp"] < 0) | (frame["kp"] > 9)]
        write_json_idempotent(QUARANTINE_DIR / f"{name}.json", invalid.to_dict("records"))
        frame = frame[(frame["kp"] >= 0) & (frame["kp"] <= 9)].dropna(subset=["timestamp", "kp"])
    return frame.reset_index(drop=True)

def clean_all(raw: dict[str, list[dict[str, Any]]]) -> dict[str, pd.DataFrame]:
    result = {name: _clean(name, rows) for name, rows in raw.items()}
    for name, frame in result.items():
        frame.to_json(PROCESSED_DIR / f"{name}.json", orient="records", date_format="iso")
    return result
