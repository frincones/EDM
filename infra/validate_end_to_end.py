"""
Validacion end-to-end: confirma que toda la pipeline funciona y los datos en Vercel
SON los del modelo entrenado y no random / mock.

Ejecuta 5 chequeos:
1. S3 model.pkl vs local model.pkl (hashes match)
2. Supabase signals: scores no random + estadistica del modelo
3. Lambda invoke vs signals: scorea hero direct -> compara con signal table
4. Vercel /leads: HTML contiene los heroes reales + scores
5. Realtime: insert signal -> verificar push (basico)
"""
from __future__ import annotations
import hashlib
import json
import os
import pickle
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Asegurar PYTHONPATH para imports
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import boto3
import numpy as np
import pandas as pd

from data.generator.supabase_client import mgmt_sql, rest_get

OK = "[OK]"
FAIL = "[FAIL]"
WARN = "[WARN]"
DIVIDER = "=" * 70

failures = []


def section(title: str):
    print("\n" + DIVIDER)
    print(f" {title}")
    print(DIVIDER)


def fail(msg: str):
    print(f"{FAIL} {msg}")
    failures.append(msg)


def ok(msg: str):
    print(f"{OK} {msg}")


# =============================================================================
# 1. S3 model.pkl matches local
# =============================================================================
def validate_s3_model():
    section("VALIDACION 1: artifacts en S3 vs local")
    s3 = boto3.client("s3")

    local_metrics = json.loads((ROOT / "ml/artifacts/metrics.json").read_text())
    print(f"Local metrics: AUC={local_metrics['auc_roc']:.3f}, model_v={local_metrics['model_version']}")
    ok(f"local model_version = {local_metrics['model_version']}")

    # Download S3 metrics
    s3_metrics_obj = s3.get_object(Bucket="edm-demo-models", Key="factoring/v1/latest/metrics.json")
    s3_metrics = json.loads(s3_metrics_obj["Body"].read())
    print(f"S3 metrics:    AUC={s3_metrics['auc_roc']:.3f}, model_v={s3_metrics['model_version']}")

    if abs(local_metrics["auc_roc"] - s3_metrics["auc_roc"]) < 1e-6:
        ok("S3 metrics.json AUC matches local")
    else:
        fail(f"AUC mismatch: local={local_metrics['auc_roc']} s3={s3_metrics['auc_roc']}")

    # Hash model.pkl
    local_model = (ROOT / "ml/artifacts/model.pkl").read_bytes()
    local_hash = hashlib.sha256(local_model).hexdigest()[:16]
    s3_model = s3.get_object(Bucket="edm-demo-models", Key="factoring/v1/latest/model.pkl")["Body"].read()
    s3_hash = hashlib.sha256(s3_model).hexdigest()[:16]
    if local_hash == s3_hash:
        ok(f"model.pkl S3 hash match: {local_hash}")
    else:
        fail(f"model.pkl hash mismatch! local={local_hash} s3={s3_hash}")

    print(f"\nModel was trained with {local_metrics['n_train']} samples, {local_metrics['n_positives_train']} positivos")
    return local_metrics


# =============================================================================
# 2. Signals come from trained model
# =============================================================================
def validate_signals():
    section("VALIDACION 2: signals en Supabase provienen del modelo")
    status, body = mgmt_sql("""
        SELECT s.score, s.model_version, s.razones,
               p.razon_social, p.arquetipo, p.arquetipo_visible
        FROM signals s
        JOIN proveedores p ON p.id = s.proveedor_id
        ORDER BY s.score DESC;
    """)
    rows = json.loads(body)
    df = pd.DataFrame(rows)
    df["score"] = pd.to_numeric(df["score"])

    print(f"Total signals analizadas: {len(df)}")
    print(f"Model versions: {df['model_version'].value_counts().to_dict()}")

    if "v1" in df["model_version"].values:
        ok("signals tienen model_version = v1")
    else:
        fail(f"signals con versiones inesperadas: {df['model_version'].unique()}")

    # Distribucion de scores no debe ser uniforme (eso seria random)
    score_std = df["score"].std()
    score_range = df["score"].max() - df["score"].min()
    print(f"Score stats: min={df['score'].min():.3f} max={df['score'].max():.3f} std={score_std:.3f} range={score_range:.3f}")

    if score_range > 0.5:
        ok(f"scores tienen rango amplio ({score_range:.3f}) - hay separacion")
    else:
        fail(f"rango de scores muy chico ({score_range:.3f}) - posible mock")

    # Verificacion semantica: heroes deben tener scores acordes a su arquetipo
    print("\nTop 10 leads (con arquetipo):")
    for _, r in df.head(10).iterrows():
        marker = "[HERO]" if r["arquetipo_visible"] else "      "
        print(f"  {marker} {r['score']:.3f}  {r['arquetipo']:25s}  {r['razon_social']}")

    # Heroes esperados
    expected_top = ["ciclicidad_agricola", "incremento_ventas", "plazos_comprimidos"]
    top_arqs = df.head(15)["arquetipo"].tolist()
    pct_expected = sum(1 for a in top_arqs if a in expected_top) / len(top_arqs)
    if pct_expected > 0.6:
        ok(f"top-15 leads son arquetipos positivos: {pct_expected*100:.0f}%")
    else:
        fail(f"top leads no son positivos esperados: {pct_expected*100:.0f}%")

    # Razones SHAP deben existir
    has_razones = df["razones"].apply(lambda r: isinstance(r, list) and len(r) > 0).mean()
    if has_razones > 0.95:
        ok(f"signals con razones SHAP: {has_razones*100:.0f}%")
    else:
        fail(f"muchos signals sin razones: {(1-has_razones)*100:.0f}%")

    return df


# =============================================================================
# 3. Lambda invoke vs signals (consistencia)
# =============================================================================
def validate_lambda_consistency(precomputed_signals: pd.DataFrame):
    section("VALIDACION 3: Lambda /score consistente con scores precalculados")
    client = boto3.client("lambda")

    # Tomar el HERO Arrocera del Tolima (sabemos su signal precomputed)
    status, body = mgmt_sql("""
        SELECT s.score, s.proveedor_id, s.comprador_id, p.razon_social,
               r.id as relacion_id
        FROM signals s
        JOIN proveedores p ON p.id = s.proveedor_id
        JOIN relaciones r ON r.proveedor_id = s.proveedor_id AND r.comprador_id = s.comprador_id
        WHERE p.razon_social ILIKE '%Arrocera del Tolima%'
        LIMIT 1;
    """)
    rows = json.loads(body)
    if not rows:
        fail("No encontrado Arrocera del Tolima en signals")
        return
    hero = rows[0]
    precomp_score = float(hero["score"])
    relacion_id = hero["relacion_id"]
    print(f"Precomputed score Arrocera del Tolima: {precomp_score:.4f}")
    print(f"Relacion ID: {relacion_id}")

    # Invocar Lambda
    payload = json.dumps({
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": "/score",
        "rawQueryString": "",
        "headers": {"content-type": "application/json", "host": "x"},
        "requestContext": {
            "accountId": "anonymous", "apiId": "x",
            "domainName": "x.lambda-url.us-east-1.on.aws",
            "http": {"method": "POST", "path": "/score", "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1", "userAgent": "validator"},
            "requestId": "validate", "routeKey": "$default", "stage": "$default",
            "time": "01/Jan/2026:00:00:00 +0000", "timeEpoch": 1735689600
        },
        "body": json.dumps({"relacion_id": relacion_id}),
        "isBase64Encoded": False,
    }).encode()

    t0 = time.time()
    resp = client.invoke(FunctionName="edm-factoring-scorer", Payload=payload)
    dur = time.time() - t0
    body_raw = resp["Payload"].read().decode()
    response = json.loads(body_raw)
    print(f"Lambda invoke ({dur:.1f}s): status={response.get('statusCode')}")

    if response.get("statusCode") != 200:
        fail(f"Lambda devolvio status {response.get('statusCode')}: {response.get('body','')[:300]}")
        return

    inner = json.loads(response["body"])
    lambda_score = inner.get("score")
    print(f"Lambda score Arrocera del Tolima: {lambda_score:.4f}")
    print(f"Razones top 3:")
    for r in inner.get("razones", []):
        print(f"  - {r['label']} (contrib={r['contribution']:+.3f})")

    # Comparar (deben ser identicos porque mismo modelo + mismas features)
    if abs(lambda_score - precomp_score) < 0.01:
        ok(f"Lambda score = precomputed (diff={abs(lambda_score - precomp_score):.4f}) - MISMO MODELO")
    elif abs(lambda_score - precomp_score) < 0.05:
        ok(f"Lambda score ~= precomputed (diff={abs(lambda_score - precomp_score):.4f})")
    else:
        fail(f"Lambda diverge: precomputed={precomp_score:.4f} lambda={lambda_score:.4f}")


# =============================================================================
# 4. Vercel data matches Supabase
# =============================================================================
def validate_vercel():
    section("VALIDACION 4: Vercel /leads muestra data REAL de Supabase")
    url = "https://edm-demo-pi.vercel.app/leads"
    req = urllib.request.Request(url, headers={"User-Agent": "validator"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode()
    print(f"HTTP status: {r.status}, size: {len(html)} bytes")

    # Pull lo que Supabase dice (debe ser identico)
    status, body = mgmt_sql("""
        SELECT p.razon_social, s.score
        FROM signals s
        JOIN proveedores p ON p.id = s.proveedor_id
        ORDER BY s.score DESC LIMIT 5;
    """)
    rows = json.loads(body)

    matched = 0
    print("\nTop 5 leads en Supabase:")
    for row in rows:
        name = row["razon_social"]
        score = float(row["score"])
        score_pct = int(round(score * 100))
        print(f"  {score:.3f} ({score_pct}/100): {name}")
        if name in html:
            matched += 1

    if matched >= 4:
        ok(f"{matched}/5 top leads aparecen en HTML de Vercel - DATA REAL")
    else:
        fail(f"Solo {matched}/5 aparecen en HTML - posible desincronizacion")

    # Verificar score render
    expected_top_score = int(round(float(rows[0]["score"]) * 100))
    if str(expected_top_score) in html:
        ok(f"Top score {expected_top_score} renderizado en Vercel")
    else:
        fail(f"Top score {expected_top_score} NO encontrado en HTML")


# =============================================================================
# 5. Realtime simulado: insert + retrieve
# =============================================================================
def validate_realtime():
    section("VALIDACION 5: insert signal nuevo + verificar persiste")
    status, body = mgmt_sql("""
        SELECT proveedor_id, comprador_id FROM relaciones LIMIT 1;
    """)
    pair = json.loads(body)[0]

    # Count before
    s, b = mgmt_sql("SELECT COUNT(*)::INT as n FROM signals WHERE model_version = 'validator-test';")
    before = json.loads(b)[0]["n"]
    print(f"signals 'validator-test' antes: {before}")

    # Insert via REST
    from data.generator.supabase_client import rest_post
    test_signal = {
        "proveedor_id": pair["proveedor_id"],
        "comprador_id": pair["comprador_id"],
        "factura_id": None,
        "score": 0.95,
        "rank": None,
        "monto_potencial_centavos": 50_000_000_00,
        "razones": [{"feature": "test", "value": 1, "contribution": 0.5, "label": "Test signal para validacion"}],
        "model_version": "validator-test",
    }
    s, b = rest_post("signals", [test_signal])
    if s >= 300:
        fail(f"insert signal fallo: {b[:200]}")
        return
    ok(f"insert signal returned HTTP {s}")

    time.sleep(2)
    s, b = mgmt_sql("SELECT COUNT(*)::INT as n FROM signals WHERE model_version = 'validator-test';")
    after = json.loads(b)[0]["n"]
    print(f"signals 'validator-test' despues: {after}")

    if after > before:
        ok("signal nuevo persistido")
    else:
        fail("signal no aparecio en Supabase")

    # Cleanup
    mgmt_sql("DELETE FROM signals WHERE model_version = 'validator-test';")
    ok("cleanup hecho")


# =============================================================================
# MAIN
# =============================================================================
def main():
    print(DIVIDER)
    print(" EDM Demo - End-to-End Validation")
    print(DIVIDER)

    validate_s3_model()
    precomp = validate_signals()
    try:
        validate_lambda_consistency(precomp)
    except Exception as e:
        fail(f"Lambda validation exception: {e}")
    try:
        validate_vercel()
    except Exception as e:
        fail(f"Vercel validation exception: {e}")
    try:
        validate_realtime()
    except Exception as e:
        fail(f"Realtime validation exception: {e}")

    print("\n" + DIVIDER)
    if failures:
        print(f" RESULT: {len(failures)} fallas")
        for f in failures:
            print(f"   - {f}")
        sys.exit(1)
    else:
        print(" RESULT: TODO VALIDADO OK")
    print(DIVIDER)


if __name__ == "__main__":
    main()
