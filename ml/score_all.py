"""
Scorea TODAS las relaciones activas con el modelo entrenado.
Inserta una fila por relacion en la tabla `signals` con score + razones SHAP.

Esto pre-popula el dashboard para que cuando Felipe vea la demo, ya haya
84 leads rankeados listos.
"""
from __future__ import annotations
import json
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import shap

from data.generator.supabase_client import mgmt_sql, rest_post


ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODEL_VERSION = "v1"

FEATURE_NAMES = json.loads((ARTIFACTS_DIR / "feature_names.json").read_text())
FEATURE_LABELS_ES = {
    "ticket_avg_30d": "Ticket promedio ultimos 30 dias",
    "ticket_avg_90d": "Ticket promedio ultimos 90 dias",
    "ticket_avg_180d": "Ticket promedio ultimos 180 dias",
    "n_facturas_30d": "Facturas emitidas en 30 dias",
    "n_facturas_180d": "Facturas emitidas en 180 dias",
    "delta_facturacion_30v90": "Δ facturacion 30d vs 90d",
    "delta_facturacion_30v180": "Δ facturacion 30d vs 180d",
    "delta_vs_mismo_mes_ya": "Δ vs mismo mes año anterior",
    "plazo_avg_30d": "Plazo promedio 30d",
    "plazo_avg_90d": "Plazo promedio 90d",
    "plazo_avg_180d": "Plazo promedio 180d",
    "delta_plazo_30v90": "Cambio plazo 30v90",
    "delta_plazo_30v180": "Cambio plazo 30v180 (compresion)",
    "ratio_pagos_tardios_90d": "Ratio pagos tardios 90d",
    "n_ofertas_historicas": "Ofertas factoring historicas",
    "tasa_aceptacion_historica": "Tasa aceptacion historica",
    "dias_desde_ultima_oferta": "Dias desde ultima oferta",
    "comprador_plazo_promedio": "Plazo tipico del comprador",
    "comprador_estacionalidad_q4": "Estacionalidad Q4 del comprador",
    "mes_actual": "Mes actual",
    "trimestre_actual": "Trimestre actual",
    "is_q4": "Esta en Q4",
    "is_pico_cosecha_agro": "Pico de cosecha agricola",
}


def humanize_reason(feature: str, value: float, contribution: float) -> str:
    """Genera frase corta en español para una razón SHAP."""
    label = FEATURE_LABELS_ES.get(feature, feature)
    direction = "ALTO" if contribution > 0 else "BAJO"
    if feature == "delta_facturacion_30v180":
        if value > 0.2:
            return f"Facturación creció {int(value*100)}% vs últimos 6 meses"
        elif value < -0.2:
            return f"Facturación bajó {int(abs(value)*100)}% vs últimos 6 meses"
    if feature == "delta_plazo_30v180":
        if value < -5:
            return f"Plazos de cobro se acortaron {abs(int(value))} días recientemente"
    if feature == "is_pico_cosecha_agro" and value > 0.5:
        return "Está en pico de cosecha agrícola"
    if feature == "is_q4" and value > 0.5:
        return "En temporada Q4 (alta del comercio)"
    if feature == "tasa_aceptacion_historica" and value > 0.3:
        return f"Ha aceptado factoring {int(value*100)}% de las veces"
    if feature == "n_facturas_30d" and contribution > 0:
        return f"Alta actividad reciente ({int(value)} facturas en 30d)"
    if feature == "delta_vs_mismo_mes_ya":
        if value > 0.2:
            return f"Crecimiento estacional de {int(value*100)}% YoY"
    return f"{label}: {direction}"


def main():
    print("== Cargando modelo ==")
    model = pickle.loads((ARTIFACTS_DIR / "model.pkl").read_bytes())
    explainer = shap.TreeExplainer(model)

    print("== Pulling features_par + master data ==")
    status, body = mgmt_sql("""
        SELECT f.relacion_id, f.proveedor_id, f.comprador_id, f.snapshot_at,
          ticket_avg_30d, ticket_avg_90d, ticket_avg_180d,
          n_facturas_30d, n_facturas_180d,
          delta_facturacion_30v90, delta_facturacion_30v180,
          delta_vs_mismo_mes_ya,
          plazo_avg_30d, plazo_avg_90d, plazo_avg_180d,
          delta_plazo_30v90, delta_plazo_30v180,
          ratio_pagos_tardios_90d,
          n_ofertas_historicas, tasa_aceptacion_historica,
          dias_desde_ultima_oferta,
          comprador_plazo_promedio, comprador_estacionalidad_q4,
          mes_actual, trimestre_actual, is_q4, is_pico_cosecha_agro,
          p.razon_social as proveedor_nombre, p.arquetipo, p.sector_nombre
        FROM features_par f
        JOIN proveedores p ON p.id = f.proveedor_id;
    """)
    rows = json.loads(body)
    df = pd.DataFrame(rows)
    print(f"   {len(df)} relaciones")

    for c in FEATURE_NAMES:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype("float64")

    X = df[FEATURE_NAMES].astype("float64").values
    print(f"   X shape: {X.shape}")

    probas = model.predict_proba(X)[:, 1]
    shap_values = explainer.shap_values(X)

    print("== Top 5 leads ==")
    df["score"] = probas
    top = df.sort_values("score", ascending=False).head(10)
    print(top[["proveedor_nombre", "arquetipo", "score"]].to_string(index=False))

    print("\n== Inserting into signals table ==")
    signals_rows = []
    for i in range(len(df)):
        row = df.iloc[i]
        shap_row = shap_values[i]
        # top 3 contributions absolutas
        abs_contribs = np.abs(shap_row)
        top_idx = np.argsort(abs_contribs)[::-1][:3]
        razones = []
        for j in top_idx:
            feat = FEATURE_NAMES[j]
            value = float(X[i, j])
            contrib = float(shap_row[j])
            razones.append({
                "feature": feat,
                "value": value,
                "contribution": contrib,
                "label": humanize_reason(feat, value, contrib),
            })
        # estimar monto potencial: usa ticket promedio 30d como proxy
        ticket = float(row["ticket_avg_30d"]) if not pd.isna(row["ticket_avg_30d"]) else 0
        monto_pot = int(ticket * 3)  # ~3 facturas tipicas

        signals_rows.append({
            "proveedor_id": row["proveedor_id"],
            "comprador_id": row["comprador_id"],
            "factura_id": None,
            "score": float(probas[i]),
            "rank": None,
            "monto_potencial_centavos": monto_pot,
            "razones": razones,
            "model_version": MODEL_VERSION,
        })

    # Ordenar por score y asignar rank
    signals_rows.sort(key=lambda r: r["score"], reverse=True)
    for idx, r in enumerate(signals_rows):
        r["rank"] = idx + 1

    # Limpiar signals viejos primero
    print("   limpiando signals previos...")
    mgmt_sql("DELETE FROM signals WHERE created_at < NOW();")

    # Insert en chunks
    print(f"   insertando {len(signals_rows)} signals...")
    status, body = rest_post("signals", signals_rows)
    if status >= 300:
        print(f"   ERROR status={status}: {body[:500]}")
    else:
        print(f"   OK")

    # Verificacion
    status, body = mgmt_sql("""
        SELECT COUNT(*) as n,
               ROUND(AVG(score)::numeric, 3) as avg_score,
               ROUND(MAX(score)::numeric, 3) as max_score,
               ROUND(MIN(score)::numeric, 3) as min_score
        FROM signals;
    """)
    print("== Signals stats ==")
    print(body)


if __name__ == "__main__":
    main()
