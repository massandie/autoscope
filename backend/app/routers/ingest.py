from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..maintenance import due_for_service, estimate_distance_km, maintenance_reminder_alert
from ..ml.predict import predict_failure_risk
from ..rules import evaluate
from ..schemas import IngestResult, ReadingIn

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _get_or_create_vehicle(db: Session, vehicle_id: str) -> models.Vehicle:
    vehicle = db.query(models.Vehicle).filter_by(vehicle_id=vehicle_id).first()
    if vehicle is None:
        vehicle = models.Vehicle(vehicle_id=vehicle_id)
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
    return vehicle


def _update_odometer_and_check_service(db: Session, vehicle: models.Vehicle, payload: ReadingIn) -> dict | None:
    previous_reading = (
        db.query(models.Reading)
        .filter_by(vehicle_id=vehicle.id)
        .order_by(models.Reading.timestamp.desc())
        .first()
    )
    if previous_reading is not None:
        elapsed_seconds = (payload.timestamp - previous_reading.timestamp).total_seconds()
        vehicle.odometer_km += estimate_distance_km(payload.location.speed, elapsed_seconds)

    if not due_for_service(vehicle.odometer_km, vehicle.last_service_odometer_km, vehicle.last_service_at):
        return None

    already_reminded = (
        db.query(models.Alert)
        .filter(
            models.Alert.vehicle_id == vehicle.id,
            models.Alert.category == "maintenance",
            models.Alert.created_at >= (vehicle.last_service_at or vehicle.created_at),
        )
        .first()
    )
    if already_reminded is not None:
        return None

    return maintenance_reminder_alert(vehicle.odometer_km, vehicle.last_service_odometer_km)


@router.post("", response_model=IngestResult)
def ingest_reading(payload: ReadingIn, db: Session = Depends(get_db)):
    # Stored/compared as naive UTC: DateTime columns (SQLite and Postgres alike) round-trip naive values.
    if payload.timestamp.tzinfo is not None:
        payload.timestamp = payload.timestamp.astimezone(timezone.utc).replace(tzinfo=None)

    vehicle = _get_or_create_vehicle(db, payload.vehicle_id)
    maintenance_alert = _update_odometer_and_check_service(db, vehicle, payload)

    reading = models.Reading(
        vehicle_id=vehicle.id,
        timestamp=payload.timestamp,
        lat=payload.location.lat,
        lon=payload.location.lon,
        speed=payload.location.speed,
        driving_score=payload.driving_score,
        events=payload.events,
        rpm=payload.obd.rpm,
        dtc=payload.obd.dtc,
        coolant_temp=payload.obd.coolant_temp,
        battery_voltage=payload.obd.battery_voltage,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    result = evaluate(payload)

    ml_result = predict_failure_risk(
        rpm_trend=(payload.obd.rpm or 800) - 800,
        dtc_frequency=len(payload.obd.dtc),
        battery_voltage=payload.obd.battery_voltage or 12.4,
        driving_score=payload.driving_score or 80,
        trip_distance_km=1.0,
    )
    if ml_result["predicted_issue"]:
        result.alerts.append(
            {
                "category": "predictive",
                "severity": "warning" if ml_result["confidence"] < 0.7 else "critical",
                "message": ml_result["predicted_issue"],
                "recommended_action": "Planifier une inspection préventive",
            }
        )
        result.predicted_issue = ml_result["predicted_issue"]

    if maintenance_alert is not None:
        result.alerts.append(maintenance_alert)

    db.add(vehicle)

    saved_alerts = []
    for alert in result.alerts:
        db_alert = models.Alert(
            vehicle_id=vehicle.id,
            reading_id=reading.id,
            category=alert["category"],
            severity=alert["severity"],
            message=alert["message"],
            recommended_action=alert.get("recommended_action"),
        )
        db.add(db_alert)
        saved_alerts.append(db_alert)
    db.commit()
    for a in saved_alerts:
        db.refresh(a)

    return IngestResult(reading=reading, alerts=saved_alerts, predicted_issue=result.predicted_issue)
