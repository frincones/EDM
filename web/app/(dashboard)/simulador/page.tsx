import { createServiceClient } from "@/lib/supabase/server";
import { SimuladorClient } from "./SimuladorClient";

export const dynamic = "force-dynamic";

export default async function SimuladorPage() {
  const sb = await createServiceClient();

  const { data: proveedores, error: pErr } = await sb
    .from("proveedores")
    .select("id, razon_social, arquetipo, arquetipo_visible")
    .order("arquetipo_visible", { ascending: false })
    .order("razon_social");

  const { data: compradores, error: cErr } = await sb
    .from("compradores")
    .select("id, razon_social")
    .order("razon_social");

  const { data: relaciones, error: rErr } = await sb
    .from("relaciones")
    .select("id, proveedor_id, comprador_id")
    .eq("status", "activa");

  if (pErr || cErr || rErr) {
    return (
      <pre className="text-rose-600">
        Error al cargar maestros:{" "}
        {JSON.stringify(pErr || cErr || rErr, null, 2)}
      </pre>
    );
  }

  return (
    <SimuladorClient
      proveedores={(proveedores || []) as any}
      compradores={(compradores || []) as any}
      relaciones={(relaciones || []) as any}
    />
  );
}
