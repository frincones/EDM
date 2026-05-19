"""
Orquesta la generacion completa del dataset sintetico:
- Compradores (5)
- Proveedores (~65) con distribucion de arquetipos
- 5 Heroes curados
- Relaciones proveedor-comprador
- Series temporales completas (~10K-15K eventos)

Salida: data/output/events.jsonl (ordenado cronologicamente)
        data/output/master.json (compradores + proveedores + relaciones)
"""
from __future__ import annotations
import json
import random
import uuid
from pathlib import Path
from datetime import date

from faker import Faker

from data.generator.config import (
    SEED, N_PROVEEDORES, COMPRADORES, DISTRIBUCION_ARQUETIPOS,
    SECTORES_CIIU, HEROES, ARQUETIPO_PARAMS, HOY, INICIO_HISTORIA
)
from data.generator.nits import generar_nit
from data.generator.archetypes import generar_serie


OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    rng = random.Random(SEED)
    fake = Faker("es_CO")
    Faker.seed(SEED)

    # =========================================================================
    # 1. Compradores
    # =========================================================================
    compradores = []
    for c in COMPRADORES:
        compradores.append({
            "id": str(uuid.uuid4()),
            **c,
        })
    print(f"-> {len(compradores)} compradores creados")

    # =========================================================================
    # 2. Proveedores con distribucion de arquetipos
    # =========================================================================
    proveedores = []
    relaciones = []

    # Primero los heroes (curados)
    for hero in HEROES:
        comp = next(c for c in compradores if c["nit"] == hero["comprador_nit"])
        prov_id = str(uuid.uuid4())
        proveedores.append({
            "id": prov_id,
            "nit": generar_nit(rng),
            "razon_social": hero["razon_social"],
            "sector_ciiu": hero["sector_ciiu"],
            "sector_nombre": hero["sector_nombre"],
            "tamano": hero["tamano"],
            "ciudad": hero["ciudad"],
            "fecha_alta_edn": (HOY.replace(year=HOY.year - 1)).isoformat(),
            "arquetipo": hero["arquetipo"],
            "arquetipo_visible": True,
            "external_handle": hero["external_handle"],
            "narrative": hero["narrative"],
        })
        relaciones.append({
            "id": str(uuid.uuid4()),
            "proveedor_id": prov_id,
            "comprador_id": comp["id"],
            "fecha_inicio": (HOY.replace(year=HOY.year - 1)).isoformat(),
        })

    # Resto de proveedores
    n_restantes = N_PROVEEDORES - len(HEROES)
    arquetipos_list = list(DISTRIBUCION_ARQUETIPOS.keys())
    probs = list(DISTRIBUCION_ARQUETIPOS.values())
    arq_assignments = rng.choices(arquetipos_list, weights=probs, k=n_restantes)

    for arq in arq_assignments:
        sectores = SECTORES_CIIU[arq]
        sector_pesos = [s[2] for s in sectores]
        sector_idx = rng.choices(range(len(sectores)), weights=sector_pesos, k=1)[0]
        ciiu, nombre, _ = sectores[sector_idx]
        prov_id = str(uuid.uuid4())
        proveedores.append({
            "id": prov_id,
            "nit": generar_nit(rng),
            "razon_social": fake.company(),
            "sector_ciiu": ciiu,
            "sector_nombre": nombre,
            "tamano": rng.choices(
                ["micro", "pequena", "mediana", "grande"],
                weights=[0.25, 0.45, 0.25, 0.05], k=1
            )[0],
            "ciudad": fake.city(),
            "fecha_alta_edn": date(
                HOY.year - rng.randint(1, 3),
                rng.randint(1, 12),
                rng.randint(1, 28),
            ).isoformat(),
            "arquetipo": arq,
            "arquetipo_visible": False,
        })
        # asignar a 1 o 2 compradores
        n_comps = rng.choices([1, 2], weights=[0.75, 0.25], k=1)[0]
        comp_sample = rng.sample(compradores, n_comps)
        for comp in comp_sample:
            relaciones.append({
                "id": str(uuid.uuid4()),
                "proveedor_id": prov_id,
                "comprador_id": comp["id"],
                "fecha_inicio": INICIO_HISTORIA.isoformat(),
            })

    print(f"-> {len(proveedores)} proveedores generados ({len(HEROES)} heroes)")
    print(f"-> {len(relaciones)} relaciones")

    # Resumen por arquetipo
    from collections import Counter
    counts = Counter(p["arquetipo"] for p in proveedores)
    for arq, n in sorted(counts.items()):
        pct = 100.0 * n / len(proveedores)
        print(f"   {arq}: {n} ({pct:.1f}%)")

    # =========================================================================
    # 3. Generar series temporales por relacion
    # =========================================================================
    all_events: list[tuple[str, dict, date]] = []
    by_relacion: dict[str, list] = {}

    for rel in relaciones:
        proveedor = next(p for p in proveedores if p["id"] == rel["proveedor_id"])
        comprador = next(c for c in compradores if c["id"] == rel["comprador_id"])
        ctx = {
            "proveedor_id": proveedor["id"],
            "comprador_id": comprador["id"],
            "relacion_id": rel["id"],
            "tasa_aceptacion_comprador": comprador["tasa_aceptacion_facturas"],
            "plazo_comprador": comprador["plazo_promedio_proveedores"],
        }
        eventos = generar_serie(proveedor["arquetipo"], ctx, rng)
        by_relacion[rel["id"]] = len(eventos)
        all_events.extend(eventos)

    print(f"-> {len(all_events)} eventos totales generados")

    # Ordenar cronologicamente
    all_events.sort(key=lambda x: x[2])

    # =========================================================================
    # 4. Escribir outputs
    # =========================================================================
    master = {
        "compradores": compradores,
        "proveedores": proveedores,
        "relaciones": relaciones,
        "stats": {
            "n_eventos": len(all_events),
            "n_proveedores": len(proveedores),
            "n_relaciones": len(relaciones),
            "distribucion_arquetipos": dict(counts),
            "fecha_inicio": INICIO_HISTORIA.isoformat(),
            "fecha_corte": HOY.isoformat(),
            "seed": SEED,
        }
    }
    (OUTPUT_DIR / "master.json").write_text(
        json.dumps(master, indent=2, default=str), encoding="utf-8"
    )

    # Eventos en jsonlines (formato del endpoint /ingest)
    events_path = OUTPUT_DIR / "events.jsonl"
    with events_path.open("w", encoding="utf-8") as f:
        for event_type, payload, fecha in all_events:
            evt = {
                "event_id": str(uuid.uuid4()),
                "event_type": event_type,
                "occurred_at": fecha.isoformat() if hasattr(fecha, "isoformat") else str(fecha),
                "payload": payload,
                "source": "synthetic_backfill",
            }
            f.write(json.dumps(evt, default=str) + "\n")

    print(f"-> master.json escrito: {OUTPUT_DIR/'master.json'}")
    print(f"-> events.jsonl escrito: {events_path}")
    print(f"   tamano: {events_path.stat().st_size/1024:.0f} KB")


if __name__ == "__main__":
    main()
