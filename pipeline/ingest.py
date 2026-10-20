from __future__ import annotations
from datetime import date, timedelta
import math
import random
from typing import Any
import requests
from config import NASA_API_KEY, NASA_BASE_URL, RAW_DIR, REQUEST_TIMEOUT, RETRIES, SAMPLE_DAYS
from .utils import utc_now, write_json_idempotent

def _fixture(start: date = date(2024, 1, 1), days_count: int = SAMPLE_DAYS) -> dict[str, list[dict[str, Any]]]:
    rng = random.Random(f"cosmos-hub:{start.isoformat()}:{days_count}")
    days = [(start + timedelta(days=i)).isoformat() for i in range(days_count)]
    apod_topics = [
        ("Aurora over the polar night", "A ribbon of aurora shaped by a geomagnetic storm."),
        ("A distant spiral galaxy", "Starlight reveals the structure of a galaxy millions of light-years away."),
        ("Moonlit crater shadows", "The changing angle of sunlight reveals detail across the lunar surface."),
        ("Nebula in the stellar nursery", "Dust and gas gather where new stars are forming."),
        ("Jupiter and its storm bands", "A giant planet displays turbulent clouds and changing weather."),
        ("The Milky Way at midnight", "Our galaxy arches above a quiet observatory."),
    ]
    apod = [
        {
            "date": d,
            "title": apod_topics[(i + rng.randrange(len(apod_topics))) % len(apod_topics)][0],
            "explanation": apod_topics[(i + rng.randrange(len(apod_topics))) % len(apod_topics)][1],
            "url": "https://example.com/apod.jpg",
            "media_type": "image",
        }
        for i, d in enumerate(days)
    ]

    asteroids: list[dict[str, Any]] = []
    flares: list[dict[str, Any]] = []
    cmes: list[dict[str, Any]] = []
    kp: list[dict[str, Any]] = []
    storm_days = set()
    for i, day in enumerate(days):
        seasonal = 0.5 + 0.5 * math.sin(i / 31.0)
        if rng.random() < 0.035 + seasonal * 0.04:
            storm_days.update(range(i, min(days_count, i + rng.randint(1, 4))))

        for _ in range(rng.choices([0, 1, 2, 3, 4], [0.18, 0.40, 0.28, 0.11, 0.03])[0]):
            asteroid_number = len(asteroids)
            diameter = 0.03 + rng.lognormvariate(-2.0, 0.75)
            asteroids.append({
                "id": str(100000 + asteroid_number),
                "name": f"(Demo {asteroid_number:04d})",
                "close_approach_date": day,
                "miss_distance_km": round(rng.lognormvariate(14.7, 0.9)),
                "estimated_diameter_km": round(min(diameter, 4.5), 4),
                "is_potentially_hazardous": rng.random() < 0.13,
            })

        flare_probability = 0.28 + seasonal * 0.22
        for _ in range(rng.choices([0, 1, 2, 3], [1 - flare_probability, flare_probability * 0.70, flare_probability * 0.24, flare_probability * 0.06])[0]):
            flare_number = len(flares)
            letter = rng.choices(["C", "M", "X"], [0.70, 0.25, 0.05])[0]
            number = round(rng.uniform(0.2, 9.8 if letter == "X" else 5.9), 1)
            hour = rng.randrange(24)
            flares.append({
                "id": f"FL{flare_number:05d}",
                "begin": f"{day}T{hour:02d}:00:00Z",
                "peak": f"{day}T{hour:02d}:30:00Z",
                "class_type": f"{letter}{number:.1f}",
                "source_location": f"N{rng.randrange(1, 30)}W{rng.randrange(1, 80)}",
            })
        if rng.random() < 0.08 + seasonal * 0.12:
            cme_number = len(cmes)
            cmes.append({
                "id": f"CME{cme_number:05d}",
                "start_time": f"{day}T{rng.randrange(24):02d}:00:00Z",
                "speed_km_s": rng.randint(280, 1450),
                "type": rng.choice(["HALO", "SAMPLE", "PARTIAL-HALO"]),
            })

        for period in range(8):
            base = 1.8 + 0.9 * math.sin(i / 23.0) + 0.35 * math.sin((i + period) / 8.0)
            storm_boost = rng.uniform(2.0, 4.5) if i in storm_days else 0
            kp_value = max(0.0, min(9.0, round(base + storm_boost + rng.gauss(0, 0.9), 1)))
            timestamp = f"{day}T{period * 3:02d}:00:00Z"
            kp.append({"timestamp": timestamp, "kp": kp_value, "station": "GFZ"})
    return {
        "apod": apod,
        "asteroids": asteroids,
        "flares": flares,
        "cmes": cmes,
        "kp": kp,
    }

def _get(path: str, params: dict[str, Any]) -> Any:
    for attempt in range(RETRIES):
        try:
            response = requests.get(f"{NASA_BASE_URL}{path}", params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            if attempt == RETRIES - 1:
                return None
    return None

def ingest_all(sample: bool = False, start_date: date | None = None, end_date: date | None = None) -> dict[str, list[dict[str, Any]]]:
    start_date = start_date or date(2024, 1, 1)
    end_date = end_date or date.today()
    days_count = max(1, (end_date - start_date).days + 1)
    fixtures = _fixture(start_date, days_count)
    if not sample and NASA_API_KEY:
        # APOD supports a broad range, but chunking keeps requests reliable.
        real_apod: list[dict[str, Any]] = []
        real_asteroids: list[dict[str, Any]] = []
        cursor = start_date
        while cursor <= end_date:
            apod_end = min(end_date, cursor + timedelta(days=364))
            apod = _get("/planetary/apod", {"api_key": NASA_API_KEY, "start_date": str(cursor), "end_date": str(apod_end)})
            if isinstance(apod, list):
                real_apod.extend(apod)
            ast_end = min(end_date, cursor + timedelta(days=6))
            ast = _get("/neo/rest/v1/feed", {"api_key": NASA_API_KEY, "start_date": str(cursor), "end_date": str(ast_end)})
            if ast and "near_earth_objects" in ast:
                real_asteroids.extend(
                    dict(x, close_approach_date=(x.get("close_approach_data") or [{}])[0].get("close_approach_date"))
                    for values in ast["near_earth_objects"].values() for x in values
                )
            cursor = ast_end + timedelta(days=1)
        if real_apod:
            fixtures["apod"] = real_apod
        if real_asteroids:
            fixtures["asteroids"] = real_asteroids
    for name, rows in fixtures.items():
        write_json_idempotent(RAW_DIR / f"{name}.json", {"ingested_at": utc_now(), "records": rows})
    return fixtures
