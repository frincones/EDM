-- =============================================================================
-- Migration 0002: Feature Engineering
-- =============================================================================
-- Materialized view con las ~31 features por (proveedor, comprador).
-- Refresh cada 15 min via pg_cron.
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS features_par CASCADE;

CREATE MATERIALIZED VIEW features_par AS
WITH base AS (
  SELECT
    r.id              AS relacion_id,
    r.proveedor_id,
    r.comprador_id,
    p.sector_ciiu     AS proveedor_sector,
    p.tamano          AS proveedor_tamano,
    p.fecha_alta_edn  AS proveedor_alta,
    c.plazo_promedio_proveedores  AS comprador_plazo_promedio,
    c.estacionalidad_q4           AS comprador_estacionalidad_q4,
    c.tasa_aceptacion_facturas    AS comprador_tasa_aceptacion,
    EXTRACT(MONTH FROM CURRENT_DATE)::INT AS mes_actual,
    EXTRACT(QUARTER FROM CURRENT_DATE)::INT AS trimestre_actual
  FROM relaciones r
  JOIN proveedores p ON p.id = r.proveedor_id
  JOIN compradores c ON c.id = r.comprador_id
  WHERE r.status = 'activa'
),
fact_30d AS (
  SELECT
    relacion_id,
    AVG(monto_neto_centavos)::NUMERIC  AS ticket_avg_30d,
    SUM(monto_neto_centavos)::BIGINT   AS total_30d,
    COUNT(*)                            AS n_facturas_30d,
    AVG(dias_plazo)::NUMERIC            AS plazo_avg_30d,
    STDDEV(monto_neto_centavos)::NUMERIC AS ticket_std_30d
  FROM facturas
  WHERE fecha_emision >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY relacion_id
),
fact_90d AS (
  SELECT
    relacion_id,
    AVG(monto_neto_centavos)::NUMERIC  AS ticket_avg_90d,
    SUM(monto_neto_centavos)::BIGINT   AS total_90d,
    COUNT(*)                            AS n_facturas_90d,
    AVG(dias_plazo)::NUMERIC            AS plazo_avg_90d
  FROM facturas
  WHERE fecha_emision >= CURRENT_DATE - INTERVAL '90 days'
    AND fecha_emision <  CURRENT_DATE - INTERVAL '30 days'
  GROUP BY relacion_id
),
fact_180d AS (
  SELECT
    relacion_id,
    AVG(monto_neto_centavos)::NUMERIC  AS ticket_avg_180d,
    AVG(dias_plazo)::NUMERIC            AS plazo_avg_180d,
    COUNT(*)                            AS n_facturas_180d
  FROM facturas
  WHERE fecha_emision >= CURRENT_DATE - INTERVAL '180 days'
  GROUP BY relacion_id
),
fact_365d AS (
  SELECT
    relacion_id,
    AVG(monto_neto_centavos)::NUMERIC AS ticket_avg_365d,
    COUNT(*)                            AS n_facturas_365d
  FROM facturas
  WHERE fecha_emision >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY relacion_id
),
fact_ya_mismo_mes AS (
  -- Para detectar estacionalidad anual: monto en mismo mes año anterior
  SELECT
    relacion_id,
    AVG(monto_neto_centavos)::NUMERIC AS ticket_mismo_mes_ya
  FROM facturas
  WHERE EXTRACT(MONTH FROM fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND fecha_emision >= CURRENT_DATE - INTERVAL '13 months'
    AND fecha_emision <  CURRENT_DATE - INTERVAL '11 months'
  GROUP BY relacion_id
),
aceptaciones_agg AS (
  SELECT
    f.relacion_id,
    AVG(a.dias_a_aceptar)::NUMERIC AS dias_aceptacion_avg_90d,
    COUNT(*) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '90 days')::NUMERIC
      / NULLIF(COUNT(*), 0) AS ratio_aceptadas_90d
  FROM facturas f
  JOIN aceptaciones a ON a.factura_id = f.id
  WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '180 days'
  GROUP BY f.relacion_id
),
pagos_agg AS (
  SELECT
    f.relacion_id,
    AVG(p.dias_vs_vencimiento)::NUMERIC AS dias_pago_avg_90d,
    COUNT(*) FILTER (WHERE p.dias_vs_vencimiento > 0)::NUMERIC
      / NULLIF(COUNT(*), 0) AS ratio_pagos_tardios_90d
  FROM facturas f
  JOIN pagos p ON p.factura_id = f.id
  WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY f.relacion_id
),
factoring_prev AS (
  SELECT
    proveedor_id,
    COUNT(*)::INT AS n_ofertas_historicas,
    SUM(CASE WHEN outcome = 'aceptada' THEN 1 ELSE 0 END)::INT AS n_aceptadas,
    SUM(CASE WHEN outcome = 'aceptada' THEN 1 ELSE 0 END)::NUMERIC
      / NULLIF(COUNT(*), 0) AS tasa_aceptacion_historica,
    MAX(fecha_oferta) AS ultima_oferta,
    CURRENT_DATE - MAX(fecha_oferta) AS dias_desde_ultima_oferta
  FROM outcomes_factoring
  WHERE fecha_oferta < CURRENT_DATE - INTERVAL '7 days'  -- evita leakage del label actual
  GROUP BY proveedor_id
)
SELECT
  b.relacion_id,
  b.proveedor_id,
  b.comprador_id,
  CURRENT_TIMESTAMP AS snapshot_at,

  -- Features de volumen
  COALESCE(f30.ticket_avg_30d, 0)                              AS ticket_avg_30d,
  COALESCE(f90.ticket_avg_90d, 0)                              AS ticket_avg_90d,
  COALESCE(f180.ticket_avg_180d, 0)                            AS ticket_avg_180d,
  COALESCE(f30.total_30d, 0)                                   AS total_30d,
  COALESCE(f30.n_facturas_30d, 0)                              AS n_facturas_30d,
  COALESCE(f180.n_facturas_180d, 0)                            AS n_facturas_180d,

  -- Features de TENDENCIA (señal 1 Felipe: incremento de ventas)
  CASE
    WHEN COALESCE(f90.ticket_avg_90d, 0) > 0
    THEN (COALESCE(f30.ticket_avg_30d, 0) - f90.ticket_avg_90d) / f90.ticket_avg_90d
    ELSE 0
  END AS delta_facturacion_30v90,

  CASE
    WHEN COALESCE(f180.ticket_avg_180d, 0) > 0
    THEN (COALESCE(f30.ticket_avg_30d, 0) - f180.ticket_avg_180d) / f180.ticket_avg_180d
    ELSE 0
  END AS delta_facturacion_30v180,

  -- Estacionalidad anual
  CASE
    WHEN COALESCE(fy.ticket_mismo_mes_ya, 0) > 0
    THEN (COALESCE(f30.ticket_avg_30d, 0) - fy.ticket_mismo_mes_ya) / fy.ticket_mismo_mes_ya
    ELSE 0
  END AS delta_vs_mismo_mes_ya,

  COALESCE(f30.ticket_std_30d, 0) AS volatilidad_30d,

  -- Features de PLAZOS (señal 2 Felipe: compresión de plazos)
  COALESCE(f30.plazo_avg_30d, 30)  AS plazo_avg_30d,
  COALESCE(f90.plazo_avg_90d, 30)  AS plazo_avg_90d,
  COALESCE(f180.plazo_avg_180d, 30) AS plazo_avg_180d,
  COALESCE(f30.plazo_avg_30d, 30) - COALESCE(f90.plazo_avg_90d, 30) AS delta_plazo_30v90,
  COALESCE(f30.plazo_avg_30d, 30) - COALESCE(f180.plazo_avg_180d, 30) AS delta_plazo_30v180,

  -- Velocidad operativa
  COALESCE(a.dias_aceptacion_avg_90d, 0)   AS dias_aceptacion_avg_90d,
  COALESCE(a.ratio_aceptadas_90d, 0)       AS ratio_aceptadas_90d,
  COALESCE(pa.dias_pago_avg_90d, 0)        AS dias_pago_avg_90d,
  COALESCE(pa.ratio_pagos_tardios_90d, 0)  AS ratio_pagos_tardios_90d,

  -- Historial de factoring del proveedor
  COALESCE(fp.n_ofertas_historicas, 0)         AS n_ofertas_historicas,
  COALESCE(fp.n_aceptadas, 0)                  AS n_aceptadas_historicas,
  COALESCE(fp.tasa_aceptacion_historica, 0)    AS tasa_aceptacion_historica,
  COALESCE(fp.dias_desde_ultima_oferta, 999)   AS dias_desde_ultima_oferta,

  -- Contexto del proveedor
  b.proveedor_sector,
  b.proveedor_tamano,
  CURRENT_DATE - b.proveedor_alta             AS dias_antiguedad_edn,

  -- Contexto del comprador (ciclicidad por cliente - Felipe)
  COALESCE(b.comprador_plazo_promedio, 30)    AS comprador_plazo_promedio,
  COALESCE(b.comprador_estacionalidad_q4, 0)  AS comprador_estacionalidad_q4,
  COALESCE(b.comprador_tasa_aceptacion, 0.9)  AS comprador_tasa_aceptacion,

  -- Estacionalidad temporal
  b.mes_actual,
  b.trimestre_actual,
  CASE WHEN b.trimestre_actual = 4 THEN 1 ELSE 0 END AS is_q4,
  -- Pico de cosecha colombiano principal: cosecha arroz Mayo-Junio y Noviembre-Diciembre
  CASE WHEN b.mes_actual IN (5, 6, 11, 12) AND b.proveedor_sector LIKE '01%'
       THEN 1 ELSE 0 END                                       AS is_pico_cosecha_agro

FROM base b
LEFT JOIN fact_30d  f30  ON f30.relacion_id  = b.relacion_id
LEFT JOIN fact_90d  f90  ON f90.relacion_id  = b.relacion_id
LEFT JOIN fact_180d f180 ON f180.relacion_id = b.relacion_id
LEFT JOIN fact_365d f365 ON f365.relacion_id = b.relacion_id
LEFT JOIN fact_ya_mismo_mes fy ON fy.relacion_id = b.relacion_id
LEFT JOIN aceptaciones_agg  a  ON a.relacion_id  = b.relacion_id
LEFT JOIN pagos_agg         pa ON pa.relacion_id = b.relacion_id
LEFT JOIN factoring_prev    fp ON fp.proveedor_id = b.proveedor_id;

CREATE UNIQUE INDEX features_par_pk ON features_par (relacion_id);
CREATE INDEX features_par_proveedor ON features_par (proveedor_id);
CREATE INDEX features_par_comprador ON features_par (comprador_id);

-- =============================================================================
-- Función helper para serializar features para la Lambda
-- =============================================================================
CREATE OR REPLACE FUNCTION get_features_for_scoring(p_relacion_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT to_jsonb(f) - 'relacion_id' - 'proveedor_id' - 'comprador_id' - 'snapshot_at'
  FROM features_par f
  WHERE f.relacion_id = p_relacion_id;
$$;

COMMENT ON FUNCTION get_features_for_scoring IS
'Devuelve las features de un par (proveedor, comprador) como JSON listo para enviar a Lambda /score.';
