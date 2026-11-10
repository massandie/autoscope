def _reading(**overrides):
    payload = {
        "vehicle_id": "GH-123-ABC",
        "timestamp": "2026-01-01T08:00:00Z",
        "location": {"lat": 5.56, "lon": -0.21, "speed": 48},
        "driving_score": 72,
        "events": [],
        "obd": {"rpm": 1710, "dtc": [], "coolant_temp": 90, "battery_voltage": 12.5},
    }
    payload.update(overrides)
    return payload


def test_dtc_code_triggers_diagnostic_alert(client):
    res = client.post("/ingest", json=_reading(obd={"rpm": 1710, "dtc": ["P0301"], "coolant_temp": 90, "battery_voltage": 12.5}))
    assert res.status_code == 200
    body = res.json()
    assert any(a["category"] == "diagnostic" and "P0301" in a["message"] for a in body["alerts"])


def test_overheat_triggers_critical_alert(client):
    res = client.post("/ingest", json=_reading(obd={"rpm": 1710, "dtc": [], "coolant_temp": 110, "battery_voltage": 12.5}))
    body = res.json()
    assert any(a["severity"] == "critical" and "Surchauffe" in a["message"] for a in body["alerts"])


def test_low_battery_triggers_predictive_alert(client):
    res = client.post("/ingest", json=_reading(obd={"rpm": 1710, "dtc": [], "coolant_temp": 90, "battery_voltage": 11.0}))
    body = res.json()
    assert any(a["category"] == "predictive" for a in body["alerts"])


def test_harsh_braking_triggers_behavioral_alert(client):
    res = client.post("/ingest", json=_reading(events=["freinage_brusque"]))
    body = res.json()
    assert any(a["category"] == "behavioral" and "Freinage" in a["message"] for a in body["alerts"])


def test_fatigue_risk_event_triggers_behavioral_alert(client):
    res = client.post("/ingest", json=_reading(events=["risque_fatigue"]))
    body = res.json()
    assert any(a["category"] == "behavioral" and "fatigue" in a["message"].lower() for a in body["alerts"])


def test_unknown_dtc_code_still_surfaces_an_info_alert(client):
    res = client.post("/ingest", json=_reading(obd={"rpm": 1710, "dtc": ["U9999"], "coolant_temp": 90, "battery_voltage": 12.5}))
    body = res.json()
    assert any("U9999" in a["message"] for a in body["alerts"])


def test_readings_and_alerts_are_queryable_for_the_mobile_app(client):
    client.post("/ingest", json=_reading(driving_score=40, events=["freinage_brusque"]))

    readings = client.get("/vehicles/GH-123-ABC/readings").json()
    assert len(readings) == 1
    assert readings[0]["driving_score"] == 40

    alerts = client.get("/vehicles/GH-123-ABC/alerts").json()
    assert len(alerts) >= 1
