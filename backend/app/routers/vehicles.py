from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..schemas import AlertOut, ReadingOut

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _get_vehicle_or_404(db: Session, vehicle_id: str) -> models.Vehicle:
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")
    return vehicle


@router.get("/{vehicle_id}/readings", response_model=list[ReadingOut])
def list_readings(vehicle_id: str, limit: int = 50, db: Session = Depends(get_db)):
    vehicle = _get_vehicle_or_404(db, vehicle_id)
    readings = (
        db.query(models.Reading)
        .filter_by(vehicle_id=vehicle.id)
        .order_by(models.Reading.timestamp.desc())
        .limit(limit)
        .all()
    )
    return readings


@router.get("/{vehicle_id}/alerts", response_model=list[AlertOut])
def list_alerts(vehicle_id: str, limit: int = 50, db: Session = Depends(get_db)):
    vehicle = _get_vehicle_or_404(db, vehicle_id)
    alerts = (
        db.query(models.Alert)
        .filter_by(vehicle_id=vehicle.id)
        .order_by(models.Alert.created_at.desc())
        .limit(limit)
        .all()
    )
    return alerts
