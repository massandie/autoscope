"""Portail Mécanicien (spec section 2) : accès client autorisé + recommandations."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..schemas import (
    AlertOut,
    MechanicLoginRequest,
    MechanicNoteIn,
    MechanicNoteOut,
    MechanicTokenResponse,
    ServiceCompleteOut,
    VehicleSummary,
)
from ..security import create_access_token, get_current_mechanic, verify_password

router = APIRouter(prefix="/mechanic", tags=["mechanic"])


@router.post("/auth/login", response_model=MechanicTokenResponse)
def login(payload: MechanicLoginRequest, db: Session = Depends(get_db)):
    mechanic = db.query(models.Mechanic).filter_by(username=payload.username).first()
    if mechanic is None or not verify_password(payload.password, mechanic.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    token = create_access_token(mechanic.id, mechanic.username)
    return MechanicTokenResponse(access_token=token, full_name=mechanic.full_name)


@router.get("/vehicles", response_model=list[VehicleSummary], dependencies=[Depends(get_current_mechanic)])
def list_vehicles_with_status(db: Session = Depends(get_db)):
    """Résumé de tous les véhicules suivis — canal d'acquisition pour les garages."""
    vehicles = db.query(models.Vehicle).all()
    summaries = []
    for v in vehicles:
        alerts = db.query(models.Alert).filter_by(vehicle_id=v.id).all()
        latest_reading = (
            db.query(models.Reading)
            .filter_by(vehicle_id=v.id)
            .order_by(models.Reading.timestamp.desc())
            .first()
        )
        summaries.append(
            VehicleSummary(
                vehicle_id=v.vehicle_id,
                open_alerts=len(alerts),
                critical_alerts=sum(1 for a in alerts if a.severity == "critical"),
                latest_driving_score=latest_reading.driving_score if latest_reading else None,
                latest_reading_at=latest_reading.timestamp if latest_reading else None,
            )
        )
    return summaries


@router.get(
    "/vehicles/{vehicle_id}/alerts",
    response_model=list[AlertOut],
    dependencies=[Depends(get_current_mechanic)],
)
def vehicle_alerts_for_mechanic(vehicle_id: str, db: Session = Depends(get_db)):
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")
    return (
        db.query(models.Alert)
        .filter_by(vehicle_id=vehicle.id)
        .order_by(models.Alert.created_at.desc())
        .all()
    )


@router.post(
    "/vehicles/{vehicle_id}/notes",
    response_model=MechanicNoteOut,
    dependencies=[Depends(get_current_mechanic)],
)
def add_mechanic_note(vehicle_id: str, payload: MechanicNoteIn, db: Session = Depends(get_db)):
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

    note = models.MechanicNote(
        vehicle_id=vehicle.id,
        mechanic_name=payload.mechanic_name,
        note=payload.note,
        recommended_parts=payload.recommended_parts,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get(
    "/vehicles/{vehicle_id}/notes",
    response_model=list[MechanicNoteOut],
    dependencies=[Depends(get_current_mechanic)],
)
def list_mechanic_notes(vehicle_id: str, db: Session = Depends(get_db)):
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")
    return (
        db.query(models.MechanicNote)
        .filter_by(vehicle_id=vehicle.id)
        .order_by(models.MechanicNote.created_at.desc())
        .all()
    )


@router.post(
    "/vehicles/{vehicle_id}/service-complete",
    response_model=ServiceCompleteOut,
    dependencies=[Depends(get_current_mechanic)],
)
def mark_service_complete(vehicle_id: str, db: Session = Depends(get_db)):
    """Réinitialise le compteur d'entretien après une vidange/révision effectuée."""
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

    vehicle.last_service_odometer_km = vehicle.odometer_km
    vehicle.last_service_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    return ServiceCompleteOut(
        vehicle_id=vehicle.vehicle_id,
        odometer_km=vehicle.odometer_km,
        last_service_at=vehicle.last_service_at,
    )
