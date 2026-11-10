def test_mechanic_endpoints_reject_unauthenticated_requests(client):
    assert client.get("/mechanic/vehicles").status_code == 401


def test_login_rejects_wrong_password(client):
    res = client.post("/mechanic/auth/login", json={"username": "test-mechanic", "password": "wrong"})
    assert res.status_code == 401


def test_login_succeeds_and_grants_access(client, mechanic_token):
    res = client.get("/mechanic/vehicles", headers={"Authorization": f"Bearer {mechanic_token}"})
    assert res.status_code == 200
    assert res.json() == []


def test_garbage_token_is_rejected(client):
    res = client.get("/mechanic/vehicles", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_mechanic_can_add_and_read_notes(client, mechanic_token):
    headers = {"Authorization": f"Bearer {mechanic_token}"}
    client.post(
        "/ingest",
        json={
            "vehicle_id": "GH-999",
            "timestamp": "2026-01-01T08:00:00Z",
            "location": {"lat": 5.56, "lon": -0.21, "speed": 48},
            "driving_score": 72,
            "events": [],
            "obd": {"rpm": 1710, "dtc": [], "coolant_temp": 90, "battery_voltage": 12.5},
        },
    )

    res = client.post(
        "/mechanic/vehicles/GH-999/notes",
        headers=headers,
        json={"mechanic_name": "Yao", "note": "Plaquettes à changer", "recommended_parts": ["plaquettes avant"]},
    )
    assert res.status_code == 200

    notes = client.get("/mechanic/vehicles/GH-999/notes", headers=headers).json()
    assert len(notes) == 1
    assert notes[0]["note"] == "Plaquettes à changer"
