"""Carga del modelo XGBoost + SHAP explainer desde S3 al init del container."""
from __future__ import annotations
import json
import os
import pickle
import tempfile
from pathlib import Path

import boto3

S3_BUCKET = os.environ.get("MODEL_BUCKET", "edm-demo-models")
S3_PREFIX = os.environ.get("MODEL_PREFIX", "factoring/v1/latest")


class ModelBundle:
    """Singleton que carga el modelo + explainer una vez por container."""

    _instance = None

    def __init__(self):
        self.model = None
        self.explainer = None
        self.feature_names = None
        self.metrics = None
        self.version = None
        self._load()

    @classmethod
    def get(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load(self):
        s3 = boto3.client("s3")
        tmpdir = Path(tempfile.mkdtemp())
        for fname in ["model.pkl", "explainer.pkl", "feature_names.json", "metrics.json"]:
            key = f"{S3_PREFIX}/{fname}"
            local = tmpdir / fname
            s3.download_file(S3_BUCKET, key, str(local))

        self.model = pickle.loads((tmpdir / "model.pkl").read_bytes())
        self.explainer = pickle.loads((tmpdir / "explainer.pkl").read_bytes())
        self.feature_names = json.loads((tmpdir / "feature_names.json").read_text())
        self.metrics = json.loads((tmpdir / "metrics.json").read_text())
        self.version = self.metrics.get("model_version", "v1")
        print(f"[model_loader] cargado modelo {self.version} - {len(self.feature_names)} features")
