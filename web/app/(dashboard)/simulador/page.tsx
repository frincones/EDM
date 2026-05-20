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

  if (pErr || cErr) {
    return (
      <pre className="text-rose-600">
        Error al cargar maestros:{" "}
        {JSON.stringify(pErr || cErr, null, 2)}
      </pre>
    );
  }

  return (
    <SimuladorClient
      proveedores={(proveedores || []) as any}
      compradores={(compradores || []) as any}
    />
  );
}
