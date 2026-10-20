"""Configuration for the Cosmos Hub pipeline."""
from pathlib import Path
from datetime import date
import os
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("COSMOS_DATA_DIR", ROOT / "data"))
BRONZE_DIR = DATA_DIR / "bronze"
CLEAN_DIR = DATA_DIR / "clean"
RAW_DIR = BRONZE_DIR  # backwards-compatible name
PROCESSED_DIR = CLEAN_DIR
GOLD_DIR = DATA_DIR / "gold"
QUARANTINE_DIR = DATA_DIR / "quarantine"
DB_PATH = GOLD_DIR / "cosmos.duckdb"
API_JSON_PATH = DATA_DIR / "api.json"
NASA_API_KEY = os.getenv("NASA_API_KEY", "")
NASA_BASE_URL = os.getenv("NASA_BASE_URL", "https://api.nasa.gov")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))
RETRIES = int(os.getenv("RETRIES", "3"))
DEFAULT_START_DATE = date.fromisoformat(os.getenv("COSMOS_START_DATE", "2024-01-01"))
SAMPLE_DAYS = int(os.getenv("SAMPLE_DAYS", "90"))

for directory in (BRONZE_DIR, CLEAN_DIR, GOLD_DIR, QUARANTINE_DIR):
    directory.mkdir(parents=True, exist_ok=True)
