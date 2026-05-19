"""
Generadores de series temporales por arquetipo.

Cada funcion recibe el contexto del proveedor + parametros y devuelve listas
de eventos (orden_compra, factura, nota_recepcion, aceptacion, pago, oferta_factoring)
con timestamps coherentes.

Las senales se INYECTAN segun el arquetipo, alineadas a lo que Felipe describe.
"""
from __future__ import annotations
import random
import uuid
from datetime import date, timedelta, datetime
from typing import Any
import math

import numpy as np

from data.generator.config import ARQUETIPO_PARAMS, HOY, INICIO_HISTORIA


def _next_business_day(d: date) -> date:
    """Salta sabados y domingos hacia adelante."""
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def _sample_dia_emision(rng: random.Random, year: int, month: int) -> date:
    """Selecciona un dia habil del mes con clustering en quincena y fin de mes."""
    weights = []
    days = []
    import calendar
    _, last = calendar.monthrange(year, month)
    for d in range(1, last + 1):
        weights.append(2.0 if d in (15, 16, 30, 31, last) else 1.0)
        days.append(date(year, month, d))
    chosen = rng.choices(days, weights=weights, k=1)[0]
    return _next_business_day(chosen)


def _emite_factura(
    rng: random.Random,
    fecha_emision: date,
    monto_neto: int,
    plazo_dias: int,
    proveedor_id: str,
    comprador_id: str,
    relacion_id: str,
    orden_compra_id: str | None = None,
) -> dict[str, Any]:
    factura_id = str(uuid.uuid4())
    impuestos = int(monto_neto * 0.19)
    monto_bruto = monto_neto + impuestos
    fecha_venc = fecha_emision + timedelta(days=plazo_dias)
    cufe_raw = f"{proveedor_id}-{comprador_id}-{factura_id}".encode("utf-8")
    cufe = uuid.uuid5(uuid.NAMESPACE_OID, cufe_raw.hex()).hex
    return {
        "id": factura_id,
        "external_id": f"FE-{factura_id[:8].upper()}",
        "cufe": cufe,
        "orden_compra_id": orden_compra_id,
        "relacion_id": relacion_id,
        "proveedor_id": proveedor_id,
        "comprador_id": comprador_id,
        "monto_bruto_centavos": monto_bruto * 100,
        "impuestos_centavos": impuestos * 100,
        "monto_neto_centavos": monto_neto * 100,
        "moneda": "COP",
        "fecha_emision": fecha_emision.isoformat(),
        "fecha_vencimiento": fecha_venc.isoformat(),
    }


def _ciclo_completo_factura(
    rng: random.Random,
    factura: dict,
    plazo_dias: int,
    tasa_aceptacion: float,
):
    """Genera nota recepcion + aceptacion + pago para una factura."""
    fecha_emision = date.fromisoformat(factura["fecha_emision"])
    eventos = []

    # 1. Orden de compra (opcional, 60% de facturas tienen OC)
    if rng.random() < 0.6:
        oc_id = str(uuid.uuid4())
        oc_fecha = fecha_emision - timedelta(days=rng.randint(3, 14))
        eventos.append(("orden_compra_creada", {
            "id": oc_id,
            "external_id": f"OC-{oc_id[:8].upper()}",
            "relacion_id": factura["relacion_id"],
            "proveedor_id": factura["proveedor_id"],
            "comprador_id": factura["comprador_id"],
            "monto_centavos": factura["monto_bruto_centavos"],
            "moneda": "COP",
            "fecha_emision": oc_fecha.isoformat(),
        }, oc_fecha))
        factura["orden_compra_id"] = oc_id

    eventos.append(("factura_emitida", factura, fecha_emision))

    # Si no es muy reciente, agregamos los otros eventos
    es_reciente = (HOY - fecha_emision).days < 7
    if es_reciente:
        return eventos

    # 2. Nota de recepcion (95% de las veces, 1-4 dias despues)
    if rng.random() < 0.95:
        fr_dias = rng.randint(1, 4)
        fecha_recepcion = fecha_emision + timedelta(days=fr_dias)
        eventos.append(("nota_recepcion_registrada", {
            "factura_id": factura["id"],
            "fecha_recepcion": fecha_recepcion.isoformat(),
        }, fecha_recepcion))

        # 3. Aceptacion (segun tasa)
        if rng.random() < tasa_aceptacion:
            dias_a_aceptar = rng.randint(2, 10)
            fecha_aceptacion = fecha_emision + timedelta(days=dias_a_aceptar)
            if fecha_aceptacion <= HOY:
                eventos.append(("factura_aceptada", {
                    "factura_id": factura["id"],
                    "fecha_aceptacion": fecha_aceptacion.isoformat(),
                    "dias_a_aceptar": dias_a_aceptar,
                }, fecha_aceptacion))

                # 4. Pago si ya vencio
                fecha_venc = date.fromisoformat(factura["fecha_vencimiento"])
                if fecha_venc <= HOY:
                    dias_vs_venc = int(rng.gauss(0, 3))
                    fecha_pago = fecha_venc + timedelta(days=dias_vs_venc)
                    if fecha_pago <= HOY:
                        eventos.append(("pago_recibido", {
                            "factura_id": factura["id"],
                            "monto_centavos": factura["monto_bruto_centavos"],
                            "fecha_pago": fecha_pago.isoformat(),
                            "dias_vs_vencimiento": dias_vs_venc,
                        }, fecha_pago))

    return eventos


def _quizas_ofrecer_factoring(
    rng: random.Random,
    factura: dict,
    params,
):
    """Decide si para esta factura hubo oferta de factoring historica."""
    fecha_emision = date.fromisoformat(factura["fecha_emision"])
    if (HOY - fecha_emision).days < 30:
        return []  # facturas muy recientes no se ofrecen aun

    if rng.random() > params.prob_oferta_factoring:
        return []

    fecha_oferta = fecha_emision + timedelta(days=rng.randint(2, 8))
    if fecha_oferta > HOY:
        return []

    oferta_id = str(uuid.uuid4())
    monto_oferta = int(factura["monto_neto_centavos"] * 0.92)

    eventos = [("oferta_factoring_emitida", {
        "external_id": f"OF-{oferta_id[:8].upper()}",
        "proveedor_id": factura["proveedor_id"],
        "comprador_id": factura["comprador_id"],
        "factura_id": factura["id"],
        "fecha_oferta": fecha_oferta.isoformat(),
        "monto_ofertado_centavos": monto_oferta,
        "tasa_ofertada": round(rng.uniform(0.014, 0.022), 4),
    }, fecha_oferta)]

    fecha_decision = fecha_oferta + timedelta(days=rng.randint(1, 5))
    if fecha_decision <= HOY:
        rv = rng.random()
        if rv < params.prob_outcome_aceptado:
            outcome = "aceptada"
        elif rv < params.prob_outcome_aceptado + 0.50:
            outcome = "rechazada"
        else:
            outcome = "no_contesto"
        eventos.append(("oferta_factoring_outcome", {
            "external_id": f"OF-{oferta_id[:8].upper()}",
            "fecha_decision": fecha_decision.isoformat(),
            "outcome": outcome,
        }, fecha_decision))

    return eventos


# =============================================================================
# Funciones generadoras de serie temporal por arquetipo
# =============================================================================

def _amount_lognormal(rng: random.Random, mu: float, sigma: float) -> int:
    """Devuelve monto en COP enteros usando log-normal."""
    return int(math.exp(rng.gauss(mu, sigma)))


def generar_serie(arquetipo: str, ctx: dict, rng: random.Random) -> list[tuple[str, dict, date]]:
    """
    Genera la serie completa de eventos para un proveedor con un arquetipo dado.
    Retorna lista de (event_type, payload, fecha) ordenable por fecha.
    """
    params = ARQUETIPO_PARAMS[arquetipo]
    proveedor_id = ctx["proveedor_id"]
    comprador_id = ctx["comprador_id"]
    relacion_id = ctx["relacion_id"]
    tasa_acept = ctx.get("tasa_aceptacion_comprador", 0.9)
    plazo_comprador = ctx.get("plazo_comprador", params.plazo_base_dias)

    eventos: list[tuple[str, dict, date]] = []
    cursor = INICIO_HISTORIA

    while cursor <= HOY:
        year, month = cursor.year, cursor.month

        # Frecuencia de facturas este mes (Poisson)
        base_freq = params.frecuencia_facturas_mes
        multiplicador = _multiplicador_mensual(arquetipo, year, month, cursor)
        n_facts = max(0, rng.gauss(base_freq * multiplicador, 1.2))
        n_facts = int(round(n_facts))

        for _ in range(n_facts):
            fecha_emision = _sample_dia_emision(rng, year, month)
            if fecha_emision > HOY:
                continue
            monto = _amount_mensual(arquetipo, year, month, cursor, params, rng)
            plazo = _plazo_mensual(arquetipo, fecha_emision, params, plazo_comprador, rng)

            factura = _emite_factura(
                rng, fecha_emision, monto, plazo,
                proveedor_id, comprador_id, relacion_id,
            )
            eventos.extend(_ciclo_completo_factura(rng, factura, plazo, tasa_acept))
            eventos.extend(_quizas_ofrecer_factoring(rng, factura, params))

        # avanzar al mes siguiente
        if month == 12:
            cursor = date(year + 1, 1, 1)
        else:
            cursor = date(year, month + 1, 1)

    return eventos


def _multiplicador_mensual(arquetipo: str, year: int, month: int, cursor: date) -> float:
    """Multiplicador de frecuencia por arquetipo y mes (estacionalidad)."""
    meses_atras = (HOY.year - year) * 12 + (HOY.month - month)

    if arquetipo == "estable":
        return 1.0

    if arquetipo == "incremento_ventas":
        # Crecimiento solo en ultimos 2-3 meses, antes plano
        if meses_atras <= 1:
            return 1.5
        if meses_atras == 2:
            return 1.25
        return 1.0

    if arquetipo == "plazos_comprimidos":
        # Volumen estable, lo que cambia son los plazos (no la frecuencia)
        return 1.0

    if arquetipo == "ciclicidad_agricola":
        # Pico en cosecha arroz Tolima/Llanos: Mayo-Junio y Nov-Dic
        if month in (5, 6, 11, 12):
            return 2.5
        if month in (4, 7, 10):
            return 1.5
        return 0.6

    if arquetipo == "ciclicidad_comercio_q4":
        if month in (10, 11, 12):
            return 2.0
        if month in (9,):
            return 1.4
        return 1.0

    return 1.0


def _amount_mensual(arquetipo, year, month, cursor, params, rng) -> int:
    """Monto base con modificadores estacionales/tendencia."""
    base = _amount_lognormal(rng, params.monto_base_log_mean, params.monto_log_sigma)
    meses_atras = (HOY.year - year) * 12 + (HOY.month - month)

    if arquetipo == "incremento_ventas":
        # Crecimiento gradual reciente
        if meses_atras <= 1:
            base = int(base * 1.45)
        elif meses_atras == 2:
            base = int(base * 1.25)

    elif arquetipo == "ciclicidad_agricola":
        if month in (5, 6, 11, 12):
            base = int(base * 1.6)
        elif month in (4, 7, 10):
            base = int(base * 1.2)

    elif arquetipo == "ciclicidad_comercio_q4":
        if month in (10, 11, 12):
            base = int(base * 1.7)

    return base


def _plazo_mensual(arquetipo, fecha_emision, params, plazo_comprador, rng) -> int:
    """Plazo en dias, con inyeccion de senal de compresion si aplica."""
    base = plazo_comprador if plazo_comprador else params.plazo_base_dias
    if arquetipo == "plazos_comprimidos":
        # Inyectar compresion en ultimos ~60 dias
        if (HOY - fecha_emision).days < 60:
            base = max(15, int(base * 0.5))   # 30 -> 15
        elif (HOY - fecha_emision).days < 120:
            base = int(base * 0.75)
    plazo = int(rng.gauss(base, params.plazo_sigma_dias))
    return max(5, plazo)
