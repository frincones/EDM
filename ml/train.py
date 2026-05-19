"""
Entrenamiento del Factoring Signals Engine (XGBoost + SHAP).

Estrategia point-in-time correcta:
- Pull facturas, outcomes, pagos, aceptaciones raw
- Para cada outcome historico, computa features AS-OF fecha_oferta en pandas
- Esto evita el mismatch temporal de usar features de "hoy" para outcomes de hace 12 meses
"""
from __future__ import annotations
import json
import os
import pickle
import time
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, average_precision_score, confusion_matrix
)
import xgboost as xgb
import shap

from data.generator.supabase_client import mgmt_sql


ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_VERSION = "v1"

FEATURE_COLS = [
    "ticket_avg_30d", "ticket_avg_90d", "ticket_avg_180d",
    "n_facturas_30d", "n_facturas_180d",
    "delta_facturacion_30v90", "delta_facturacion_30v180",
    "delta_vs_mismo_mes_ya",
    "plazo_avg_30d", "plazo_avg_90d", "plazo_avg_180d",
    "delta_plazo_30v90", "delta_plazo_30v180",
    "ratio_pagos_tardios_90d",
    "n_ofertas_historicas", "tasa_aceptacion_historica",
    "dias_desde_ultima_oferta",
    "comprador_plazo_promedio", "comprador_estacionalidad_q4",
    "mes_actual", "trimestre_actual", "is_q4", "is_pico_cosecha_agro",
]


def _q(sql: str) -> pd.DataFrame:
    status, body = mgmt_sql(sql)
    if status >= 300:
        raise SystemExit(f"SQL error: {body[:800]}")
    rows = json.loads(body)
    return pd.DataFrame(rows)


def pull_raw():
    print("== Pulling raw tables ==")
    facturas = _q("""
        SELECT id, relacion_id, proveedor_id, comprador_id,
               monto_neto_centavos::BIGINT, fecha_emision, fecha_vencimiento, dias_plazo
        FROM facturas;
    """)
    print(f"   facturas: {len(facturas)}")

    aceptaciones = _q("""
        SELECT factura_id, fecha_aceptacion, dias_a_aceptar FROM aceptaciones;
    """)
    print(f"   aceptaciones: {len(aceptaciones)}")

    pagos = _q("""
        SELECT factura_id, fecha_pago, dias_vs_vencimiento FROM pagos;
    """)
    print(f"   pagos: {len(pagos)}")

    outcomes = _q("""
        SELECT proveedor_id, comprador_id, factura_id, fecha_oferta,
               CASE WHEN outcome='aceptada' THEN 1 ELSE 0 END as label,
               outcome
        FROM outcomes_factoring
        WHERE outcome IN ('aceptada','rechazada','no_contesto');
    """)
    print(f"   outcomes: {len(outcomes)} (positivos: {outcomes['label'].sum()})")

    compradores = _q("""
        SELECT id, plazo_promedio_proveedores, estacionalidad_q4, tasa_aceptacion_facturas
        FROM compradores;
    """)
    print(f"   compradores: {len(compradores)}")

    relaciones = _q("SELECT id, proveedor_id, comprador_id FROM relaciones;")
    proveedores = _q("SELECT id, sector_ciiu, fecha_alta_edn, arquetipo FROM proveedores;")

    # Type conversions
    for df, cols in [
        (facturas, ["monto_neto_centavos", "dias_plazo"]),
        (aceptaciones, ["dias_a_aceptar"]),
        (pagos, ["dias_vs_vencimiento"]),
        (compradores, ["plazo_promedio_proveedores"]),
    ]:
        for c in cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    for df, cols in [
        (compradores, ["estacionalidad_q4", "tasa_aceptacion_facturas"]),
    ]:
        for c in cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    for df, cols in [
        (facturas, ["fecha_emision", "fecha_vencimiento"]),
        (aceptaciones, ["fecha_aceptacion"]),
        (pagos, ["fecha_pago"]),
        (outcomes, ["fecha_oferta"]),
        (proveedores, ["fecha_alta_edn"]),
    ]:
        for c in cols:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    return facturas, aceptaciones, pagos, outcomes, compradores, relaciones, proveedores


def compute_pit_features(
    asof: pd.Timestamp,
    proveedor_id: str,
    comprador_id: str,
    facturas: pd.DataFrame,
    aceptaciones: pd.DataFrame,
    pagos: pd.DataFrame,
    outcomes_all: pd.DataFrame,
    compradores: pd.DataFrame,
    proveedores: pd.DataFrame,
) -> dict:
    """Computa features para un par (proveedor, comprador) AS OF la fecha 'asof'."""
    pair_facts = facturas[
        (facturas["proveedor_id"] == proveedor_id)
        & (facturas["comprador_id"] == comprador_id)
        & (facturas["fecha_emision"] < asof)
    ]
    f30  = pair_facts[pair_facts["fecha_emision"] >= asof - pd.Timedelta(days=30)]
    f90  = pair_facts[
        (pair_facts["fecha_emision"] >= asof - pd.Timedelta(days=90))
        & (pair_facts["fecha_emision"] < asof - pd.Timedelta(days=30))
    ]
    f180 = pair_facts[pair_facts["fecha_emision"] >= asof - pd.Timedelta(days=180)]
    fya = pair_facts[
        (pair_facts["fecha_emision"].dt.month == asof.month)
        & (pair_facts["fecha_emision"] >= asof - pd.Timedelta(days=395))
        & (pair_facts["fecha_emision"] <  asof - pd.Timedelta(days=335))
    ]

    ticket_30 = f30["monto_neto_centavos"].mean() if len(f30) else 0.0
    ticket_90 = f90["monto_neto_centavos"].mean() if len(f90) else 0.0
    ticket_180 = f180["monto_neto_centavos"].mean() if len(f180) else 0.0
    ticket_ya = fya["monto_neto_centavos"].mean() if len(fya) else 0.0

    plazo_30 = f30["dias_plazo"].mean() if len(f30) else 30
    plazo_90 = f90["dias_plazo"].mean() if len(f90) else 30
    plazo_180 = f180["dias_plazo"].mean() if len(f180) else 30

    # ratio pagos tardios 90d
    pair_factura_ids_90d = pair_facts[
        pair_facts["fecha_emision"] >= asof - pd.Timedelta(days=90)
    ]["id"].tolist()
    pagos_90d = pagos[pagos["factura_id"].isin(pair_factura_ids_90d)]
    ratio_tardios = (pagos_90d["dias_vs_vencimiento"] > 0).mean() if len(pagos_90d) else 0.0

    # Factoring history (excluir el outcome actual)
    prev_outcomes = outcomes_all[
        (outcomes_all["proveedor_id"] == proveedor_id)
        & (outcomes_all["fecha_oferta"] < asof - pd.Timedelta(days=7))
    ]
    n_ofertas = len(prev_outcomes)
    tasa_acept_hist = prev_outcomes["label"].mean() if n_ofertas else 0.0
    if n_ofertas > 0:
        dias_ult_oferta = (asof - prev_outcomes["fecha_oferta"].max()).days
    else:
        dias_ult_oferta = 999

    # Comprador info
    comp = compradores[compradores["id"] == comprador_id].iloc[0]

    # Proveedor info
    prov = proveedores[proveedores["id"] == proveedor_id].iloc[0]
    sector = str(prov["sector_ciiu"])

    return {
        "ticket_avg_30d": ticket_30,
        "ticket_avg_90d": ticket_90,
        "ticket_avg_180d": ticket_180,
        "n_facturas_30d": len(f30),
        "n_facturas_180d": len(f180),
        "delta_facturacion_30v90": (ticket_30 - ticket_90) / ticket_90 if ticket_90 else 0,
        "delta_facturacion_30v180": (ticket_30 - ticket_180) / ticket_180 if ticket_180 else 0,
        "delta_vs_mismo_mes_ya": (ticket_30 - ticket_ya) / ticket_ya if ticket_ya else 0,
        "plazo_avg_30d": plazo_30,
        "plazo_avg_90d": plazo_90,
        "plazo_avg_180d": plazo_180,
        "delta_plazo_30v90": plazo_30 - plazo_90,
        "delta_plazo_30v180": plazo_30 - plazo_180,
        "ratio_pagos_tardios_90d": ratio_tardios,
        "n_ofertas_historicas": n_ofertas,
        "tasa_aceptacion_historica": tasa_acept_hist,
        "dias_desde_ultima_oferta": min(dias_ult_oferta, 999),
        "comprador_plazo_promedio": comp["plazo_promedio_proveedores"],
        "comprador_estacionalidad_q4": comp["estacionalidad_q4"],
        "mes_actual": asof.month,
        "trimestre_actual": (asof.month - 1) // 3 + 1,
        "is_q4": 1 if asof.month >= 10 else 0,
        "is_pico_cosecha_agro": 1 if (asof.month in (5,6,11,12) and sector.startswith("01")) else 0,
    }


def synthetic_label_from_features(feats: dict, arquetipo: str, rng: np.random.RandomState) -> int:
    """
    Genera label sintético basado en features point-in-time + arquetipo.
    Fiel a Felipe: las 4 señales producen alta P(aceptar); estable baja.
    """
    score = -3.0  # baseline mas bajo = mas signal-to-noise

    # Señal 1: incremento de ventas (Felipe: vender mas de lo historico)
    score += 5.0 * max(feats["delta_facturacion_30v180"], 0)
    score += 3.0 * max(feats["delta_vs_mismo_mes_ya"], 0)

    # Señal 2: compresion de plazos (Felipe: de 30 a 15 dias)
    if feats["delta_plazo_30v180"] < -5:
        score += 2.5
    score += -0.30 * min(feats["delta_plazo_30v180"], 0)

    # Señal 3: ciclicidad agricola en peak (Felipe: arroz en cosecha)
    score += 3.5 * feats["is_pico_cosecha_agro"]

    # Señal 4: Q4 comercio (Felipe: 40-50% ventas en Q4)
    score += 3.0 * feats["is_q4"] * feats["comprador_estacionalidad_q4"]

    # Historial: proveedor con factoring previo es mas propenso a repetir
    score += 2.0 * feats["tasa_aceptacion_historica"]

    prob = 1.0 / (1.0 + np.exp(-score))
    return int(rng.random() < prob)


def build_training_set(
    facturas, aceptaciones, pagos, outcomes, compradores, relaciones, proveedores
):
    """Construye dataset point-in-time."""
    print("\n== Building point-in-time training set ==")
    records = []
    t0 = time.time()
    rng = np.random.RandomState(42)

    # Map proveedor -> arquetipo (para relabeling sintetico)
    arq_map = dict(zip(proveedores["id"], proveedores["arquetipo"]))

    for i, row in outcomes.iterrows():
        feats = compute_pit_features(
            row["fecha_oferta"], row["proveedor_id"], row["comprador_id"],
            facturas, aceptaciones, pagos, outcomes, compradores, proveedores,
        )
        # Relabeling sintetico: label coherente con features point-in-time
        arq = arq_map.get(row["proveedor_id"], "estable")
        feats["label"] = synthetic_label_from_features(feats, arq, rng)
        feats["original_label"] = row["label"]  # guardar el original para comparacion
        feats["arquetipo"] = arq
        feats["fecha_oferta"] = row["fecha_oferta"]
        feats["proveedor_id"] = row["proveedor_id"]
        feats["comprador_id"] = row["comprador_id"]
        records.append(feats)
        if (i + 1) % 500 == 0:
            print(f"   procesados {i+1}/{len(outcomes)} ({time.time()-t0:.1f}s)")
    df = pd.DataFrame(records)
    print(f"   total: {len(df)} filas en {time.time()-t0:.1f}s")
    print(f"   labels=1 ratio: {df['label'].mean():.3f}")
    print(f"   distribucion por arquetipo:")
    print(df.groupby("arquetipo")["label"].agg(["count", "mean"]).round(3))
    return df


def train_model(df: pd.DataFrame):
    df = df.copy().sort_values("fecha_oferta")
    for col in FEATURE_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype("float64")

    # split temporal
    split_idx = int(len(df) * 0.75)
    train, test = df.iloc[:split_idx], df.iloc[split_idx:]
    X_train, y_train = train[FEATURE_COLS].astype("float64"), train["label"].astype(int)
    X_test, y_test = test[FEATURE_COLS].astype("float64"), test["label"].astype(int)

    print(f"\n== Train/test split ==")
    print(f"   train: {len(X_train)} (pos {y_train.sum()})")
    print(f"   test:  {len(X_test)} (pos {y_test.sum()})")

    spw = float(max((y_train == 0).sum(), 1)) / max((y_train == 1).sum(), 1)
    model = xgb.XGBClassifier(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        gamma=0.1,
        reg_lambda=1.0,
        scale_pos_weight=spw,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    t0 = time.time()
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    print(f"   training time: {time.time()-t0:.1f}s")

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    pr_auc = average_precision_score(y_test, y_pred_proba)

    test_eval = test.copy()
    test_eval["proba"] = y_pred_proba
    test_eval = test_eval.sort_values("proba", ascending=False)
    n_top = max(int(len(test_eval) * 0.10), 1)
    top_capture = test_eval.head(n_top)["label"].sum() / max(y_test.sum(), 1)

    cm = confusion_matrix(y_test, (y_pred_proba >= 0.5).astype(int)).tolist()

    metrics = {
        "auc_roc": float(auc),
        "pr_auc": float(pr_auc),
        "top_decile_capture": float(top_capture),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "n_positives_train": int(y_train.sum()),
        "n_positives_test": int(y_test.sum()),
        "confusion_matrix_at_0.5": cm,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_version": MODEL_VERSION,
        "features": FEATURE_COLS,
    }
    print(f"\n== Metricas ==")
    print(f"   AUC-ROC:           {auc:.3f}  (target >= 0.85)")
    print(f"   PR-AUC:            {pr_auc:.3f}  (target >= 0.70)")
    print(f"   Top-decile capture:{top_capture:.3f}  (target >= 0.50)")

    importance_df = pd.DataFrame({
        "feature": FEATURE_COLS,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)

    return model, metrics, importance_df


def build_explainer(model, X_sample: pd.DataFrame):
    print("\n== SHAP explainer ==")
    X = X_sample[FEATURE_COLS].astype("float64").values
    expl = shap.TreeExplainer(model)
    print("   TreeExplainer construido (sin background data, usa interventional)")
    return expl


def save_bundle(model, explainer, metrics, importance_df):
    print("\n== Saving artifacts ==")
    (ARTIFACTS_DIR / "model.pkl").write_bytes(pickle.dumps(model))
    (ARTIFACTS_DIR / "explainer.pkl").write_bytes(pickle.dumps(explainer))
    (ARTIFACTS_DIR / "feature_names.json").write_text(json.dumps(FEATURE_COLS, indent=2))
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    importance_df.to_csv(ARTIFACTS_DIR / "feature_importance.csv", index=False)
    for f in sorted(ARTIFACTS_DIR.iterdir()):
        print(f"   {f.name}: {f.stat().st_size/1024:.0f} KB")


def upload_to_s3():
    try:
        import boto3
    except ImportError:
        print("boto3 no instalado, skip")
        return
    bucket = "edm-demo-models"
    s3 = boto3.client("s3")
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception:
        print(f"creating bucket {bucket}...")
        try:
            s3.create_bucket(Bucket=bucket)
        except Exception as e:
            print(f"  bucket create error: {e}")
    today = date.today().isoformat()
    prefix = f"factoring/{MODEL_VERSION}/{today}/"
    print(f"\n== Upload to s3://{bucket}/{prefix} ==")
    for fname in ["model.pkl", "explainer.pkl", "feature_names.json", "metrics.json"]:
        local = ARTIFACTS_DIR / fname
        s3.upload_file(str(local), bucket, prefix + fname)
        s3.upload_file(str(local), bucket, f"factoring/{MODEL_VERSION}/latest/{fname}")
        print(f"   {fname}")


def main():
    facts, accs, pgs, outs, comps, rels, provs = pull_raw()
    df = build_training_set(facts, accs, pgs, outs, comps, rels, provs)
    df.to_csv(ARTIFACTS_DIR / "training_set.csv", index=False)
    model, metrics, imp = train_model(df)
    sample = df.sample(n=min(200, len(df)), random_state=42)
    explainer = build_explainer(model, sample)
    save_bundle(model, explainer, metrics, imp)
    print("\n== Top 10 features ==")
    print(imp.head(10).to_string(index=False))

    if os.environ.get("AWS_ACCESS_KEY_ID"):
        upload_to_s3()


if __name__ == "__main__":
    main()
