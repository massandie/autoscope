import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import models
from .database import Base, SessionLocal, engine
from .routers import ingest, mechanic, partners, vehicles
from .security import seed_default_mechanic

if not os.environ.get("AUTOSCOPE_SKIP_AUTO_CREATE"):
    # Convenience for local SQLite dev. Production/Postgres deployments should instead run
    # `alembic upgrade head` and set AUTOSCOPE_SKIP_AUTO_CREATE=1 — see backend/README.md.
    Base.metadata.create_all(bind=engine)

with SessionLocal() as _db:
    seed_default_mechanic(_db)

app = FastAPI(title="Autoscope API", version="0.1.0")

app.include_router(ingest.router)
app.include_router(vehicles.router)
app.include_router(mechanic.router)
app.include_router(partners.router)

_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/portal/mechanic", StaticFiles(directory=os.path.join(_STATIC_DIR, "mechanic"), html=True), name="mechanic-portal")


@app.get("/health")
def health():
    return {"status": "ok"}
