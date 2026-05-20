// Ejecuta un escenario pre-armado (varias facturas) y devuelve todos los resultados
import { NextRequest, NextResponse } from "next/server";
import { findScenario } from "@/lib/scenarios";
import { runPipeline } from "@/lib/pipeline";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function addDaysIso(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { slug: string } }
) {
  const scenario = findScenario(ctx.params.slug);
  if (!scenario) {
    return NextResponse.json({ error: "scenario not found" }, { status: 404 });
  }

  const sb = await createServiceClient();
  const { data: provs, error } = await sb
    .from("proveedores")
    .select("id, razon_social, arquetipo")
    .ilike("razon_social", `%${scenario.proveedorMatch}%`)
    .limit(1);
  if (error || !provs || provs.length === 0) {
    return NextResponse.json(
      { error: `proveedor no encontrado: ${scenario.proveedorMatch}` },
      { status: 404 }
    );
  }
  const proveedor = provs[0];

  // Score ANTES
  const { data: signalBefore } = await sb
    .from("signals")
    .select("score, razones")
    .eq("proveedor_id", proveedor.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Tomar la primera relacion del proveedor
  const { data: rels } = await sb
    .from("relaciones")
    .select("comprador_id")
    .eq("proveedor_id", proveedor.id)
    .limit(1);
  if (!rels || rels.length === 0) {
    return NextResponse.json({ error: "proveedor sin relaciones" }, { status: 400 });
  }

  // Ejecutar cada evento del scenario
  const runs: any[] = [];
  for (const ev of scenario.events) {
    const fecha = addDaysIso(ev.fecha_offset_dias ?? 0);
    const stepLog: any[] = [];
    const result = await runPipeline(
      {
        proveedor_id: proveedor.id,
        comprador_id: rels[0].comprador_id,
        monto_neto_cop: ev.monto_neto_cop,
        plazo_dias: ev.plazo_dias,
        fecha_emision: fecha,
      },
      (s) => {
        const idx = stepLog.findIndex((x) => x.name === s.name);
        if (idx >= 0) stepLog[idx] = s;
        else stepLog.push(s);
      }
    );
    runs.push({ event: ev, steps: stepLog, result });
    if (ev.delay_ms) await new Promise((r) => setTimeout(r, ev.delay_ms));
  }

  // Score DESPUES
  const { data: signalAfter } = await sb
    .from("signals")
    .select("score, razones")
    .eq("proveedor_id", proveedor.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    scenario,
    proveedor,
    score_before: signalBefore?.score ?? null,
    score_after: signalAfter?.score ?? null,
    razones_after: signalAfter?.razones ?? [],
    runs,
  });
}
