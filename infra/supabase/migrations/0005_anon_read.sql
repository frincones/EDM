-- =============================================================================
-- Migration 0005: permitir SELECT para anon en tablas que el frontend
-- carga client-side (browser con anon key)
-- =============================================================================
-- Esto fix la carga de dropdowns en /simulador y queries en /feed
-- sin comprometer seguridad: las tablas con info sensible
-- (call_outcomes, eventos_raw) se MANTIENEN bloqueadas a anon.
-- =============================================================================

-- Permitir lectura a anon de master data + signals
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'compradores',
    'proveedores',
    'relaciones',
    'signals'
  ])
  LOOP
    -- Si ya existe la policy para anon, dropearla primero
    EXECUTE format('DROP POLICY IF EXISTS %I_select_anon ON %I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_anon ON %I FOR SELECT TO anon USING (true);',
      t, t
    );
  END LOOP;
END$$;
