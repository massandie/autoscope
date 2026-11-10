"""Rule-based diagnostic and behavioral alert engine (spec sections B & C)."""

from dataclasses import dataclass

from .schemas import ReadingIn

# Minimal DTC knowledge base: code -> (message, recommended action, severity)
DTC_RULES: dict[str, tuple[str, str, str]] = {
    "P0301": ("Raté d'allumage détecté sur le cylindre 1", "Inspecter la bougie et la bobine du cylindre 1", "warning"),
    "P0302": ("Raté d'allumage détecté sur le cylindre 2", "Inspecter la bougie et la bobine du cylindre 2", "warning"),
    "P0171": ("Mélange air/carburant trop riche", "Vérifier les capteurs d'oxygène et le débitmètre d'air", "warning"),
    "P0420": ("Efficacité du catalyseur insuffisante", "Faire contrôler le pot catalytique", "warning"),
    "P0562": ("Tension système basse", "Contrôler la batterie et l'alternateur", "critical"),
}

COOLANT_OVERHEAT_C = 105.0
LOW_BATTERY_VOLTAGE = 11.8
HARSH_BRAKE_DECEL_MS2 = -5.0


@dataclass
class EngineResult:
    alerts: list[dict]
    predicted_issue: str | None


def evaluate(reading: ReadingIn) -> EngineResult:
    alerts: list[dict] = []

    for code in reading.obd.dtc:
        rule = DTC_RULES.get(code)
        if rule:
            message, action, severity = rule
            alerts.append(
                {
                    "category": "diagnostic",
                    "severity": severity,
                    "message": f"[{code}] {message}",
                    "recommended_action": action,
                }
            )
        else:
            alerts.append(
                {
                    "category": "diagnostic",
                    "severity": "info",
                    "message": f"Code défaut inconnu détecté : {code}",
                    "recommended_action": "Faire lire le code par un mécanicien certifié",
                }
            )

    if reading.obd.coolant_temp is not None and reading.obd.coolant_temp > COOLANT_OVERHEAT_C:
        alerts.append(
            {
                "category": "diagnostic",
                "severity": "critical",
                "message": f"Surchauffe moteur : {reading.obd.coolant_temp}°C",
                "recommended_action": "Arrêter le véhicule et laisser refroidir le moteur",
            }
        )

    if reading.obd.battery_voltage is not None and reading.obd.battery_voltage < LOW_BATTERY_VOLTAGE:
        alerts.append(
            {
                "category": "predictive",
                "severity": "warning",
                "message": f"Tension batterie faible : {reading.obd.battery_voltage}V",
                "recommended_action": "Faire tester la batterie et l'alternateur",
            }
        )

    if "freinage_brusque" in reading.events:
        alerts.append(
            {
                "category": "behavioral",
                "severity": "info",
                "message": "Freinage brusque détecté",
                "recommended_action": "Augmenter la distance de sécurité",
            }
        )

    if "virage_serre" in reading.events or "virage_gauche" in reading.events or "virage_droite" in reading.events:
        alerts.append(
            {
                "category": "behavioral",
                "severity": "info",
                "message": "Virage serré détecté",
                "recommended_action": "Réduire la vitesse avant les virages",
            }
        )

    if "risque_fatigue" in reading.events:
        alerts.append(
            {
                "category": "behavioral",
                "severity": "warning",
                "message": "Risque de fatigue : conduite prolongée sans pause",
                "recommended_action": "Faire une pause d'au moins 15 minutes sur une aire sécurisée",
            }
        )

    if reading.driving_score is not None and reading.driving_score < 50:
        alerts.append(
            {
                "category": "behavioral",
                "severity": "warning",
                "message": f"Score de conduite faible : {reading.driving_score}",
                "recommended_action": "Revoir les habitudes de freinage et de vitesse",
            }
        )

    predicted_issue = None
    if any(a["category"] == "predictive" for a in alerts):
        predicted_issue = "Panne de batterie ou d'alternateur probable dans les prochains jours"

    return EngineResult(alerts=alerts, predicted_issue=predicted_issue)


def classify_harsh_braking(decel_ms2: float) -> bool:
    return decel_ms2 <= HARSH_BRAKE_DECEL_MS2
