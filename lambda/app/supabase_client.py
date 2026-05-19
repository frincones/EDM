"""Cliente HTTP minimalista contra Supabase REST API + Mgmt SQL."""
from __future__ import annotations
import json
import os
import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "")
MGMT_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")


def _headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "edm-lambda/1.0",
    }


def get_features(relacion_id: str) -> dict | None:
    """Lee features actuales del par via REST."""
    url = f"{SUPABASE_URL}/rest/v1/features_par"
    params = {"relacion_id": f"eq.{relacion_id}", "limit": "1"}
    with httpx.Client(timeout=10) as c:
        r = c.get(url, headers=_headers(), params=params)
        if r.status_code != 200:
            return None
        rows = r.json()
        return rows[0] if rows else None


def get_relacion_by_factura(factura_id: str) -> dict | None:
    url = f"{SUPABASE_URL}/rest/v1/facturas"
    params = {
        "id": f"eq.{factura_id}",
        "select": "id,relacion_id,proveedor_id,comprador_id,monto_neto_centavos",
        "limit": "1",
    }
    with httpx.Client(timeout=10) as c:
        r = c.get(url, headers=_headers(), params=params)
        if r.status_code != 200:
            return None
        rows = r.json()
        return rows[0] if rows else None


def insert_signal(signal: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/signals"
    headers = _headers()
    headers["Prefer"] = "return=minimal"
    with httpx.Client(timeout=10) as c:
        r = c.post(url, headers=headers, content=json.dumps(signal))
        return r.status_code < 300
