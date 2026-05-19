// =============================================================================
// Supabase Edge Function: /ingest
// =============================================================================
// Punto de entrada UNICO para eventos de EDN (outbox + webhook pattern).
//
// En producción: EDN POST eventos a esta URL desde su outbox.
// En el demo: backfill_via_ingest.py simula EDN postear los eventos.
//
// Contrato:
//   POST /functions/v1/ingest
//   Headers:
//     - Authorization: Bearer <publishable_key>
//     - X-EDN-Signature: hex HMAC-SHA256 sobre el body (opcional para demo)
//   Body:
//     {
//       "event_id": "uuid",
//       "event_type": "factura_emitida" | ...,
//       "occurred_at": "ISO8601",
//       "payload": { ... }
//     }
// =============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("EDN_WEBHOOK_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EVENT_TYPES = new Set([
  "orden_compra_creada",
  "factura_emitida",
  "nota_recepcion_registrada",
  "factura_aceptada",
  "pago_recibido",
  "oferta_factoring_emitida",
  "oferta_factoring_outcome",
]);

async function verifyHmac(body: string, signature: string | null): Promise<boolean> {
  if (!HMAC_SECRET) return true; // dev mode
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expected;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function persistDomain(eventType: string, payload: any): Promise<void> {
  switch (eventType) {
    case "orden_compra_creada":
      await sb.from("ordenes_compra").upsert({
        external_id: payload.external_id,
        relacion_id: payload.relacion_id,
        proveedor_id: payload.proveedor_id,
        comprador_id: payload.comprador_id,
        monto_centavos: payload.monto_centavos,
        moneda: payload.moneda ?? "COP",
        fecha_emision: payload.fecha_emision,
      }, { onConflict: "external_id" });
      break;

    case "factura_emitida":
      await sb.from("facturas").upsert({
        external_id: payload.external_id,
        cufe: payload.cufe,
        orden_compra_id: payload.orden_compra_id,
        relacion_id: payload.relacion_id,
        proveedor_id: payload.proveedor_id,
        comprador_id: payload.comprador_id,
        monto_bruto_centavos: payload.monto_bruto_centavos,
        impuestos_centavos: payload.impuestos_centavos,
        monto_neto_centavos: payload.monto_neto_centavos,
        moneda: payload.moneda ?? "COP",
        fecha_emision: payload.fecha_emision,
        fecha_vencimiento: payload.fecha_vencimiento,
        estado: "emitida",
      }, { onConflict: "external_id" });
      break;

    case "nota_recepcion_registrada":
      await sb.from("notas_recepcion").insert({
        factura_id: payload.factura_id,
        fecha_recepcion: payload.fecha_recepcion,
      });
      await sb.from("facturas").update({ estado: "recibida" })
        .eq("id", payload.factura_id);
      break;

    case "factura_aceptada":
      await sb.from("aceptaciones").insert({
        factura_id: payload.factura_id,
        fecha_aceptacion: payload.fecha_aceptacion,
        dias_a_aceptar: payload.dias_a_aceptar,
      });
      await sb.from("facturas").update({ estado: "aceptada" })
        .eq("id", payload.factura_id);
      break;

    case "pago_recibido":
      await sb.from("pagos").insert({
        factura_id: payload.factura_id,
        monto_centavos: payload.monto_centavos,
        fecha_pago: payload.fecha_pago,
        dias_vs_vencimiento: payload.dias_vs_vencimiento,
      });
      await sb.from("facturas").update({ estado: "pagada" })
        .eq("id", payload.factura_id);
      break;

    case "oferta_factoring_emitida":
      await sb.from("outcomes_factoring").upsert({
        external_id: payload.external_id,
        proveedor_id: payload.proveedor_id,
        comprador_id: payload.comprador_id,
        factura_id: payload.factura_id,
        fecha_oferta: payload.fecha_oferta,
        outcome: "pendiente",
        monto_ofertado_centavos: payload.monto_ofertado_centavos,
        tasa_ofertada: payload.tasa_ofertada,
      }, { onConflict: "external_id" });
      break;

    case "oferta_factoring_outcome":
      await sb.from("outcomes_factoring").update({
        outcome: payload.outcome,
        fecha_decision: payload.fecha_decision,
      }).eq("external_id", payload.external_id);
      break;

    default:
      throw new Error(`event_type no manejado: ${eventType}`);
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const bodyText = await req.text();
  const signature = req.headers.get("x-edn-signature");
  const isValid = await verifyHmac(bodyText, signature);
  if (!isValid) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  let evt: any;
  try {
    evt = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!evt.event_id || !evt.event_type || !evt.payload) {
    return jsonResponse({ error: "missing_required_fields" }, 400);
  }
  if (!EVENT_TYPES.has(evt.event_type)) {
    return jsonResponse({ error: "unknown_event_type", got: evt.event_type }, 400);
  }

  // 1) Persistir RAW (idempotente por event_id)
  const { error: rawErr } = await sb.from("eventos_raw").upsert({
    event_id: evt.event_id,
    event_type: evt.event_type,
    payload: evt.payload,
    source: evt.source ?? "edn_webhook",
    processed_at: new Date().toISOString(),
  }, { onConflict: "event_id" });

  if (rawErr) {
    return jsonResponse({ error: "raw_insert_failed", detail: rawErr.message }, 500);
  }

  // 2) Persistir capa de dominio
  try {
    await persistDomain(evt.event_type, evt.payload);
  } catch (e) {
    return jsonResponse({
      error: "domain_persist_failed",
      detail: (e as Error).message,
    }, 500);
  }

  return jsonResponse({ status: "accepted", event_id: evt.event_id }, 202);
});
