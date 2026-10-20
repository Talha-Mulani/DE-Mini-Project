# Cosmos Hub: Solar–Earth Intelligence

An offline-friendly solar–Earth intelligence dashboard and data pipeline. It ingests NASA APOD, asteroid, solar flare, CME, and NOAA Kp data, cleans and quarantines bad records, builds DuckDB gold tables, and runs quality checks. The React dashboard includes a compact selectable activity calendar and two accessible Three.js space visualizations.

## Quick start (recommended React UI)

```bash
pip install -r requirements.txt
python run_pipeline.py --sample --days 365
npm install
npm run build
npm run server
```

Open `http://localhost:3001` after starting the server. During development, run
`npm run dev` in one terminal and `npm run server` in another; Vite proxies `/api`
to Express. The API serves the curated `data/api.json` snapshot generated after
every gold build, so Node does not need a native DuckDB binding.

`--sample` is deterministic and requires no network or NASA key. By default it covers `2024-01-01` through today; use `--start-date`, `--end-date`, or `--days` to choose another window. Without `--sample`, APIs are attempted with retries and NASA requests are chunked across the complete window, then deterministic fixtures fill unavailable ranges. Data lives under `data/bronze`, `data/clean`, and `data/gold` (override with `COSMOS_DATA_DIR`). Each run writes `data/pipeline_run.json` with row counts and quality metrics.

To resume from existing artifacts, use `--from-step clean`, `--from-step gold`, or `--from-step quality`.

## Pipeline

`pipeline.ingest` writes idempotent JSON raw files, `clean` normalizes and quarantines records, `gold` materializes DuckDB facts/dimensions, and `quality` validates row counts, dates, ranges, and relationships.

The React app has seven top-level views: Overview, Astronomy, Solar Activity,
Geomagnetic Weather, Simulation, 3D Space, and Data Quality. Charts use human-readable
labels, units, plain-language interpretation cards, and tooltips. The Simulation
view is an educational animated model: it demonstrates the sequence from a
solar event to a travelling CME, magnetic response, and recovery. It is not a
forecast and should not be interpreted as one.
The 3D Space view provides a Sun → CME → Earth magnetosphere scene driven by
simulation controls and a solar-system scene with orbit paths and asteroid
markers from the current snapshot. These visualizations are illustrative, not
to scale or predictive.
The browser reloads the API snapshot every five minutes, so rerunning the
pipeline updates the dashboard without restarting the server.
The existing Streamlit dashboard remains available:

```bash
streamlit run app/dashboard.py
```

Express endpoints are `/api/health`, `/api/summary`, `/api/daily`,
`/api/asteroids`, `/api/solar`, and `/api/quality`.
