def _reading(vehicle_id, timestamp, speed):
    return {
        "vehicle_id": vehicle_id,
        "timestamp": timestamp,
        "location": {"lat": 5.56, "lon": -0.21, "speed": speed},
        "driving_score": 90,
        "events": [],
        "obd": {"rpm": 1500, "dtc": [], "coolant_temp": 90, "battery_voltage": 12.5},
    }


def test_maintenance_reminder_fires_after_distance_threshold(client):
    client.post("/ingest", json=_reading("FLEET-001", "2026-01-01T08:00:00Z", 60))
    # +90h at 60km/h ≈ 5400km, past the 5000km service interval
    res = client.post("/ingest", json=_reading("FLEET-001", "2026-01-05T02:00:00Z", 60))

    alerts = res.json()["alerts"]
    assert any(a["category"] == "maintenance" for a in alerts)


def test_maintenance_reminder_does_not_repeat_every_reading(client):
    client.post("/ingest", json=_reading("FLEET-002", "2026-01-01T08:00:00Z", 60))
    first = client.post("/ingest", json=_reading("FLEET-002", "2026-01-05T02:00:00Z", 60))
    assert any(a["category"] == "maintenance" for a in first.json()["alerts"])

    second = client.post("/ingest", json=_reading("FLEET-002", "2026-01-05T03:00:00Z", 60))
    assert not any(a["category"] == "maintenance" for a in second.json()["alerts"])


def test_service_complete_resets_the_reminder(client, mechanic_token):
    headers = {"Authorization": f"Bearer {mechanic_token}"}

    client.post("/ingest", json=_reading("FLEET-003", "2026-01-01T08:00:00Z", 60))
    client.post("/ingest", json=_reading("FLEET-003", "2026-01-05T02:00:00Z", 60))

    res = client.post("/mechanic/vehicles/FLEET-003/service-complete", headers=headers)
    assert res.status_code == 200
    assert res.json()["odometer_km"] > 5000

    after = client.post("/ingest", json=_reading("FLEET-003", "2026-01-05T03:00:00Z", 60))
    assert not any(a["category"] == "maintenance" for a in after.json()["alerts"])
