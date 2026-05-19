import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCOP, scoreToColor, scoreToBadge, archetypeLabel } from "@/lib/format";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, FileText } from "lucide-react";
import { HistoryChart } from "@/components/HistoryChart";
import { CallOutcomeForm } from "@/components/CallOutcomeForm";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const sb = await createServiceClient();

  const { data: signal } = await sb
    .from("v_top_leads")
    .select("*")
    .eq("signal_id", id)
    .single();
  if (!signal) notFound();

  const { data: facturas } = await sb
    .from("facturas")
    .select("fecha_emision, monto_neto_centavos, dias_plazo, estado")
    .eq("proveedor_id", signal.proveedor_id)
    .eq("comprador_id", signal.comprador_id)
    .order("fecha_emision", { ascending: true })
    .limit(500);

  const { data: features } = await sb
    .from("features_par")
    .select("*")
    .eq("proveedor_id", signal.proveedor_id)
    .eq("comprador_id", signal.comprador_id)
    .single();

  const chartData = (facturas ?? []).map((f) => ({
    fecha: f.fecha_emision,
    monto_M: Math.round((f.monto_neto_centavos / 100 / 1_000_000) * 10) / 10,
    plazo: f.dias_plazo,
  }));

  return (
    <div className="space-y-6">
      <Link href="/leads" className="text-sm text-slate-500 hover:text-edn-600 inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Volver a leads
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{signal.proveedor_nombre}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
            <span>vende a</span>
            <span className="font-medium text-slate-800">{signal.comprador_nombre}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs">{signal.proveedor_sector}</span>
            <span className="badge-neutral">{archetypeLabel(signal.arquetipo)}</span>
            {signal.arquetipo_visible && <span className="badge-info">⭐ Hero curado</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-slate-400 tracking-wide">Score del motor</p>
          <p className="text-4xl font-bold text-slate-900">
            {(signal.score * 100).toFixed(0)}
            <span className="text-lg text-slate-400">/100</span>
          </p>
          <div className={`score-bar mt-2 w-48`}>
            <div className={`score-bar-fill ${scoreToColor(signal.score)}`} style={{ width: `${signal.score * 100}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Monto potencial: <span className="font-medium text-slate-700">{formatCOP(signal.monto_potencial_centavos)}</span>
          </p>
        </div>
      </header>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-edn-600" /> Razones del score (SHAP)
        </h2>
        <div className="space-y-3">
          {(signal.razones || []).map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`mt-0.5 ${r.contribution > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {r.contribution > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{r.label}</p>
                <p className="text-xs text-slate-500">
                  Contribución al score: <span className={r.contribution > 0 ? "text-emerald-600" : "text-rose-500"}>
                    {r.contribution > 0 ? "+" : ""}{(r.contribution * 100).toFixed(1)} pts
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-edn-600" /> Histórico facturación
          </h2>
          <HistoryChart data={chartData} metric="monto_M" label="Monto neto (M COP)" color="#108fea" />
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-edn-600" /> Histórico plazos
          </h2>
          <HistoryChart data={chartData} metric="plazo" label="Días plazo" color="#f59e0b" />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Features actuales (snapshot)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {features && Object.entries(features as any)
            .filter(([k]) => !["relacion_id", "proveedor_id", "comprador_id", "snapshot_at"].includes(k))
            .slice(0, 16)
            .map(([k, v]) => (
              <div key={k} className="border border-slate-100 rounded p-2">
                <p className="text-xs text-slate-500 truncate">{k}</p>
                <p className="font-medium text-slate-800 text-sm">{formatFeature(k, v)}</p>
              </div>
            ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Registrar resultado de llamada</h2>
        <CallOutcomeForm signalId={signal.signal_id} proveedorId={signal.proveedor_id} />
        {signal.ultimo_outcome && (
          <p className="text-xs text-slate-500 mt-3">
            Último resultado: <span className="font-medium">{signal.ultimo_outcome}</span>
          </p>
        )}
      </section>
    </div>
  );
}

function formatFeature(key: string, value: any): string {
  if (value == null) return "—";
  const n = Number(value);
  if (isNaN(n)) return String(value);
  if (key.includes("centavos") || key.startsWith("ticket")) {
    return formatCOP(n);
  }
  if (key.startsWith("delta") || key.startsWith("ratio") || key.startsWith("tasa") || key.startsWith("comprador_estac")) {
    return n.toFixed(3);
  }
  if (key.includes("dias") || key.includes("plazo") || key.startsWith("n_") || key === "mes_actual") {
    return Math.round(n).toString();
  }
  return n.toFixed(2);
}
