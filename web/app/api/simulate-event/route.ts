// API route: orquesta el pipeline para UN evento de factura
// Recibe el form del simulador, ejecuta los 5 pasos, devuelve resultado completo
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    proveedor_id,
    comprador_id,
    monto_neto_cop,
    plazo_dias,
    fecha_emision,
  } = body;

  if (!proveedor_id || !comprador_id || !monto_neto_cop || !plazo_dias) {
    return NextResponse.json(
      { error: "Faltan campos: proveedor_id, comprador_id, monto_neto_cop, plazo_dias" },
      { status: 400 }
    );
  }

  const steps: any[] = [];
  const result = await runPipeline(
    {
      proveedor_id,
      comprador_id,
      monto_neto_cop: Number(monto_neto_cop),
      plazo_dias: Number(plazo_dias),
      fecha_emision: fecha_emision || new Date().toISOString().slice(0, 10),
    },
    (step) => {
      // Update in-place if step already started, else push
      const idx = steps.findIndex((s) => s.name === step.name);
      if (idx >= 0) {
        steps[idx] = step;
      } else {
        steps.push(step);
      }
    }
  );

  return NextResponse.json({ steps, result });
}
