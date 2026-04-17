"""
Per-User Anomaly Detection Engine
==================================
Single model: IsolationForest — the industry-standard unsupervised
anomaly detection algorithm used by AWS Fraud Detector, Stripe Radar,
and major banks.

Why one model (not three):
  - IsolationForest alone achieves the same detection quality for our
    data size (15–100 samples per user) without the complexity of
    LOF (unstable at small k) or Z-score (assumes Gaussian).
  - Simpler model = easier to audit, deploy, and explain to regulators.

We additionally compute:
  - Baseline stats per user (mean/std/percentiles) — used by rule engine.
  - Behavioral embedding (centroid + spread) — used for drift detection
    between sessions. Drift is just L2 distance, not a separate model.
"""

import os
import json
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session
from database import Transaction

MODELS_DIR = os.getenv("MODELS_DIR", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLS = [
    "typing_speed_ms",
    "otp_time_sec",
    "session_duration_sec",
    "amount",
    "hour_of_day",
    "mouse_movement_score",
    "backspace_count",
]


class UserMLModel:
    @staticmethod
    def _model_path(user_id: int) -> str:
        return os.path.join(MODELS_DIR, f"{user_id}_model.pkl")

    @staticmethod
    def _baseline_path(user_id: int) -> str:
        return os.path.join(MODELS_DIR, f"{user_id}_baseline.json")

    @staticmethod
    def _embedding_path(user_id: int) -> str:
        return os.path.join(MODELS_DIR, f"{user_id}_embedding.json")

    @staticmethod
    def _extract_features(txns) -> np.ndarray:
        features = []
        for t in txns:
            features.append([
                t.typing_speed_ms,
                t.otp_time_sec,
                t.session_duration_sec,
                t.amount,
                t.hour_of_day,
                t.mouse_movement_score,
                t.backspace_count,
            ])
        return np.array(features)

    @staticmethod
    def train(user_id: int, db: Session) -> bool:
        txns = db.query(Transaction).filter(Transaction.user_id == user_id).all()
        if len(txns) < 10:
            return False

        X = UserMLModel._extract_features(txns)

        # --- Baseline statistics (used by rule engine, not ML) ---
        baseline = {}
        for i, col in enumerate(FEATURE_COLS):
            vals = X[:, i]
            std = float(np.std(vals))
            baseline[col] = {
                "mean": float(np.mean(vals)),
                "std": std if std > 0 else 1.0,
                "min": float(np.min(vals)),
                "max": float(np.max(vals)),
                "median": float(np.median(vals)),
                "p25": float(np.percentile(vals, 25)),
                "p75": float(np.percentile(vals, 75)),
            }

        # --- Scaler (standardize features before feeding to IsolationForest) ---
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # --- IsolationForest ---
        # contamination=0.1 → expect ~10% anomalies
        # n_estimators=150 → 150 trees, majority vote
        # max_features=0.8 → each tree sees 80% of features (reduces overfit)
        iso_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=150,
            max_features=0.8,
        )
        iso_forest.fit(X_scaled)

        # --- Behavioral Embedding (centroid + spread) for drift detection ---
        embedding = {
            "centroid": X_scaled.mean(axis=0).tolist(),
            "std": X_scaled.std(axis=0).tolist(),
            "n_samples": len(X),
        }

        # --- Persist ---
        bundle = {
            "isolation_forest": iso_forest,
            "scaler": scaler,
        }
        joblib.dump(bundle, UserMLModel._model_path(user_id))

        with open(UserMLModel._baseline_path(user_id), "w") as f:
            json.dump(baseline, f, indent=2)

        with open(UserMLModel._embedding_path(user_id), "w") as f:
            json.dump(embedding, f, indent=2)

        return True

    @staticmethod
    def predict(user_id: int, features: dict) -> dict:
        """Score a single transaction against the user's baseline.
        Returns an adjustment in the range roughly [-7, +22] points that
        gets added to the rule-based score.
        """
        model_path = UserMLModel._model_path(user_id)

        if not os.path.exists(model_path):
            return {"adjustment": 0.0, "anomaly_score": 0.0, "confidence": 0.0}

        bundle = joblib.load(model_path)

        fv = np.array([[
            features.get("typing_speed_ms", 150),
            features.get("otp_time_sec", 5.0),
            features.get("session_duration_sec", 30),
            features.get("amount", 2000),
            features.get("hour_of_day", 12),
            features.get("mouse_movement_score", 50),
            features.get("backspace_count", 2),
        ]])

        scaler = bundle["scaler"]
        fv_scaled = scaler.transform(fv)

        # IsolationForest: score_samples returns negative for anomalies.
        # Mapped to 0..1 where 1 = very anomalous.
        iso_raw = bundle["isolation_forest"].score_samples(fv_scaled)[0]
        anomaly_score = max(0.0, min(1.0, 0.5 - iso_raw))

        # Scale to adjustment: centered around 0.25 (a typical normal point)
        # and multiplied by 30 so final range is ~ [-7.5, +22.5].
        adjustment = round((anomaly_score - 0.25) * 30, 2)

        # Confidence: distance from decision boundary.
        # score_samples is monotonic, further from 0.5 = more confident.
        confidence = round(min(1.0, abs(iso_raw) * 2), 2)

        return {
            "adjustment": adjustment,
            "anomaly_score": round(anomaly_score, 3),
            "confidence": confidence,
        }

    @staticmethod
    def get_drift_score(user_id: int, features: dict) -> float:
        """Behavioral drift — how far current behavior is from the user's
        centroid. Not a model, just euclidean distance in scaled space.
        Returns 0..1 where 1 = very different from normal behavior.
        """
        emb_path = UserMLModel._embedding_path(user_id)
        model_path = UserMLModel._model_path(user_id)
        if not os.path.exists(emb_path) or not os.path.exists(model_path):
            return 0.0

        with open(emb_path, "r") as f:
            emb = json.load(f)

        bundle = joblib.load(model_path)
        scaler = bundle["scaler"]

        fv = np.array([[
            features.get("typing_speed_ms", 150),
            features.get("otp_time_sec", 5.0),
            features.get("session_duration_sec", 30),
            features.get("amount", 2000),
            features.get("hour_of_day", 12),
            features.get("mouse_movement_score", 50),
            features.get("backspace_count", 2),
        ]])
        fv_scaled = scaler.transform(fv)[0]

        centroid = np.array(emb["centroid"])
        distance = np.linalg.norm(fv_scaled - centroid)
        normalized = min(1.0, distance / 5.0)
        return round(normalized, 3)

    @staticmethod
    def should_train(txn_count: int, model_trained: bool) -> bool:
        if txn_count >= 15 and not model_trained:
            return True
        if txn_count > 15 and txn_count % 10 == 0:
            return True
        return False

    @staticmethod
    def get_baseline(user_id: int) -> dict:
        baseline_path = UserMLModel._baseline_path(user_id)
        if os.path.exists(baseline_path):
            with open(baseline_path, "r") as f:
                return json.load(f)
        return {}
