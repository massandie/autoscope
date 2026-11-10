import os
import sys

os.environ["AUTOSCOPE_PARTNER_API_KEYS"] = "test-insurer-key"
os.environ["AUTOSCOPE_DEFAULT_MECHANIC_USERNAME"] = "test-mechanic"
os.environ["AUTOSCOPE_DEFAULT_MECHANIC_PASSWORD"] = "test-password-123"
# Harmless throwaway target for app.main's own module-level engine/create_all/seed — every
# request in tests goes through the get_db override below, against a separate StaticPool engine.
os.environ["AUTOSCOPE_DATABASE_URL"] = "sqlite:///:memory:"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.security import seed_default_mechanic


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        seed_default_mechanic(db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    from app.main import app

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def mechanic_token(client):
    res = client.post(
        "/mechanic/auth/login",
        json={"username": "test-mechanic", "password": "test-password-123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]
