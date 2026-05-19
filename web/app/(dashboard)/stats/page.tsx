import { createServiceClient } from "@/lib/supabase/server";
import { archetypeLabel } from "@/lib/format";
import { TrendingUp, Phone, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const sb = await createServiceClient();
  const { data: signals } = await sb
    .from("signals")
    .select("score, monto_potencial_centavos, proveedor_id");

  const { data: provs } = await sb
    .from("proveedores")
    .select("id, arquetipo");

  const arqMap = new Map((provs ?? []).map((p) => [p.id, p.arquetipo]));
  const items = signals ?? [];

  const total = items.length;
  const top = items.filter((s) => s.score >= 0.6).length;
  const medio = items.filter((s) => s.score >= 0.3 && s.score < 0.6).length;
  const bajo = items.filter((s) => s.score < 0.3).length;

  // Distribucion por arquetipo
  const byArq: Record<string, { n: number; topN: number }> = {};
  for (const s of items) {
    const a = arqMap.get(s.proveedor_id) ?? "desconocido";
    byArq[a] = byArq[a] || { n: 0, topN: 0 };
    byArq[a].n++;
    if (s.score >= 0.6) byArq[a].topN++;
  }

  // Comparativa antes/despues
  const conversionAntes = 0.10;
  const conversionDespues = 0.35;
  const llamadasAntes = 5000;
  const llamadasDespues = top;
  const cerradasAntes = Math.round(llamadasAntes * conversionAntes);
  const cerradasDespues = Math.round(llamadasDespues * conversionDespues);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Impacto del motor</h1>
        <p className="text-sm text-slate-500 mt-1">
          Comparativa estimada con base en los {total} leads scoreados actualmente.
        </p>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 border-l-4 border-l-slate-400">
          <p className="text-xs uppercase text-slate-400 tracking-wide mb-1">Hoy — sin motor</p>
          <h3 className="text-lg font-semibold text-slate-700 mb-4">"Spray and pray"</h3>
          <div className="space-y-3 text-sm">
            <Row icon={<Phone size={14}/>} label="Llamadas necesarias" value={`${llamadasAntes.toLocaleString()}`} />
            <Row icon={<Target size={14}/>} label="Tasa de conversión" value={`~10%`} />
            <Row icon={<TrendingUp size={14}/>} label="Operaciones cerradas" value={`~${cerradasAntes}`} />
          </div>
          <p className="text-xs text-slate-500 mt-4 italic">
            "Cada vez que veo una factura, llamo al cliente. El 90% de las veces no necesitan."
            <br/>— Felipe, EDN
          </p>
        </div>

        <div className="card p-6 border-l-4 border-l-emerald-500">
          <p className="text-xs uppercase text-emerald-600 tracking-wide mb-1">Con motor ML</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Leads priorizados</h3>
          <div className="space-y-3 text-sm">
            <Row icon={<Phone size={14}/>} label="Llamadas dirigidas" value={`${llamadasDespues}`} highlight />
            <Row icon={<Target size={14}/>} label="Tasa de conversión proyectada" value={`~35%`} highlight />
            <Row icon={<TrendingUp size={14}/>} label="Operaciones cerradas estimadas" value={`~${cerradasDespues}`} highlight />
          </div>
          <p className="text-xs text-emerald-700 mt-4 font-medium">
            {Math.round((1 - llamadasDespues / llamadasAntes) * 100)}% menos esfuerzo · {Math.round(cerradasDespues / Math.max(cerradasAntes, 1) * 100) / 100}× operaciones cerradas
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Distribución del score por arquetipo</h2>
        <div className="space-y-3">
          {Object.entries(byArq).sort((a, b) => b[1].n - a[1].n).map(([arq, info]) => (
            <div key={arq} className="flex items-center gap-3">
              <span className="w-44 text-sm">{archetypeLabel(arq)}</span>
              <div className="flex-1 score-bar h-6">
                <div className="absolute inset-y-0 left-0 bg-edn-200" style={{ width: `${(info.n / total) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(info.topN / total) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 w-32 text-right">
                {info.topN}/{info.n} en top (≥60)
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Stat label="Leads scoreados" value={total} />
        <Stat label="Score alto (≥60)" value={top} color="text-emerald-600" />
        <Stat label="Score bajo (<30)" value={bajo} color="text-slate-500" />
      </section>
    </div>
  );
}

function Row({ icon, label, value, highlight }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 inline-flex items-center gap-2">{icon}{label}</span>
      <span className={`font-semibold ${highlight ? "text-emerald-700" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase text-slate-400 tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}
