"""
Script de replay para usar EN VIVO durante la demo.

Genera señales nuevas en la tabla `signals` con espaciado dramático,
para que el dashboard de Felipe (en /feed) las reciba por Supabase Realtime
y aparezcan en pantalla durante la presentación.

Uso:
    python demo/replay.py            # ejecuta toda la secuencia (~40 segundos)
    python demo/replay.py --fast     # sin pausas
    python demo/replay.py --one      # una sola señal y termina
"""
from __future__ import annotations
import json
import os
import random
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from data.generator.supabase_client import rest_post, mgmt_sql


SCENARIO = [
    {
        "proveedor_match": "Arrocera del Tolima",
        "delay": 4.0,
        "score": 0.97,
        "monto_potencial": 32_500_000,
        "razones": [
            {"label": "Está en pico de cosecha agrícola"},
            {"label": "Facturación creció 58% vs últimos 6 meses"},
            {"label": "Sector arrocero — Tolima en plena cosecha de mayo"},
        ],
    },
    {
        "proveedor_match": "Distribuidora El Llano",
        "delay": 5.0,
        "score": 0.93,
        "monto_potencial": 18_700_000,
        "razones": [
            {"label": "Facturación creció 47% en últimos 60 días"},
            {"label": "Crecimiento estacional sostenido vs trimestre anterior"},
            {"label": "Sin factoring activo — primera oferta"},
        ],
    },
    {
        "proveedor_match": "Comercializadora Andes",
        "delay": 6.0,
        "score": 0.89,
        "monto_potencial": 24_300_000,
        "razones": [
            {"label": "Plazos de cobro se acortaron 15 días recientemente"},
            {"label": "Aumento de actividad de obras — flujo de caja presionado"},
            {"label": "Ha aceptado factoring 34% de las veces histórico"},
        ],
    },
    {
        "proveedor_match": "Textiles Bogota",
        "delay": 5.0,
        "score": 0.42,
        "monto_potencial": 8_900_000,
        "razones": [
            {"label": "Mayo: fuera de temporada Q4 — bajo score correcto"},
            {"label": "Volumen estable, sin señales de incremento"},
            {"label": "Re-evaluar en octubre cuando inicie alta del comercio"},
        ],
    },
]


def find_proveedor_comprador(match: str) -> tuple[str, str] | None:
    status, body = mgmt_sql(f"""
        SELECT p.id as proveedor_id, r.comprador_id
        FROM proveedores p
        JOIN relaciones r ON r.proveedor_id = p.id
        WHERE p.razon_social ILIKE '%{match}%'
        LIMIT 1;
    """)
    rows = json.loads(body) if status < 300 else []
    if not rows:
        return None
    return rows[0]["proveedor_id"], rows[0]["comprador_id"]


def emit_signal(proveedor_id, comprador_id, score, monto, razones):
    signal = {
        "proveedor_id": proveedor_id,
        "comprador_id": comprador_id,
        "factura_id": None,
        "score": score,
        "rank": None,
        "monto_potencial_centavos": int(monto * 100),
        "razones": razones,
        "model_version": "v1-live",
    }
    status, body = rest_post("signals", [signal])
    return status < 300


def main():
    fast = "--fast" in sys.argv
    one = "--one" in sys.argv

    print("=" * 60)
    print("DEMO REPLAY — EDM Factoring Signals Engine")
    print("=" * 60)
    print()
    print("Conectado al dashboard en: https://edm-demo-pi.vercel.app/feed")
    print()
    if not fast:
        print("Cada señal aparecerá con pausa dramática.")
        print("Tener /feed abierto en navegador antes de continuar.")
        input("\nPresioná ENTER para empezar... ")

    print()
    for i, step in enumerate(SCENARIO, 1):
        ids = find_proveedor_comprador(step["proveedor_match"])
        if not ids:
            print(f"  [{i}] NO encontrado proveedor: {step['proveedor_match']}")
            continue
        prov_id, comp_id = ids
        ok = emit_signal(prov_id, comp_id, step["score"], step["monto_potencial"], step["razones"])
        marker = "🔔" if step["score"] >= 0.6 else "ℹ️"
        print(f"  [{i}] {marker} {step['proveedor_match']:35s}  score={step['score']:.2f}  emitida={ok}")
        if one:
            break
        if not fast and i < len(SCENARIO):
            time.sleep(step["delay"])

    print()
    print("Replay terminado. Las señales están en la tabla `signals` de Supabase")
    print("y deberían haber aparecido en el feed en vivo de Felipe.")


if __name__ == "__main__":
    main()
