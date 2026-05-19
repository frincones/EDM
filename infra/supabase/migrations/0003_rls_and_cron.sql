-- =============================================================================
-- Migration 0003: RLS + pg_cron + Realtime
-- =============================================================================

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Modelo simple para demo (single user authenticated): authenticated puede leer todo,
-- service_role bypassa RLS (lo usa Lambda y backend scripts).
-- Para producción se diferenciaría por comprador (multi-tenant real).

ALTER TABLE compradores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE relaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_raw         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra      ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_recepcion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aceptaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes_factoring  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_outcomes       ENABLE ROW LEVEL SECURITY;

-- Policies de LECTURA para 'authenticated'
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'compradores','proveedores','relaciones','ordenes_compra',
    'facturas','notas_recepcion','aceptaciones','pagos',
    'outcomes_factoring','signals','call_outcomes'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I_select_auth ON %I FOR SELECT TO authenticated USING (true);', t, t);
  END LOOP;
END$$;

-- Policy para escribir call_outcomes (feedback loop desde frontend)
CREATE POLICY call_outcomes_insert_auth ON call_outcomes
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- REALTIME — habilitar para tabla signals
-- =============================================================================
-- (Esto en Supabase se gestiona vía dashboard o via SQL ALTER PUBLICATION)
ALTER PUBLICATION supabase_realtime ADD TABLE signals;

-- =============================================================================
-- PG_CRON JOBS
-- =============================================================================
-- Refrescar features cada 15 minutos
SELECT cron.schedule(
  'refresh_features_par',
  '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY features_par;$$
);

-- Keep-warm Lambda cada 5 minutos (la URL se reemplaza tras deploy)
-- NOTA: comentado hasta tener LAMBDA_FUNCTION_URL configurada
-- SELECT cron.schedule(
--   'lambda_warmup',
--   '*/5 * * * *',
--   $$SELECT net.http_get(url := 'https://<lambda-url>/health');$$
-- );

-- =============================================================================
-- TRIGGER: cuando se inserta una factura, llamar a Lambda /score
-- =============================================================================
-- Database webhook se configura via Supabase Dashboard o Management API.
-- Aquí dejamos la función SQL helper que la webhook invocará.

CREATE OR REPLACE FUNCTION notify_factura_for_scoring()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- En producción real, esto haría un net.http_post a Lambda.
  -- Para el demo, la webhook Supabase Database Webhook lo hace automatico.
  -- Esta funcion queda como punto de extension.
  RETURN NEW;
END;
$$;

-- =============================================================================
-- VISTAS UTILITARIAS PARA EL DASHBOARD
-- =============================================================================

CREATE OR REPLACE VIEW v_top_leads AS
SELECT
  s.id                 AS signal_id,
  s.score,
  s.razones,
  s.monto_potencial_centavos,
  s.created_at,
  p.id                 AS proveedor_id,
  p.nit                AS proveedor_nit,
  p.razon_social       AS proveedor_nombre,
  p.sector_nombre      AS proveedor_sector,
  p.arquetipo,
  p.arquetipo_visible,
  c.id                 AS comprador_id,
  c.razon_social       AS comprador_nombre,
  -- ultimo call outcome si existe
  co.outcome           AS ultimo_outcome,
  co.created_at        AS ultimo_outcome_at
FROM signals s
JOIN proveedores p ON p.id = s.proveedor_id
JOIN compradores c ON c.id = s.comprador_id
LEFT JOIN LATERAL (
  SELECT outcome, created_at FROM call_outcomes
  WHERE signal_id = s.id
  ORDER BY created_at DESC LIMIT 1
) co ON TRUE
ORDER BY s.score DESC;

CREATE OR REPLACE VIEW v_stats_antes_despues AS
SELECT
  -- Antes (linea base ficticia)
  5000 AS llamadas_antes,
  500  AS cerradas_antes,
  10.0 AS tasa_conversion_antes_pct,
  -- Despues (basado en top scoreado)
  (SELECT COUNT(*) FROM signals WHERE score >= 0.6) AS llamadas_propuestas,
  (SELECT COUNT(*) FROM signals WHERE score >= 0.6) AS top_leads_actuales,
  35.0 AS tasa_conversion_proyectada_pct;
