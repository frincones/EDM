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

  // STEP 1: POST a /ingest (Edge Function)
  const t1 = Date.now();
  const ingestPayload = {
    event_id: `evt-sim-${genId()}`,
    event_type: "factura_emitida",
    occurred_at: new Date().toISOString(),
    source: "simulator_ui",
    payload: {
      external_id: externalId,
      relacion_id: null, // lo agregamos abajo
      proveedor_id: f.proveedor_id,
      comprador_id: f.comprador_id,
      monto_bruto_centavos: Math.round(f.monto_neto_cop * 1.19) * 100,
      impuestos_centavos: Math.round(f.monto_neto_cop * 0.19) * 100,
      monto_neto_centavos: f.monto_neto_cop * 100,
      moneda: "COP",
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: addDays(f.fecha_emision, f.plazo_dias),
    },
  };

  // Obtener relacion_id
  const { data: relRows } = await sb
    .from("relaciones")
    .select("id")
    .eq("proveedor_id", f.proveedor_id)
    .eq("comprador_id", f.comprador_id)
    .limit(1);

  if (!relRows || relRows.length === 0) {
    onStep({
      name: "1. POST /ingest a Edge Function de Supabase",
      status: "error",
      duration_ms: Date.now() - t1,
      error: "No existe relación entre ese proveedor y comprador",
    });
    return;
  }
  ingestPayload.payload.relacion_id = relRows[0].id;

  onStep({
    name: "1. POST /ingest a Edge Function de Supabase",
    status: "running",
    payload: { ...ingestPayload, payload: { ...ingestPayload.payload, monto_neto_centavos: f.monto_neto_cop * 100 } },
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

  // STEP 2: Verificar persistencia en tabla facturas
  const t2 = Date.now();
  onStep({
    name: "2. INSERT en eventos_raw + facturas (tablas de dominio)",
    status: "running",
    payload: { external_id: externalId, relacion_id: ingestPayload.payload.relacion_id },
  });
  await sleep(300);
  const { data: factRows } = await sb
    .from("facturas")
    .select("id, external_id, estado, monto_neto_centavos")
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
  onStep({
    name: "2. INSERT en eventos_raw + facturas (tablas de dominio)",
    status: "ok",
    duration_ms: Date.now() - t2,
    response: factRows[0],
  });

  // STEP 3: Refresh features_par
  const t3 = Date.now();
  onStep({
    name: "3. REFRESH features point-in-time (pg_cron + SQL)",
    status: "running",
    payload: { relacion_id: ingestPayload.payload.relacion_id },
  });
  await sb.rpc("refresh_features_now");
  // pull snapshot post-refresh
  const { data: featuresAfter } = await sb
    .from("features_par")
    .select(
      "ticket_avg_30d,delta_facturacion_30v90,delta_facturacion_30v180,plazo_avg_30d,delta_plazo_30v180,is_pico_cosecha_agro,is_q4"
    )
    .eq("relacion_id", ingestPayload.payload.relacion_id)
    .single();
  onStep({
    name: "3. REFRESH features point-in-time (pg_cron + SQL)",
    status: "ok",
    duration_ms: Date.now() - t3,
    response: featuresAfter,
  });

  // STEP 4: Llamada a Lambda /score
  const t4 = Date.now();
  onStep({
    name: "4. POST /score a AWS Lambda (XGBoost + SHAP)",
    status: "running",
    payload: { relacion_id: ingestPayload.payload.relacion_id, lambda_url: `${LAMBDA_URL}/score` },
  });
  const scoreRes = await fetch(`${LAMBDA_URL}/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ relacion_id: ingestPayload.payload.relacion_id }),
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
  const monto_pot = featuresAfter
    ? Math.floor(Number(featuresAfter.ticket_avg_30d) * 3)
    : 0;
  const { data: signalInserted } = await sb
    .from("signals")
    .insert({
      proveedor_id: f.proveedor_id,
      comprador_id: f.comprador_id,
      factura_id: factRows[0].id,
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
    factura_id: factRows[0].id,
    signal_id: signalInserted?.id,
    score: scoreBody.score,
    razones: scoreBody.razones,
    relacion_id: ingestPayload.payload.relacion_id,
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
