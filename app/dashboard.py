"""Cosmos Hub: five-page exploration dashboard."""
from pathlib import Path
import sys

# Streamlit may execute this file with ``app`` as the import root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import duckdb
import plotly.express as px
import streamlit as st
from config import DB_PATH, DATA_DIR

try:
    from .style import apply_style
except ImportError:
    from style import apply_style

apply_style()
st.title("🌌 Cosmos Hub")
try:
    con = duckdb.connect(str(DB_PATH), read_only=True)
except Exception:
    st.error("Run `python run_pipeline.py --sample` first.")
    st.stop()

page = st.sidebar.radio("Pages", ["Overview", "Astronomy", "Solar Activity",
                                  "Geomagnetic Weather", "Data Quality"])

def chart(fig):
    fig.update_layout(template="plotly_dark", paper_bgcolor="#090d1a", plot_bgcolor="#090d1a")
    st.plotly_chart(fig, use_container_width=True)

if page == "Overview":
    daily = con.sql("SELECT * FROM fact_daily_space ORDER BY date").df()
    st.caption("A deterministic offline dataset is available with `--sample`.")
    a, b, c, d = st.columns(4)
    a.metric("Days", len(daily)); b.metric("Asteroids", int(daily.asteroid_count.sum()))
    c.metric("Flares", int(daily.flare_count.sum())); d.metric("Peak Kp", f"{daily.max_kp.max():.1f}")
    chart(px.line(daily, x="date", y=["avg_kp", "max_kp"], title="Daily geomagnetic intensity"))
    chart(px.bar(daily, x="date", y=["asteroid_count", "flare_count", "cme_count"], title="Daily event volume"))
elif page == "Astronomy":
    st.header("Astronomy: APOD and near-Earth objects")
    apod = con.sql("SELECT date, title, media_type, url FROM apod ORDER BY date DESC").df()
    ast = con.sql("SELECT * FROM asteroids ORDER BY close_approach_date").df()
    chart(px.scatter(ast, x="miss_distance_km", y="estimated_diameter_km",
                     size="estimated_diameter_km", color="is_potentially_hazardous",
                     hover_name="name", title="Near-Earth object distance and size"))
    st.dataframe(apod, use_container_width=True, hide_index=True)
    st.dataframe(ast, use_container_width=True, hide_index=True)
elif page == "Solar Activity":
    st.header("Solar activity: flares and CMEs")
    flares = con.sql("SELECT * FROM flares ORDER BY flare_date").df()
    cmes = con.sql("SELECT * FROM cmes ORDER BY cme_date").df()
    left, right = st.columns(2)
    with left:
        chart(px.bar(flares, x="flare_date", y="class_value", color="class_letter",
                     title="Flare class strength"))
    with right:
        chart(px.line(cmes, x="cme_date", y="speed_km_s", markers=True,
                      title="CME speeds (km/s)"))
    st.dataframe(flares, use_container_width=True, hide_index=True)
elif page == "Geomagnetic Weather":
    st.header("Geomagnetic weather and flare relationship")
    kp = con.sql("SELECT * FROM kp ORDER BY timestamp").df()
    rel = con.sql("SELECT * FROM flare_kp_relationship ORDER BY flare_date").df()
    chart(px.line(kp, x="timestamp", y="kp", color="station", markers=True, title="NOAA Kp index"))
    chart(px.scatter(rel, x="class_value", y="max_kp_same_day", color="class_letter",
                     hover_name="flare_id", title="Flare strength versus same-day Kp"))
    st.dataframe(rel, use_container_width=True, hide_index=True)
else:
    st.header("Data quality and pipeline run")
    run_file = DATA_DIR / "pipeline_run.json"
    if run_file.exists():
        st.json(run_file.read_text(encoding="utf-8"))
    inventory = con.sql("SELECT table_name, estimated_size FROM duckdb_tables() WHERE schema_name='main' ORDER BY table_name").df()
    st.dataframe(inventory, use_container_width=True, hide_index=True)
    st.info("Checks cover table presence, non-empty daily facts, Kp range (0–9), relationships, and date integrity.")
