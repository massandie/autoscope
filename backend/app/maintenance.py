"""Rappels d'entretien programmés (spec §E, catégorie « maintenance »).

Deux déclencheurs, indépendants de l'OBD/ML :
- kilométrage parcouru depuis la dernière vidange (odomètre estimé via vitesse * durée)
- temps écoulé depuis la dernière visite d'entretien
"""

from datetime import datetime, timedelta, timezone

SERVICE_INTERVAL_KM = 5000.0
SERVICE_INTERVAL_DAYS = 180


def estimate_distance_km(speed_kmh: float | None, elapsed_seconds: float) -> float:
    if speed_kmh is None or speed_kmh <= 0 or elapsed_seconds <= 0:
        return 0.0
    return speed_kmh * (elapsed_seconds / 3600.0)


def due_for_service(odometer_km: float, last_service_odometer_km: float, last_service_at: datetime | None) -> bool:
    km_since_service = odometer_km - last_service_odometer_km
    if km_since_service >= SERVICE_INTERVAL_KM:
        return True

    if last_service_at is not None:
        age = datetime.now(timezone.utc) - last_service_at.replace(tzinfo=timezone.utc)
        if age >= timedelta(days=SERVICE_INTERVAL_DAYS):
            return True

    return False


def maintenance_reminder_alert(odometer_km: float, last_service_odometer_km: float) -> dict:
    km_since_service = round(odometer_km - last_service_odometer_km, 1)
    return {
        "category": "maintenance",
        "severity": "info",
        "message": f"Vidange recommandée : {km_since_service} km parcourus depuis le dernier entretien",
        "recommended_action": "Planifier une vidange et un contrôle général",
    }
