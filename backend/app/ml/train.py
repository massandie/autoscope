"""Trains a minimal predictive-maintenance model (spec section D) on synthetic data.

Run: python -m app.ml.train
Produces app/ml/model.joblib used by app/ml/predict.py.
"""

import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

FEATURE_NAMES = ["rpm_trend", "dtc_frequency", "battery_voltage", "driving_score", "trip_distance_km"]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")


def generate_synthetic_dataset(n_samples: int = 2000, seed: int = 42):
    rng = np.random.default_rng(seed)

    rpm_trend = rng.normal(0, 150, n_samples)
    dtc_frequency = rng.poisson(1.2, n_samples)
    battery_voltage = rng.normal(12.4, 0.8, n_samples)
    driving_score = rng.uniform(30, 100, n_samples)
    trip_distance_km = rng.exponential(25, n_samples)

    X = np.column_stack([rpm_trend, dtc_frequency, battery_voltage, driving_score, trip_distance_km])

    risk_score = (
        0.002 * np.abs(rpm_trend)
        + 0.25 * dtc_frequency
        + 1.5 * np.clip(12.2 - battery_voltage, 0, None)
        + 0.01 * np.clip(60 - driving_score, 0, None)
    )
    y = (risk_score > np.percentile(risk_score, 75)).astype(int)

    return X, y


def train_and_save() -> str:
    X, y = generate_synthetic_dataset()
    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X, y)
    joblib.dump({"model": model, "feature_names": FEATURE_NAMES}, MODEL_PATH)
    return MODEL_PATH


if __name__ == "__main__":
    path = train_and_save()
    print(f"Modèle entraîné et sauvegardé dans {path}")
