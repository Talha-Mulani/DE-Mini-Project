import argparse
import json
from datetime import date, timedelta
from config import API_JSON_PATH, DATA_DIR, DEFAULT_START_DATE, BRONZE_DIR, CLEAN_DIR
from pipeline.ingest import ingest_all
from pipeline.clean import clean_all
from pipeline.gold import build_gold
from pipeline.quality import run_quality_checks

def main() -> int:
    parser = argparse.ArgumentParser(description="Run Cosmos Hub pipeline")
    parser.add_argument("--sample", action="store_true", help="use deterministic offline fixtures")
    parser.add_argument("--start-date", type=date.fromisoformat, default=DEFAULT_START_DATE)
    parser.add_argument("--days", type=int, help="number of days when --end-date is omitted")
    parser.add_argument("--end-date", type=date.fromisoformat)
    parser.add_argument("--from-step", choices=["ingest", "clean", "gold", "quality"], default="ingest",
                        help="resume from this pipeline step using existing artifacts")
    args = parser.parse_args()
    end_date = args.end_date or (args.start_date + timedelta(days=args.days - 1) if args.days else date.today())
    days = (end_date - args.start_date).days + 1
    if days < 1 or days > 2000:
        parser.error("the selected window must be between 1 and 2000 days")
    if end_date < args.start_date:
        parser.error("--end-date must be on or after --start-date")
    if args.from_step == "ingest":
        raw = ingest_all(sample=args.sample, start_date=args.start_date, end_date=end_date)
        cleaned = clean_all(raw)
        build_gold(cleaned)
    else:
        # Resume support intentionally reads the clean artifacts, avoiding network calls.
        import pandas as pd
        names = ("apod", "asteroids", "flares", "cmes", "kp")
        if args.from_step == "clean":
            raw = {n: json.loads((BRONZE_DIR / f"{n}.json").read_text(encoding="utf-8"))["records"] for n in names}
            cleaned = clean_all(raw)
        else:
            cleaned = {n: pd.read_json(CLEAN_DIR / f"{n}.json") for n in names}
        build_gold(cleaned)
    checks = run_quality_checks()
    # Keep the browser snapshot self-describing and include the same checks
    # shown by Streamlit, without making the Express server import DuckDB.
    if API_JSON_PATH.exists():
        snapshot = json.loads(API_JSON_PATH.read_text(encoding="utf-8"))
        snapshot["quality"] = checks
        API_JSON_PATH.write_text(json.dumps(snapshot, indent=2, default=str), encoding="utf-8")
    metrics = {"run_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
               "sample": args.sample, "start_date": str(args.start_date), "end_date": str(end_date or ""),
               "from_step": args.from_step, "row_counts": {k: len(v) for k, v in cleaned.items()},
               "quality": checks}
    (DATA_DIR / "pipeline_run.json").write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    print(f"Pipeline complete: {checks['passed']}/{checks['total']} checks passed")
    return 0 if checks["passed"] == checks["total"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
