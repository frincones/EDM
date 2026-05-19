"""
AWS Lambda handler: API REST de scoring para el Factoring Signals Engine.
Construido con FastAPI + Mangum (ASGI -> Lambda adapter).

Endpoints:
  GET  /health                  - keep-warm
  POST /score                   - score por par (proveedor, comprador) o por factura
  POST /score-and-emit          - score + insert automatico a signals (target de webhooks)
  POST /score-batch             - score multiple en una llamada
"""
from __future__ import annotations
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from mangum import Mangum
from pydantic import BaseModel

from app.model_loader import ModelBundle
from app.supabase_client import get_features, get_relacion_by_factura, insert_signal


app = FastAPI(title="EDM Factoring Signals Engine", version="1.0.0")

FEATURE_LABELS_ES = {
    "ticket_avg_30d": "Ticket promedio 30d",
    "ticket_avg_90d": "Ticket promedio 90d",
    "delta_facturacion_30v90": "Variacion facturacion 30v90",
    "delta_facturacion_30v180": "Variacion facturacion 30v180",
    "delta_vs_mismo_mes_ya": "Variacion vs mismo mes año anterior",
    "delta_plazo_30v90": "Cambio plazo 30v90",
    "delta_plazo_30v180": "Cambio plazo 30v180",
    "is_pico_cosecha_agro": "Pico cosecha agricola",
    "is_q4": "Esta en Q4",
    "tasa_aceptacion_historica": "Tasa aceptacion historica",
}


class ScoreRequest(BaseModel):
    relacion_id: Optional[str] = None
    factura_id: Optional[str] = None
    proveedor_id: Optional[str] = None
    comprador_id: Optional[str] = None


def _humanize(feature: str, value: float, contrib: float) -> str:
    if feature == "delta_facturacion_30v180" and value > 0.20:
        return f"Facturacion crecio {int(value*100)}% vs ultimos 6 meses"
    if feature == "delta_plazo_30v180" and value < -5:
        return f"Plazos se acortaron {int(abs(value))} dias recientemente"
    if feature == "is_pico_cosecha_agro" and value > 0.5:
        return "Esta en pico de cosecha agricola"
    if feature == "is_q4" and value > 0.5:
        return "En temporada Q4 (alta del comercio)"
    if feature == "tasa_aceptacion_historica" and value > 0.3:
        return f"Ha aceptado factoring {int(value*100)}% de las veces"
    if feature == "delta_vs_mismo_mes_ya" and value > 0.20:
        return f"Crecimiento estacional de {int(value*100)}% YoY"
    label = FEATURE_LABELS_ES.get(feature, feature)
    direction = "alto" if contrib > 0 else "bajo"
    return f"{label}: {direction}"


def _score_features(features: dict) -> dict:
    """Aplica modelo a features dict, retorna score + top razones."""
    bundle = ModelBundle.get()
    feature_names = bundle.feature_names
    x = np.array([[float(features.get(f, 0) or 0) for f in feature_names]], dtype="float64")
    proba = float(bundle.model.predict_proba(x)[0, 1])

    shap_vals = bundle.explainer.shap_values(x)
    abs_contribs = np.abs(shap_vals[0])
    top_idx = np.argsort(abs_contribs)[::-1][:3]
    razones = []
    for j in top_idx:
        feat = feature_names[j]
        val = float(x[0, j])
        contrib = float(shap_vals[0][j])
        razones.append({
            "feature": feat,
            "value": val,
            "contribution": contrib,
            "label": _humanize(feat, val, contrib),
        })
    return {"score": proba, "razones": razones, "model_version": bundle.version}


@app.get("/health")
def health():
    bundle = ModelBundle.get()
    return {
        "status": "ok",
        "model_version": bundle.version,
        "n_features": len(bundle.feature_names),
    }


@app.post("/score")
def score(req: ScoreRequest):
    # Si vino factura_id, derivamos relacion_id
    relacion_id = req.relacion_id
    if not relacion_id and req.factura_id:
        f = get_relacion_by_factura(req.factura_id)
        if not f:
            raise HTTPException(404, f"factura {req.factura_id} no encontrada")
        relacion_id = f["relacion_id"]

    if not relacion_id:
        raise HTTPException(400, "se requiere relacion_id o factura_id")

    features = get_features(relacion_id)
    if not features:
        raise HTTPException(404, f"features para relacion {relacion_id} no encontradas")

    out = _score_features(features)
    out["relacion_id"] = relacion_id
    return out


@app.post("/score-and-emit")
def score_and_emit(req: ScoreRequest):
    """Target del Database Webhook de Supabase. Scorea + INSERT en signals."""
    factura_id = req.factura_id
    if not factura_id:
        raise HTTPException(400, "factura_id requerida")

    f = get_relacion_by_factura(factura_id)
    if not f:
        raise HTTPException(404, f"factura {factura_id} no encontrada")

    features = get_features(f["relacion_id"])
    if not features:
        raise HTTPException(404, "features no encontradas")

    out = _score_features(features)

    ticket = features.get("ticket_avg_30d") or 0
    try:
        monto_pot = int(float(ticket) * 3)
    except (TypeError, ValueError):
        monto_pot = None

    ok = insert_signal({
        "proveedor_id": f["proveedor_id"],
        "comprador_id": f["comprador_id"],
        "factura_id": factura_id,
        "score": out["score"],
        "rank": None,
        "monto_potencial_centavos": monto_pot,
        "razones": out["razones"],
        "model_version": out["model_version"],
    })

    return {"emitted": ok, **out, "factura_id": factura_id}


@app.post("/score-batch")
def score_batch(items: list[ScoreRequest]):
    results = []
    for it in items:
        try:
            results.append(score(it))
        except HTTPException as e:
            results.append({"error": e.detail, "input": it.model_dump()})
    return {"results": results}


# Mangum adapter: convierte el ASGI app de FastAPI en Lambda handler
handler = Mangum(app, lifespan="off")
