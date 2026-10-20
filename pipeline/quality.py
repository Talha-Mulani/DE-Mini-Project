from __future__ import annotations
import duckdb
from config import DB_PATH

def run_quality_checks() -> dict[str, int | list]:
    checks = []
    with duckdb.connect(str(DB_PATH), read_only=True) as con:
        checks.append(("gold tables", all(con.execute("SELECT COUNT(*) FROM " + t).fetchone()[0] >= 0 for t in ("fact_daily_space", "flare_kp_relationship"))))
        checks.append(("daily rows", con.execute("SELECT COUNT(*) FROM fact_daily_space").fetchone()[0] > 0))
        checks.append(("kp range", con.execute("SELECT COUNT(*) FROM kp WHERE kp NOT BETWEEN 0 AND 9").fetchone()[0] == 0))
        checks.append(("flare relationship", con.execute("SELECT COUNT(*) FROM flare_kp_relationship").fetchone()[0] > 0))
        checks.append(("dates", con.execute("SELECT COUNT(*) FROM fact_daily_space WHERE date IS NULL").fetchone()[0] == 0))
    return {"passed": sum(ok for _, ok in checks), "total": len(checks), "checks": [{"name": n, "passed": ok} for n, ok in checks]}
