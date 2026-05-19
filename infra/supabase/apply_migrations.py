"""
Aplica las migrations SQL al proyecto Supabase `edm` via Management API.

Uso:
    python infra/supabase/apply_migrations.py [--reset]

Variables de entorno requeridas (en .env):
    SUPABASE_ACCESS_TOKEN
    SUPABASE_PROJECT_REF
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error
import json


MIGRATIONS_DIR = Path(__file__).parent / "migrations"
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "wicnndedakeuvxkzmelz")
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")

if not ACCESS_TOKEN:
    print("ERROR: SUPABASE_ACCESS_TOKEN no esta configurado en el entorno", file=sys.stderr)
    print("Cargar primero el .env:", file=sys.stderr)
    print('  Get-Content .env | %{if($_ -match "^([^#=]+)=(.*)$"){[Environment]::SetEnvironmentVariable($matches[1],$matches[2])}}', file=sys.stderr)
    sys.exit(1)


def run_sql(sql: str, name: str = "") -> dict:
    """Ejecuta SQL contra el proyecto via Management API."""
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    payload = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "edm-demo-cli/1.0 (curl-equivalent)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8")
            return {"status": r.status, "body": body}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode("utf-8", errors="replace"), "error": True}


def reset_schema():
    """Borra el schema public y lo recrea limpio. CUIDADO: destructivo."""
    print("== RESET: dropping public schema ==")
    sql = """
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    """
    r = run_sql(sql, "reset")
    print(f"  status={r['status']}")
    if r.get("error"):
        print(f"  body={r['body']}")


def main():
    if "--reset" in sys.argv:
        reset_schema()

    print(f"== Project: {PROJECT_REF}")
    print(f"== Migrations dir: {MIGRATIONS_DIR}")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        print("No hay migrations en", MIGRATIONS_DIR)
        sys.exit(1)

    for mf in migration_files:
        print(f"\n-> Aplicando {mf.name}...")
        sql = mf.read_text(encoding="utf-8")
        start = time.time()
        r = run_sql(sql, mf.name)
        dur = time.time() - start
        if r.get("error"):
            print(f"   FALLO ({dur:.1f}s) status={r['status']}")
            print(f"   body: {r['body'][:1500]}")
            sys.exit(2)
        print(f"   OK ({dur:.1f}s)")

    print("\nMigrations aplicadas exitosamente.")

    print("\n== Verificando tablas creadas ==")
    check = run_sql("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    print(check["body"])


if __name__ == "__main__":
    main()
