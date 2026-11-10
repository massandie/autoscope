"""API pour Assurance et Gestion de Flotte (spec section 3) : accès anonymisé, scoring UBI."""

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..auth import require_partner_api_key
from ..database import get_db
from ..ml.predict import predict_failure_risk
from ..schemas import UsageScore

router = APIRouter(prefix="/partners", tags=["partners"])


def _anonymize(vehicle_id: str) -> str:
    return "ANON-" + hashlib.sha256(vehicle_id.encode()).hexdigest()[:12]


def _compute_usage_score(db: Session, vehicle: models.Vehicle, ref: str) -> UsageScore | None:
    readings = (
        db.query(models.Reading).filter_by(vehicle_id=vehicle.id).order_by(models.Reading.timestamp).all()
    )
    if not readings:
        return None

    trip_count = len(readings)
    driving_scores = [r.driving_score for r in readings if r.driving_score is not None]
    avg_score = sum(driving_scores) / len(driving_scores) if driving_scores else None

    harsh_events = sum(1 for r in readings for e in (r.events or []) if "freinage_brusque" in e or "virage" in e)
    harsh_rate = harsh_events / trip_count if trip_count else 0.0

    latest = readings[-1]
    ml_result = predict_failure_risk(
        rpm_trend=(latest.rpm or 800) - 800,
        dtc_frequency=len(latest.dtc or []),
        battery_voltage=latest.battery_voltage or 12.4,
        driving_score=latest.driving_score or 80,
        trip_distance_km=vehicle.odometer_km,
    )
    maintenance_risk = ml_result["confidence"]

    if (avg_score is not None and avg_score >= 75 and harsh_rate < 0.3 and maintenance_risk < 0.4):
        risk_tier = "faible"
    elif maintenance_risk >= 0.7 or (avg_score is not None and avg_score < 50):
        risk_tier = "élevé"
    else:
        risk_tier = "modéré"

    return UsageScore(
        anonymized_vehicle_ref=ref,
        trip_count=trip_count,
        average_driving_score=round(avg_score, 1) if avg_score is not None else None,
        harsh_events_rate=round(harsh_rate, 3),
        predicted_maintenance_risk=round(maintenance_risk, 3),
        risk_tier=risk_tier,
    )


@router.get("/usage-scores", response_model=list[UsageScore], dependencies=[Depends(require_partner_api_key)])
def usage_based_insurance_scores(db: Session = Depends(get_db)):
    """Scoring télématique anonymisé par véhicule (comportement + risque ML), pour l'assurance à l'usage."""
    scores = []
    for v in db.query(models.Vehicle).all():
        score = _compute_usage_score(db, v, _anonymize(v.vehicle_id))
        if score is not None:
            scores.append(score)
    return scores


@router.get("/usage-scores/{vehicle_id}", response_model=UsageScore, dependencies=[Depends(require_partner_api_key)])
def usage_score_for_vehicle(vehicle_id: str, db: Session = Depends(get_db)):
    """Accès autorisé (non anonymisé côté identifiant) pour un gestionnaire de flotte."""
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

    score = _compute_usage_score(db, vehicle, vehicle.vehicle_id)
    if score is None:
        raise HTTPException(status_code=404, detail="Aucune donnée de trajet pour ce véhicule")
    return score
