import os
from functools import lru_cache

import joblib
import numpy as np

from .train import MODEL_PATH, train_and_save


@lru_cache(maxsize=1)
def _load_model():
    if not os.path.exists(MODEL_PATH):
        train_and_save()
    bundle = joblib.load(MODEL_PATH)
    return bundle["model"]


def predict_failure_risk(
    rpm_trend: float,
    dtc_frequency: int,
    battery_voltage: float,
    driving_score: float,
    trip_distance_km: float,
) -> dict:
    model = _load_model()
    features = np.array([[rpm_trend, dtc_frequency, battery_voltage, driving_score, trip_distance_km]])
    proba = model.predict_proba(features)[0][1]

    if proba >= 0.7:
        issue = "Panne majeure probable (alternateur, batterie ou allumage) dans les prochaines semaines"
    elif proba >= 0.4:
        issue = "Risque de panne modéré détecté, surveillance recommandée"
    else:
        issue = None

    return {"confidence": round(float(proba), 3), "predicted_issue": issue}
