import streamlit as st

def apply_style() -> None:
    st.set_page_config(page_title="Cosmos Hub", page_icon="🌌", layout="wide")
    st.markdown("""<style>
    .stApp {background: #090d1a; color: #e7ecff}
    [data-testid="stMetricValue"] {color: #69d6ff}
    h1, h2, h3 {color: #b9c7ff}
    </style>""", unsafe_allow_html=True)
