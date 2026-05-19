"""
Cliente HTTP minimo para Supabase REST API (PostgREST) y Management API.
No depende de supabase-py para mantener cero deps adicionales en el demo.
"""
from __future__ import annotations
import json
import os
import urllib.request
import urllib.error
from typing import Any


SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "")
MGMT_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno")


HEADERS_REST = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    "User-Agent": "edm-demo-loader/1.0",
}


def _http(method: str, url: str, headers: dict, body: bytes | None = None) -> tuple[int, str]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def rest_post(table: str, rows: list[dict], headers_extra: dict | None = None) -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = dict(HEADERS_REST)
    if headers_extra:
        h.update(headers_extra)
    body = json.dumps(rows, default=str).encode("utf-8")
    return _http("POST", url, h, body)


def rest_upsert(table: str, rows: list[dict], on_conflict: str) -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    h = dict(HEADERS_REST)
    h["Prefer"] = "return=minimal,resolution=merge-duplicates"
    body = json.dumps(rows, default=str).encode("utf-8")
    return _http("POST", url, h, body)


def rest_patch(table: str, filter_expr: str, patch: dict) -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filter_expr}"
    h = dict(HEADERS_REST)
    h["Prefer"] = "return=minimal"
    body = json.dumps(patch, default=str).encode("utf-8")
    return _http("PATCH", url, h, body)


def rest_get(table: str, query: str = "") -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        url += "?" + query
    return _http("GET", url, HEADERS_REST, None)


def mgmt_sql(sql: str) -> tuple[int, str]:
    """Ejecuta SQL contra el proyecto via Management API."""
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    payload = json.dumps({"query": sql}).encode("utf-8")
    h = {
        "Authorization": f"Bearer {MGMT_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "edm-demo-loader/1.0",
        "Accept": "application/json",
    }
    return _http("POST", url, h, payload)
