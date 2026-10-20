from datetime import date
from collections import Counter
from pipeline.ingest import _fixture
from pipeline.clean import _clean

def test_fixture_is_deterministic():
    assert _fixture() == _fixture()

def test_kp_invalid_values_are_removed():
    rows = [{"timestamp": "2024-01-01T00:00:00Z", "kp": 4, "station": "x"},
            {"timestamp": "2024-01-01T03:00:00Z", "kp": 12, "station": "x"}]
    result = _clean("kp", rows)
    assert len(result) == 1 and result.iloc[0]["kp"] == 4

def test_flare_class_parsing():
    result = _clean("flares", [{"id": "x", "begin": "2024-01-01T00:00:00Z", "peak": "2024-01-01T01:00:00Z", "class_type": "M2.5"}])
    assert result.iloc[0]["class_letter"] == "M"
    assert result.iloc[0]["class_value"] == 2.5

def test_fixture_has_source_like_granularity_and_variability():
    data = _fixture(date(2024, 1, 1), 60)
    kp_per_day = Counter(row["timestamp"][:10] for row in data["kp"])
    assert set(kp_per_day.values()) == {8}
    assert len({row["kp"] for row in data["kp"]}) > 20
    assert len({row["speed_km_s"] for row in data["cmes"]}) > 5
    assert len({row["class_type"] for row in data["flares"]}) > 4
    assert len(data["asteroids"]) > 60
