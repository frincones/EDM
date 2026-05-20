-- =============================================================================
-- Migration 0004: helper functions para el simulador interactivo
-- =============================================================================
-- Funciones SQL para soportar:
--  - Refresh point-in-time de features de UN solo par (rapido)
--  - Recuperar facturas que mas contribuyen a la senal
--  - Calcular baselines sectoriales e historicos
-- =============================================================================

-- =============================================================================
-- 1. Snapshot de features para un par (point-in-time AS OF NOW)
-- =============================================================================
-- Devuelve el mismo subset de features que features_par pero para UN solo par,
-- sin tener que refrescar el materialized view entero (lento).
-- =============================================================================
CREATE OR REPLACE FUNCTION snapshot_features_for_pair(p_relacion_id UUID)
RETURNS TABLE (
  relacion_id          UUID,
  proveedor_id         UUID,
  comprador_id         UUID,
  ticket_avg_30d       NUMERIC,
  ticket_avg_90d       NUMERIC,
  ticket_avg_180d      NUMERIC,
  n_facturas_30d       BIGINT,
  n_facturas_180d      BIGINT,
  delta_facturacion_30v90  NUMERIC,
  delta_facturacion_30v180 NUMERIC,
  plazo_avg_30d        NUMERIC,
  plazo_avg_180d       NUMERIC,
  delta_plazo_30v180   NUMERIC,
  is_q4                INT,
  is_pico_cosecha_agro INT
)
LANGUAGE sql STABLE AS $$
  WITH r AS (
    SELECT id, proveedor_id, comprador_id FROM relaciones WHERE id = p_relacion_id
  ),
  f30 AS (
    SELECT AVG(monto_neto_centavos)::NUMERIC AS t, COUNT(*) AS n,
           AVG(dias_plazo)::NUMERIC AS p
    FROM facturas WHERE relacion_id = p_relacion_id
      AND fecha_emision >= CURRENT_DATE - INTERVAL '30 days'
  ),
  f90 AS (
    SELECT AVG(monto_neto_centavos)::NUMERIC AS t
    FROM facturas WHERE relacion_id = p_relacion_id
      AND fecha_emision >= CURRENT_DATE - INTERVAL '90 days'
      AND fecha_emision <  CURRENT_DATE - INTERVAL '30 days'
  ),
  f180 AS (
    SELECT AVG(monto_neto_centavos)::NUMERIC AS t, COUNT(*) AS n,
           AVG(dias_plazo)::NUMERIC AS p
    FROM facturas WHERE relacion_id = p_relacion_id
      AND fecha_emision >= CURRENT_DATE - INTERVAL '180 days'
  ),
  prov AS (
    SELECT id, sector_ciiu FROM proveedores
    WHERE id = (SELECT proveedor_id FROM r)
  )
  SELECT
    r.id, r.proveedor_id, r.comprador_id,
    COALESCE(f30.t, 0), COALESCE(f90.t, 0), COALESCE(f180.t, 0),
    COALESCE(f30.n, 0), COALESCE(f180.n, 0),
    CASE WHEN COALESCE(f90.t, 0) > 0 THEN (COALESCE(f30.t,0) - f90.t) / f90.t ELSE 0 END,
    CASE WHEN COALESCE(f180.t, 0) > 0 THEN (COALESCE(f30.t,0) - f180.t) / f180.t ELSE 0 END,
    COALESCE(f30.p, 30), COALESCE(f180.p, 30),
    COALESCE(f30.p, 30) - COALESCE(f180.p, 30),
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 10 THEN 1 ELSE 0 END,
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (5,6,11,12)
              AND prov.sector_ciiu LIKE '01%' THEN 1 ELSE 0 END
  FROM r, prov, f30, f90, f180;
$$;

-- =============================================================================
-- 2. Refresh del materialized view ENTERO (forma rapida sin downtime)
-- =============================================================================
-- pg_cron ya hace esto cada 15 min, pero el simulador lo llama on-demand
-- =============================================================================
CREATE OR REPLACE FUNCTION refresh_features_now()
RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY features_par;
  RETURN 'refreshed at ' || NOW()::TEXT;
END;
$$;

-- =============================================================================
-- 3. Facturas que mas contribuyen a la senal de un par
-- =============================================================================
-- Devuelve las top N facturas que mas se desvian del baseline historico,
-- para mostrar en el lead detail "estas facturas gatillaron la senal"
-- =============================================================================
CREATE OR REPLACE FUNCTION top_facturas_para_lead(p_relacion_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
  factura_id           UUID,
  fecha_emision        DATE,
  monto_neto_centavos  BIGINT,
  dias_plazo           INT,
  estado               TEXT,
  monto_pct_vs_media   NUMERIC,
  desviacion_score     NUMERIC
)
LANGUAGE sql STABLE AS $$
  WITH baseline AS (
    SELECT AVG(monto_neto_centavos)::NUMERIC AS media,
           STDDEV(monto_neto_centavos)::NUMERIC AS sd
    FROM facturas
    WHERE relacion_id = p_relacion_id
      AND fecha_emision < CURRENT_DATE - INTERVAL '60 days'
  )
  SELECT f.id, f.fecha_emision, f.monto_neto_centavos, f.dias_plazo, f.estado,
    CASE WHEN b.media > 0 THEN ROUND(((f.monto_neto_centavos - b.media) / b.media)::NUMERIC, 4) ELSE 0 END,
    CASE WHEN COALESCE(b.sd, 0) > 0 THEN ROUND(ABS((f.monto_neto_centavos - b.media) / b.sd)::NUMERIC, 2) ELSE 0 END
  FROM facturas f, baseline b
  WHERE f.relacion_id = p_relacion_id
    AND f.fecha_emision >= CURRENT_DATE - INTERVAL '60 days'
  ORDER BY ABS(f.monto_neto_centavos - b.media) DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 4. Baseline sectorial: promedios del sector del proveedor
-- =============================================================================
CREATE OR REPLACE FUNCTION sector_baseline(p_proveedor_id UUID)
RETURNS TABLE (
  sector_ciiu         TEXT,
  n_proveedores       BIGINT,
  ticket_avg          NUMERIC,
  plazo_avg           NUMERIC,
  pct_proveedores_con_factoring NUMERIC
)
LANGUAGE sql STABLE AS $$
  WITH p AS (SELECT sector_ciiu FROM proveedores WHERE id = p_proveedor_id),
       sector_provs AS (
         SELECT prov.id FROM proveedores prov, p WHERE prov.sector_ciiu = p.sector_ciiu
       )
  SELECT
    p.sector_ciiu,
    (SELECT COUNT(*) FROM sector_provs)::BIGINT,
    (SELECT AVG(monto_neto_centavos)::NUMERIC FROM facturas
        WHERE proveedor_id IN (SELECT id FROM sector_provs)
          AND fecha_emision >= CURRENT_DATE - INTERVAL '90 days'),
    (SELECT AVG(dias_plazo)::NUMERIC FROM facturas
        WHERE proveedor_id IN (SELECT id FROM sector_provs)
          AND fecha_emision >= CURRENT_DATE - INTERVAL '90 days'),
    (SELECT (COUNT(DISTINCT o.proveedor_id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM sector_provs), 0)) FROM outcomes_factoring o
        WHERE o.proveedor_id IN (SELECT id FROM sector_provs) AND outcome = 'aceptada')
  FROM p;
$$;

-- =============================================================================
-- 5. Distribucion de scores actuales (para histograma)
-- =============================================================================
CREATE OR REPLACE FUNCTION score_distribution(n_buckets INT DEFAULT 10)
RETURNS TABLE (bucket_lo NUMERIC, bucket_hi NUMERIC, count BIGINT)
LANGUAGE sql STABLE AS $$
  WITH buckets AS (
    SELECT generate_series(0, n_buckets - 1)::NUMERIC / n_buckets AS lo,
           (generate_series(0, n_buckets - 1)::NUMERIC + 1) / n_buckets AS hi
  )
  SELECT b.lo, b.hi,
    (SELECT COUNT(*)::BIGINT FROM signals WHERE score >= b.lo AND score < b.hi)
  FROM buckets b
  ORDER BY b.lo;
$$;

-- =============================================================================
-- 6. Distribucion de arquetipos (para pie chart)
-- =============================================================================
CREATE OR REPLACE FUNCTION archetype_distribution()
RETURNS TABLE (arquetipo TEXT, n_proveedores BIGINT, n_signals_top BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    p.arquetipo,
    COUNT(DISTINCT p.id)::BIGINT,
    COUNT(s.id) FILTER (WHERE s.score >= 0.5)::BIGINT
  FROM proveedores p
  LEFT JOIN signals s ON s.proveedor_id = p.id
  GROUP BY p.arquetipo
  ORDER BY 2 DESC;
$$;

-- =============================================================================
-- 7. Stats de modelo + counts de tablas (para /sistema)
-- =============================================================================
CREATE OR REPLACE FUNCTION system_counts()
RETURNS JSON
LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'compradores',      (SELECT COUNT(*) FROM compradores),
    'proveedores',      (SELECT COUNT(*) FROM proveedores),
    'relaciones',       (SELECT COUNT(*) FROM relaciones),
    'eventos_raw',      (SELECT COUNT(*) FROM eventos_raw),
    'facturas',         (SELECT COUNT(*) FROM facturas),
    'aceptaciones',     (SELECT COUNT(*) FROM aceptaciones),
    'pagos',            (SELECT COUNT(*) FROM pagos),
    'outcomes_factoring', (SELECT COUNT(*) FROM outcomes_factoring),
    'signals',          (SELECT COUNT(*) FROM signals),
    'features_par',     (SELECT COUNT(*) FROM features_par),
    'call_outcomes',    (SELECT COUNT(*) FROM call_outcomes),
    'now',              NOW()
  );
$$;

-- =============================================================================
-- Permisos: estas funciones se llaman desde frontend con anon key (RLS bypass via SECURITY DEFINER)
-- =============================================================================
ALTER FUNCTION snapshot_features_for_pair(UUID) SECURITY DEFINER;
ALTER FUNCTION top_facturas_para_lead(UUID, INT) SECURITY DEFINER;
ALTER FUNCTION sector_baseline(UUID) SECURITY DEFINER;
ALTER FUNCTION score_distribution(INT) SECURITY DEFINER;
ALTER FUNCTION archetype_distribution() SECURITY DEFINER;
ALTER FUNCTION system_counts() SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION snapshot_features_for_pair(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION top_facturas_para_lead(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sector_baseline(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION score_distribution(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION archetype_distribution() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION system_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_features_now() TO service_role;
