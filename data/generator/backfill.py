"""
Carga la data sintetica generada (master.json + events.jsonl) a Supabase.

Estrategia:
1) Maestros (compradores, proveedores, relaciones) -> bulk upsert via PostgREST
2) Eventos:
   - eventos_raw: bulk insert por chunks (idempotente por event_id)
   - tablas de dominio: bulk insert agrupado por tipo (ordenes_compra, facturas, etc.)

Esto es el equivalente Python de la Edge Function /ingest, optimizado para backfill.
La logica de validacion y normalizacion es la MISMA que /ingest.

Uso:
    python data/generator/backfill.py [--limit N]
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path
from collections import defaultdict

from data.generator.supabase_client import rest_upsert, rest_post, mgmt_sql, rest_get


OUTPUT_DIR = Path(__file__).parent.parent / "output"
MASTER_FILE = OUTPUT_DIR / "master.json"
EVENTS_FILE = OUTPUT_DIR / "events.jsonl"

CHUNK_SIZE = 500


def _post_chunked(table: str, rows: list[dict], on_conflict: str | None = None) -> int:
    """Inserta filas en chunks. Retorna count de filas insertadas exitosamente."""
    total = 0
    fails = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        if on_conflict:
            status, body = rest_upsert(table, chunk, on_conflict)
        else:
            status, body = rest_post(table, chunk)
        if status >= 300:
            fails += 1
            if fails <= 3:  # solo primeros 3 errores para no spammear
                print(f"   ERROR chunk {i//CHUNK_SIZE} table={table} status={status}")
                print(f"   body: {body[:500]}")
            continue
        total += len(chunk)
        if (i // CHUNK_SIZE) % 5 == 0:
            print(f"   ... {table}: {total}/{len(rows)} ({100*total/len(rows):.0f}%)", flush=True)
    return total


def load_masters():
    print("\n== 1. Master data ==")
    master = json.loads(MASTER_FILE.read_text(encoding="utf-8"))

    # Compradores
    rows = [{
        "id": c["id"],
        "nit": c["nit"],
        "razon_social": c["razon_social"],
        "sector_ciiu": c.get("sector_ciiu"),
        "plazo_promedio_proveedores": c.get("plazo_promedio_proveedores"),
        "estacionalidad_q4": c.get("estacionalidad_q4"),
        "tasa_aceptacion_facturas": c.get("tasa_aceptacion_facturas"),
    } for c in master["compradores"]]
    n = _post_chunked("compradores", rows, on_conflict="nit")
    print(f"-> compradores: {n}/{len(rows)}")

    # Proveedores
    rows = [{
        "id": p["id"],
        "nit": p["nit"],
        "razon_social": p["razon_social"],
        "sector_ciiu": p["sector_ciiu"],
        "sector_nombre": p.get("sector_nombre"),
        "tamano": p["tamano"],
        "ciudad": p.get("ciudad"),
        "fecha_alta_edn": p.get("fecha_alta_edn"),
        "arquetipo": p["arquetipo"],
        "arquetipo_visible": p.get("arquetipo_visible", False),
    } for p in master["proveedores"]]
    n = _post_chunked("proveedores", rows, on_conflict="nit")
    print(f"-> proveedores: {n}/{len(rows)}")

    # Relaciones
    rows = [{
        "id": r["id"],
        "proveedor_id": r["proveedor_id"],
        "comprador_id": r["comprador_id"],
        "fecha_inicio": r["fecha_inicio"],
        "status": "activa",
    } for r in master["relaciones"]]
    n = _post_chunked("relaciones", rows, on_conflict="proveedor_id,comprador_id")
    print(f"-> relaciones: {n}/{len(rows)}")


def load_events(limit: int | None = None):
    print("\n== 2. Events ==")
    events: list[dict] = []
    with EVENTS_FILE.open(encoding="utf-8") as f:
        for line in f:
            events.append(json.loads(line))
            if limit and len(events) >= limit:
                break
    print(f"-> Total eventos cargados a memoria: {len(events)}")

    # 2a. Insertar todo en eventos_raw
    print("\n-- eventos_raw --")
    raw_rows = [{
        "event_id": e["event_id"],
        "event_type": e["event_type"],
        "payload": e["payload"],
        "source": e.get("source", "synthetic_backfill"),
    } for e in events]
    n = _post_chunked("eventos_raw", raw_rows, on_conflict="event_id")
    print(f"-> eventos_raw: {n}/{len(raw_rows)}")

    # 2b. Group by event_type for domain tables
    by_type: dict[str, list] = defaultdict(list)
    for e in events:
        by_type[e["event_type"]].append(e["payload"])

    # ordenes_compra
    if "orden_compra_creada" in by_type:
        print("\n-- ordenes_compra --")
        rows = [{
            "id": p["id"],
            "external_id": p["external_id"],
            "relacion_id": p["relacion_id"],
            "proveedor_id": p["proveedor_id"],
            "comprador_id": p["comprador_id"],
            "monto_centavos": p["monto_centavos"],
            "moneda": p.get("moneda", "COP"),
            "fecha_emision": p["fecha_emision"],
        } for p in by_type["orden_compra_creada"]]
        n = _post_chunked("ordenes_compra", rows, on_conflict="external_id")
        print(f"-> ordenes_compra: {n}/{len(rows)}")

    # facturas
    if "factura_emitida" in by_type:
        print("\n-- facturas --")
        rows = [{
            "id": p["id"],
            "external_id": p["external_id"],
            "cufe": p.get("cufe"),
            "orden_compra_id": p.get("orden_compra_id"),
            "relacion_id": p["relacion_id"],
            "proveedor_id": p["proveedor_id"],
            "comprador_id": p["comprador_id"],
            "monto_bruto_centavos": p["monto_bruto_centavos"],
            "impuestos_centavos": p["impuestos_centavos"],
            "monto_neto_centavos": p["monto_neto_centavos"],
            "moneda": p.get("moneda", "COP"),
            "fecha_emision": p["fecha_emision"],
            "fecha_vencimiento": p["fecha_vencimiento"],
            "estado": "emitida",
        } for p in by_type["factura_emitida"]]
        n = _post_chunked("facturas", rows, on_conflict="external_id")
        print(f"-> facturas: {n}/{len(rows)}")

    # notas_recepcion
    if "nota_recepcion_registrada" in by_type:
        print("\n-- notas_recepcion --")
        rows = [{
            "factura_id": p["factura_id"],
            "fecha_recepcion": p["fecha_recepcion"],
        } for p in by_type["nota_recepcion_registrada"]]
        n = _post_chunked("notas_recepcion", rows)
        print(f"-> notas_recepcion: {n}/{len(rows)}")

    # aceptaciones
    if "factura_aceptada" in by_type:
        print("\n-- aceptaciones --")
        rows = [{
            "factura_id": p["factura_id"],
            "fecha_aceptacion": p["fecha_aceptacion"],
            "dias_a_aceptar": p["dias_a_aceptar"],
        } for p in by_type["factura_aceptada"]]
        n = _post_chunked("aceptaciones", rows)
        print(f"-> aceptaciones: {n}/{len(rows)}")

    # pagos
    if "pago_recibido" in by_type:
        print("\n-- pagos --")
        rows = [{
            "factura_id": p["factura_id"],
            "monto_centavos": p["monto_centavos"],
            "fecha_pago": p["fecha_pago"],
            "dias_vs_vencimiento": p["dias_vs_vencimiento"],
        } for p in by_type["pago_recibido"]]
        n = _post_chunked("pagos", rows)
        print(f"-> pagos: {n}/{len(rows)}")

    # outcomes_factoring (oferta_emitida + outcome merged)
    if "oferta_factoring_emitida" in by_type:
        print("\n-- outcomes_factoring --")
        ofertas = {p["external_id"]: p for p in by_type["oferta_factoring_emitida"]}
        for p in by_type.get("oferta_factoring_outcome", []):
            if p["external_id"] in ofertas:
                ofertas[p["external_id"]]["outcome"] = p["outcome"]
                ofertas[p["external_id"]]["fecha_decision"] = p["fecha_decision"]
        rows = [{
            "external_id": p["external_id"],
            "proveedor_id": p["proveedor_id"],
            "comprador_id": p["comprador_id"],
            "factura_id": p.get("factura_id"),
            "fecha_oferta": p["fecha_oferta"],
            "fecha_decision": p.get("fecha_decision"),
            "outcome": p.get("outcome", "pendiente"),
            "monto_ofertado_centavos": p["monto_ofertado_centavos"],
            "tasa_ofertada": p["tasa_ofertada"],
        } for p in ofertas.values()]
        n = _post_chunked("outcomes_factoring", rows, on_conflict="external_id")
        print(f"-> outcomes_factoring: {n}/{len(rows)}")


def update_factura_states():
    """Update facturas estado segun la cadena de eventos posteriores."""
    print("\n== 3. Updating factura states ==")
    sql = """
    -- aceptada
    UPDATE facturas SET estado = 'aceptada'
    WHERE id IN (SELECT factura_id FROM aceptaciones) AND estado != 'pagada';
    -- recibida
    UPDATE facturas SET estado = 'recibida'
    WHERE id IN (SELECT factura_id FROM notas_recepcion) AND estado = 'emitida';
    -- pagada
    UPDATE facturas SET estado = 'pagada'
    WHERE id IN (SELECT factura_id FROM pagos);
    -- en_factoring
    UPDATE facturas SET estado = 'en_factoring'
    WHERE id IN (SELECT factura_id FROM outcomes_factoring WHERE outcome = 'aceptada');
    """
    status, body = mgmt_sql(sql)
    print(f"-> SQL update status={status}")
    if status >= 300:
        print(body[:500])


def refresh_features():
    print("\n== 4. Refresh materialized view features_par ==")
    # REFRESH no se puede dentro de transaccion; necesita autocommit
    status, body = mgmt_sql("REFRESH MATERIALIZED VIEW features_par;")
    print(f"-> refresh features_par status={status}")
    if status >= 300:
        print(body[:500])


def show_counts():
    print("\n== 5. Counts ==")
    sql = """
    SELECT 'compradores' AS t, COUNT(*) AS n FROM compradores
    UNION ALL SELECT 'proveedores', COUNT(*) FROM proveedores
    UNION ALL SELECT 'relaciones', COUNT(*) FROM relaciones
    UNION ALL SELECT 'eventos_raw', COUNT(*) FROM eventos_raw
    UNION ALL SELECT 'ordenes_compra', COUNT(*) FROM ordenes_compra
    UNION ALL SELECT 'facturas', COUNT(*) FROM facturas
    UNION ALL SELECT 'notas_recepcion', COUNT(*) FROM notas_recepcion
    UNION ALL SELECT 'aceptaciones', COUNT(*) FROM aceptaciones
    UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
    UNION ALL SELECT 'outcomes_factoring', COUNT(*) FROM outcomes_factoring
    UNION ALL SELECT 'features_par', COUNT(*) FROM features_par
    ORDER BY t;
    """
    status, body = mgmt_sql(sql)
    print(body)


def main():
    limit = None
    if "--limit" in sys.argv:
        i = sys.argv.index("--limit")
        limit = int(sys.argv[i + 1])

    t0 = time.time()
    load_masters()
    load_events(limit=limit)
    update_factura_states()
    refresh_features()
    show_counts()
    print(f"\nBackfill complete in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
