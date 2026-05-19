"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export async function recordCallOutcome(input: {
  signalId: string;
  proveedorId: string;
  outcome: string;
  montoCerrado?: number | null;
  notas?: string | null;
}) {
  const sb = await createServiceClient();
  const { error } = await sb.from("call_outcomes").insert({
    signal_id: input.signalId,
    proveedor_id: input.proveedorId,
    outcome: input.outcome,
    monto_cerrado_centavos: input.montoCerrado,
    notas: input.notas,
  });
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath(`/leads/${input.signalId}`);
  return { ok: true };
}
