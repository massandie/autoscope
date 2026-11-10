def _reading(vehicle_id, speed, driving_score, events=None):
    return {
        "vehicle_id": vehicle_id,
        "timestamp": "2026-01-01T08:00:00Z",
        "location": {"lat": 5.56, "lon": -0.21, "speed": speed},
        "driving_score": driving_score,
        "events": events or [],
        "obd": {"rpm": 1500, "dtc": [], "coolant_temp": 90, "battery_voltage": 12.5},
    }


def test_usage_scores_require_api_key(client):
    assert client.get("/partners/usage-scores").status_code in (401, 422)


def test_usage_scores_reject_wrong_api_key(client):
    res = client.get("/partners/usage-scores", headers={"x-api-key": "wrong-key"})
    assert res.status_code == 401


def test_usage_scores_are_anonymized_and_scored(client):
    client.post("/ingest", json=_reading("GH-1", 48, 85))

    res = client.get("/partners/usage-scores", headers={"x-api-key": "test-insurer-key"})
    assert res.status_code == 200
    scores = res.json()
    assert len(scores) == 1
    assert scores[0]["anonymized_vehicle_ref"].startswith("ANON-")
    assert scores[0]["anonymized_vehicle_ref"] != "GH-1"
    assert "predicted_maintenance_risk" in scores[0]


def test_fleet_manager_endpoint_uses_real_vehicle_id(client):
    client.post("/ingest", json=_reading("FLEET-X", 48, 85))

    res = client.get("/partners/usage-scores/FLEET-X", headers={"x-api-key": "test-insurer-key"})
    assert res.status_code == 200
    assert res.json()["anonymized_vehicle_ref"] == "FLEET-X"


def test_poor_driving_score_yields_higher_risk_tier(client):
    client.post("/ingest", json=_reading("GH-RISKY", 90, 30, events=["freinage_brusque", "exces_de_vitesse"]))

    res = client.get("/partners/usage-scores/GH-RISKY", headers={"x-api-key": "test-insurer-key"})
    assert res.json()["risk_tier"] == "élevé"
