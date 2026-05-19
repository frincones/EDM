-- =============================================================================
-- EDM Demo — Factoring Signals Engine
-- Migration 0001: Schema base
-- =============================================================================
-- Modelo de datos para el pipeline:
--   raw events -> tablas de dominio -> features_par (materialized view)
--   -> Lambda scoring -> signals -> dashboard
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- MAESTROS
-- =============================================================================

CREATE TABLE IF NOT EXISTS compradores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nit             TEXT NOT NULL UNIQUE,
  razon_social    TEXT NOT NULL,
  sector_ciiu     TEXT,
  -- Features del comprador (ciclicidad por convenio, segun Felipe)
  plazo_promedio_proveedores  INT,             -- ej. Sodexo 60d, ACER 30d
  estacionalidad_q4           NUMERIC(3,2),    -- 0.0-1.0 (qué tan estacional Q4)
  tasa_aceptacion_facturas    NUMERIC(3,2),    -- 0.0-1.0
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN compradores.plazo_promedio_proveedores IS
'Días promedio de plazo que este comprador da a sus proveedores. Feature transversal: Felipe dijo "una cosa es la ciclicidad de SODEXO, otra de ACER".';

CREATE TABLE IF NOT EXISTS proveedores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nit             TEXT NOT NULL UNIQUE,
  razon_social    TEXT NOT NULL,
  sector_ciiu     TEXT NOT NULL,
  sector_nombre   TEXT,
  tamano          TEXT CHECK (tamano IN ('micro','pequena','mediana','grande')),
  ciudad          TEXT,
  fecha_alta_edn  DATE,
  arquetipo       TEXT NOT NULL CHECK (arquetipo IN (
    'estable',
    'incremento_ventas',
    'plazos_comprimidos',
    'ciclicidad_agricola',
    'ciclicidad_comercio_q4'
  )),
  arquetipo_visible BOOLEAN DEFAULT FALSE,  -- TRUE solo para los 5 heroes del demo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN proveedores.arquetipo IS
'Arquetipo de comportamiento del proveedor. Fiel a las 4 señales que Felipe identifica + estable como negativo.';

CREATE TABLE IF NOT EXISTS relaciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  comprador_id   UUID NOT NULL REFERENCES compradores(id) ON DELETE CASCADE,
  fecha_inicio    DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','inactiva')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proveedor_id, comprador_id)
);

CREATE INDEX idx_relaciones_proveedor ON relaciones(proveedor_id);
CREATE INDEX idx_relaciones_comprador ON relaciones(comprador_id);

-- =============================================================================
-- CAPA RAW (log inmutable de eventos)
-- =============================================================================

CREATE TABLE IF NOT EXISTS eventos_raw (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        TEXT NOT NULL UNIQUE,   -- idempotencia
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'orden_compra_creada',
    'factura_emitida',
    'nota_recepcion_registrada',
    'factura_aceptada',
    'pago_recibido',
    'oferta_factoring_emitida',
    'oferta_factoring_outcome'
  )),
  payload         JSONB NOT NULL,
  source          TEXT NOT NULL DEFAULT 'unknown',  -- 'edn_webhook' | 'synthetic_backfill'
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_eventos_raw_type_received ON eventos_raw(event_type, received_at DESC);
CREATE INDEX idx_eventos_raw_processed ON eventos_raw(processed_at) WHERE processed_at IS NULL;

-- =============================================================================
-- CAPA DE DOMINIO (tablas normalizadas)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ordenes_compra (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id     TEXT NOT NULL UNIQUE,
  relacion_id     UUID NOT NULL REFERENCES relaciones(id),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  comprador_id   UUID NOT NULL REFERENCES compradores(id),
  monto_centavos  BIGINT NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'COP',
  fecha_emision   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oc_relacion_fecha ON ordenes_compra(relacion_id, fecha_emision DESC);

CREATE TABLE IF NOT EXISTS facturas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id     TEXT NOT NULL UNIQUE,
  cufe            TEXT,                       -- Codigo Unico Factura Electronica (DIAN)
  orden_compra_id UUID REFERENCES ordenes_compra(id),
  relacion_id     UUID NOT NULL REFERENCES relaciones(id),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  comprador_id   UUID NOT NULL REFERENCES compradores(id),
  monto_bruto_centavos   BIGINT NOT NULL,
  impuestos_centavos     BIGINT NOT NULL,
  monto_neto_centavos    BIGINT NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'COP',
  fecha_emision   DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  dias_plazo      INT GENERATED ALWAYS AS (fecha_vencimiento - fecha_emision) STORED,
  estado          TEXT NOT NULL DEFAULT 'emitida' CHECK (estado IN (
    'emitida','recibida','aceptada','rechazada','pagada','en_factoring'
  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facturas_relacion_fecha ON facturas(relacion_id, fecha_emision DESC);
CREATE INDEX idx_facturas_proveedor_fecha ON facturas(proveedor_id, fecha_emision DESC);
CREATE INDEX idx_facturas_comprador_fecha ON facturas(comprador_id, fecha_emision DESC);
CREATE INDEX idx_facturas_estado ON facturas(estado);

CREATE TABLE IF NOT EXISTS notas_recepcion (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  fecha_recepcion DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nr_factura ON notas_recepcion(factura_id);

CREATE TABLE IF NOT EXISTS aceptaciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  fecha_aceptacion DATE NOT NULL,
  dias_a_aceptar  INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aceptaciones_factura ON aceptaciones(factura_id);

CREATE TABLE IF NOT EXISTS pagos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  monto_centavos  BIGINT NOT NULL,
  fecha_pago      DATE NOT NULL,
  dias_vs_vencimiento INT,    -- negativo = pago anticipado, positivo = atraso
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagos_factura ON pagos(factura_id);

-- Tabla de OUTCOMES (los LABELS del modelo)
CREATE TABLE IF NOT EXISTS outcomes_factoring (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id     TEXT NOT NULL UNIQUE,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  comprador_id   UUID NOT NULL REFERENCES compradores(id),
  factura_id      UUID REFERENCES facturas(id),
  fecha_oferta    DATE NOT NULL,
  fecha_decision  DATE,
  outcome         TEXT CHECK (outcome IN ('aceptada','rechazada','no_contesto','pendiente')),
  monto_ofertado_centavos  BIGINT,
  tasa_ofertada            NUMERIC(5,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outcomes_proveedor_fecha ON outcomes_factoring(proveedor_id, fecha_oferta DESC);
CREATE INDEX idx_outcomes_outcome ON outcomes_factoring(outcome);

-- =============================================================================
-- OUTPUTS DEL MOTOR ML
-- =============================================================================

-- Señales emitidas por el modelo (output del Lambda)
CREATE TABLE IF NOT EXISTS signals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  comprador_id   UUID NOT NULL REFERENCES compradores(id),
  factura_id      UUID REFERENCES facturas(id),
  score           NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  rank            INT,
  monto_potencial_centavos  BIGINT,
  razones         JSONB NOT NULL,  -- [{feature, value, contribution, label}]
  model_version   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_created_desc ON signals(created_at DESC);
CREATE INDEX idx_signals_score_desc ON signals(score DESC);
CREATE INDEX idx_signals_proveedor ON signals(proveedor_id, created_at DESC);

-- Feedback loop: outcomes de las llamadas comerciales
CREATE TABLE IF NOT EXISTS call_outcomes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id       UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  user_id         UUID,   -- quien hizo la llamada (Supabase Auth)
  outcome         TEXT NOT NULL CHECK (outcome IN (
    'factoring_cerrado','factoring_rechazado','no_contesto','recontactar','no_aplica'
  )),
  monto_cerrado_centavos  BIGINT,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_outcomes_signal ON call_outcomes(signal_id);
CREATE INDEX idx_call_outcomes_outcome ON call_outcomes(outcome);
