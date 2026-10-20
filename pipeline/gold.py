from __future__ import annotations
import duckdb
import pandas as pd
from config import API_JSON_PATH, DB_PATH
import json

def build_gold(cleaned: dict[str, pd.DataFrame]) -> None:
    with duckdb.connect(str(DB_PATH)) as con:
        for name, frame in cleaned.items():
            con.register(f"_{name}", frame)
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _{name}")
        # APOD is not guaranteed to be complete, so use every observed event
        # when finding the bounds and fill missing days with explicit zeros.
        con.execute("""CREATE OR REPLACE TABLE fact_daily_space AS
            SELECT d::DATE AS date,
              COALESCE((SELECT COUNT(*) FROM asteroids a WHERE a.close_approach_date=d), 0) AS asteroid_count,
              COALESCE((SELECT COUNT(*) FROM flares f WHERE f.flare_date=d), 0) AS flare_count,
              COALESCE((SELECT COUNT(*) FROM cmes c WHERE c.cme_date=d), 0) AS cme_count,
              COALESCE((SELECT AVG(k.kp) FROM kp k WHERE k.date=d), 0) AS avg_kp,
              COALESCE((SELECT MAX(k.kp) FROM kp k WHERE k.date=d), 0) AS max_kp
            FROM generate_series(
              (SELECT MIN(day) FROM (SELECT date AS day FROM apod UNION ALL SELECT close_approach_date FROM asteroids UNION ALL SELECT flare_date FROM flares UNION ALL SELECT cme_date FROM cmes UNION ALL SELECT date FROM kp)),
              (SELECT MAX(day) FROM (SELECT date AS day FROM apod UNION ALL SELECT close_approach_date FROM asteroids UNION ALL SELECT flare_date FROM flares UNION ALL SELECT cme_date FROM cmes UNION ALL SELECT date FROM kp)),
              INTERVAL 1 DAY) s(d)""")
        con.execute("""CREATE OR REPLACE TABLE flare_kp_relationship AS
            SELECT f.id AS flare_id, f.flare_date, f.class_letter, f.class_value,
                   AVG(k.kp) AS avg_kp_same_day, MAX(k.kp) AS max_kp_same_day
            FROM flares f LEFT JOIN kp k ON f.flare_date=k.date
            GROUP BY ALL""")
        _export_snapshot(con)


def _export_snapshot(con: duckdb.DuckDBPyConnection) -> None:
    """Write a compact, browser-friendly snapshot without requiring node-duckdb."""
    daily = con.execute("SELECT * FROM fact_daily_space ORDER BY date").df()
    asteroids = con.execute(
        "SELECT id, name, close_approach_date, miss_distance_km, estimated_diameter_km, "
        "is_potentially_hazardous FROM asteroids ORDER BY close_approach_date"
    ).df()
    flares = con.execute("SELECT * FROM flares ORDER BY flare_date").df()
    cmes = con.execute("SELECT * FROM cmes ORDER BY cme_date").df()
    kp = con.execute("SELECT * FROM kp ORDER BY timestamp").df()
    apod = con.execute("SELECT date, title, media_type, url FROM apod ORDER BY date DESC").df()
    quality = {
        "tables": ["apod", "asteroids", "flares", "cmes", "kp", "fact_daily_space", "flare_kp_relationship"],
        "daily_days": len(daily),
        "generated_at": pd.Timestamp.utcnow().isoformat(),
    }
    payload = {
        "summary": {
            "days": len(daily), "asteroids": int(len(asteroids)), "flares": int(len(flares)),
            "cmes": int(len(cmes)), "peak_kp": float(daily["max_kp"].max() if len(daily) else 0),
            "hazardous_asteroids": int(asteroids["is_potentially_hazardous"].sum()) if len(asteroids) else 0,
            "start_date": str(daily["date"].min()) if len(daily) else None,
            "end_date": str(daily["date"].max()) if len(daily) else None,
        },
        "daily": daily.to_dict("records"), "asteroids": asteroids.to_dict("records"),
        "solar": {"flares": flares.to_dict("records"), "cmes": cmes.to_dict("records"),
                  "kp": kp.to_dict("records"), "apod": apod.to_dict("records")},
        "quality": quality,
    }
    API_JSON_PATH.write_text(json.dumps(payload, default=str, allow_nan=False), encoding="utf-8")
