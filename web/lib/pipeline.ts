// Orquesta el pipeline end-to-end: ingest -> features -> Lambda /score -> signal
// Usado por /api/simulate-event y /api/scenarios/[slug]
import { createServiceClient } from "@/lib/supabase/server";

type SuppliedFactura = {
  proveedor_id: string;
  comprador_id: string;
  monto_neto_cop: number;
  plazo_dias: number;
  fecha_emision: string; // ISO YYYY-MM-DD
};

export type PipelineStep = {
  name: string;
  status: "running" | "ok" | "error";
  duration_ms?: number;
  payload?: any;
  response?: any;
  error?: string;
};

const LAMBDA_URL = "https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws";

const FEATURE_COLS_FOR_SNAPSHOT =
  "ticket_avg_30d,ticket_avg_90d,n_facturas_30d,delta_facturacion_30v90,delta_facturacion_30v180,plazo_avg_30d,delta_plazo_30v180,is_pico_cosecha_agro,is_q4";

function genId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function runPipeline(
  f: SuppliedFactura,
  onStep: (step: PipelineStep) => void
) {
  const sb = await createServiceClient();
  const startTotal = Date.now();
  const externalId = `FE-SIM-${Date.now().toString(36).toUpperCase()}`;

  // Buscar relación primero
  const { data: relRows } = await sb
    .from("relaciones")
    .select("id")
    .eq("proveedor_id", f.proveedor_id)
    .eq("comprador_id", f.comprador_id)
    .limit(1);
  if (!relRows || relRows.length === 0) {
    onStep({
      name: "0. Validación previa",
      status: "error",
      error: "No existe relación entre ese proveedor y comprador",
    });
    return;
  }
  const relacion_id = relRows[0].id;

  // SNAPSHOT BEFORE: features y último score (para mostrar diff)
  const { data: featuresBefore } = await sb
    .from("features_par")
    .select(FEATURE_COLS_FOR_SNAPSHOT)
    .eq("relacion_id", relacion_id)
    .single();
  const { data: lastSignal } = await sb
    .from("signals")
    .select("score")
    .eq("proveedor_id", f.proveedor_id)
    .eq("comprador_id", f.comprador_id)
    .order("created_at", { ascending: false })
    .limit(1);
  const scoreBefore =
    Array.isArray(lastSignal) && lastSignal[0] ? Number(lastSignal[0].score) : null;

  // STEP 1: POST a /ingest (Edge Function)
  const t1 = Date.now();
  const monto_bruto = Math.round(f.monto_neto_cop * 1.19);
  const impuestos = Math.round(f.monto_neto_cop * 0.19);
  const ingestPayload = {
    event_id: `evt-sim-${genId()}`,
    event_type: "factura_emitida",
    occurred_at: new Date().toISOString(),
    source: "simulator_ui",
    payload: {
      external_id: externalId,
      relacion_id,
      proveedor_id: f.proveedor_id,
      comprador_id: f.comprador_id,
      monto_bruto_centavos: monto_bruto * 100,
      impuestos_centavos: impuestos * 100,
      monto_neto_centavos: f.monto_neto_cop * 100,
      moneda: "COP",
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: addDays(f.fecha_emision, f.plazo_dias),
    },
  };

  onStep({
    name: "1. POST /ingest a Edge Function de Supabase",
    status: "running",
    payload: ingestPayload,
  });

  const ingestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest`;
  const ingestRes = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(ingestPayload),
  });
  const ingestBody = await ingestRes.json();

  if (!ingestRes.ok) {
    onStep({
      name: "1. POST /ingest a Edge Function de Supabase",
      status: "error",
      duration_ms: Date.now() - t1,
      error: JSON.stringify(ingestBody),
    });
    return;
  }
  onStep({
    name: "1. POST /ingest a Edge Function de Supabase",
    status: "ok",
    duration_ms: Date.now() - t1,
    response: { status: ingestRes.status, body: ingestBody, url: ingestUrl },
  });

  // STEP 2: Verificar persistencia con el MONTO REAL desde la BD
  const t2 = Date.now();
  onStep({
    name: "2. INSERT en eventos_raw + facturas (tablas de dominio)",
    status: "running",
    payload: { external_id: externalId, relacion_id },
  });
  await sleep(300);
  const { data: factRows } = await sb
    .from("facturas")
    .select(
      "id, external_id, estado, monto_neto_centavos, monto_bruto_centavos, impuestos_centavos, fecha_emision, fecha_vencimiento, dias_plazo"
    )
    .eq("external_id", externalId)
    .limit(1);
  if (!factRows || factRows.length === 0) {
    onStep({
      name: "2. INSERT en eventos_raw + facturas (tablas de dominio)",
      status: "error",
      duration_ms: Date.now() - t2,
      error: "factura no encontrada tras ingesta — verificar Edge Function",
    });
    return;
  }
  const facturaPersisted = factRows[0];
  onStep({
    name: "2. INSERT en eventos_raw + facturas (tablas de dominio)",
    status: "ok",
    duration_ms: Date.now() - t2,
    response: {
      ...facturaPersisted,
      _monto_pesos_neto: Number(facturaPersisted.monto_neto_centavos) / 100,
      _monto_pesos_bruto: Number(facturaPersisted.monto_bruto_centavos) / 100,
    },
  });

  // STEP 3: Refresh features_par
  const t3 = Date.now();
  onStep({
    name: "3. REFRESH features point-in-time (pg_cron + SQL)",
    status: "running",
    payload: { relacion_id },
  });
  await sb.rpc("refresh_features_now");
  const { data: featuresAfter } = await sb
    .from("features_par")
    .select(FEATURE_COLS_FOR_SNAPSHOT)
    .eq("relacion_id", relacion_id)
    .single();

  const tBefore = featuresBefore ? Number((featuresBefore as any).ticket_avg_30d) : 0;
  const tAfter = featuresAfter ? Number((featuresAfter as any).ticket_avg_30d) : 0;
  onStep({
    name: "3. REFRESH features point-in-time (pg_cron + SQL)",
    status: "ok",
    duration_ms: Date.now() - t3,
    response: {
      before: featuresBefore,
      after: featuresAfter,
      _ticket_avg_30d_pesos_before: tBefore / 100,
      _ticket_avg_30d_pesos_after: tAfter / 100,
      _delta_ticket_pct:
        tBefore > 0 ? ((tAfter - tBefore) / tBefore) * 100 : null,
    },
  });

  // STEP 4: Llamada a Lambda /score
  const t4 = Date.now();
  onStep({
    name: "4. POST /score a AWS Lambda (XGBoost + SHAP)",
    status: "running",
    payload: { relacion_id, lambda_url: `${LAMBDA_URL}/score` },
  });
  const scoreRes = await fetch(`${LAMBDA_URL}/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ relacion_id }),
  });
  const scoreBody = await scoreRes.json();
  if (!scoreRes.ok) {
    onStep({
      name: "4. POST /score a AWS Lambda (XGBoost + SHAP)",
      status: "error",
      duration_ms: Date.now() - t4,
      error: JSON.stringify(scoreBody),
    });
    return;
  }
  onStep({
    name: "4. POST /score a AWS Lambda (XGBoost + SHAP)",
    status: "ok",
    duration_ms: Date.now() - t4,
    response: { status: scoreRes.status, body: scoreBody },
  });

  // STEP 5: INSERT signal -> Realtime push
  const t5 = Date.now();
  onStep({
    name: "5. INSERT en signals + Realtime push WebSocket",
    status: "running",
    payload: { score: scoreBody.score },
  });
  // monto_potencial = ticket_avg_30d * 3  (estimación de volumen de factoring proyectado)
  const monto_pot = featuresAfter
    ? Math.floor(Number((featuresAfter as any).ticket_avg_30d) * 3)
    : 0;
  const { data: signalInserted } = await sb
    .from("signals")
    .insert({
      proveedor_id: f.proveedor_id,
      comprador_id: f.comprador_id,
      factura_id: facturaPersisted.id,
      score: scoreBody.score,
      monto_potencial_centavos: monto_pot,
      razones: scoreBody.razones,
      model_version: "v1-sim",
    })
    .select()
    .single();
  onStep({
    name: "5. INSERT en signals + Realtime push WebSocket",
    status: "ok",
    duration_ms: Date.now() - t5,
    response: signalInserted,
  });

  return {
    total_ms: Date.now() - startTotal,
    factura_id: facturaPersisted.id,
    signal_id: signalInserted?.id,
    score: scoreBody.score,
    score_before: scoreBefore,
    razones: scoreBody.razones,
    relacion_id,
    // === datos enriquecidos para mostrar al usuario ===
    input: {
      monto_neto_cop: f.monto_neto_cop,
      plazo_dias: f.plazo_dias,
      fecha_emision: f.fecha_emision,
    },
    factura_persisted: {
      external_id: facturaPersisted.external_id,
      monto_neto_pesos: Number(facturaPersisted.monto_neto_centavos) / 100,
      monto_bruto_pesos: Number(facturaPersisted.monto_bruto_centavos) / 100,
      impuestos_pesos: Number(facturaPersisted.impuestos_centavos) / 100,
      fecha_emision: facturaPersisted.fecha_emision,
      fecha_vencimiento: facturaPersisted.fecha_vencimiento,
      dias_plazo: facturaPersisted.dias_plazo,
      estado: facturaPersisted.estado,
    },
    features_change: {
      ticket_avg_30d_before_pesos: tBefore / 100,
      ticket_avg_30d_after_pesos: tAfter / 100,
      delta_pct: tBefore > 0 ? ((tAfter - tBefore) / tBefore) * 100 : null,
      delta_facturacion_30v180_before: featuresBefore
        ? Number((featuresBefore as any).delta_facturacion_30v180)
        : 0,
      delta_facturacion_30v180_after: featuresAfter
        ? Number((featuresAfter as any).delta_facturacion_30v180)
        : 0,
    },
    monto_factoring_estimado_pesos: monto_pot / 100,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
