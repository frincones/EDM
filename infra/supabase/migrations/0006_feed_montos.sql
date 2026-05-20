-- =============================================================================
-- Migration 0006: agregar monto de la factura al v_top_leads
-- =============================================================================
-- Antes: /feed mostraba monto_potencial (= ticket_avg * 3), confunde a Felipe
-- Ahora: mostramos TAMBIEN el monto neto de la factura que disparo la senal
-- =============================================================================

DROP VIEW IF EXISTS v_top_leads CASCADE;

CREATE OR REPLACE VIEW v_top_leads AS
SELECT
  s.id                 AS signal_id,
  s.score,
  s.razones,
  s.monto_potencial_centavos,
  s.factura_id,
  -- El monto NETO de la factura que gatillo la senal (si hay)
  f.monto_neto_centavos    AS factura_monto_neto_centavos,
  f.fecha_emision          AS factura_fecha_emision,
  f.dias_plazo             AS factura_dias_plazo,
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
LEFT JOIN facturas f ON f.id = s.factura_id
LEFT JOIN LATERAL (
  SELECT outcome, created_at FROM call_outcomes
  WHERE signal_id = s.id
  ORDER BY created_at DESC LIMIT 1
) co ON TRUE
ORDER BY s.score DESC;

-- Reconceder permisos como en 0003
GRANT SELECT ON v_top_leads TO anon, authenticated;
