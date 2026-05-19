import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCOP, scoreToColor, scoreToBadge, archetypeLabel } from "@/lib/format";
import { ArrowUpRight, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createServiceClient();
  const { data: signals, error } = await supabase
    .from("v_top_leads")
    .select("*")
    .order("score", { ascending: false })
    .limit(200);

  if (error) {
    return <pre className="text-red-600">{JSON.stringify(error, null, 2)}</pre>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads priorizados</h1>
          <p className="text-sm text-slate-500 mt-1">
            {signals?.length ?? 0} pares (proveedor, comprador) scoreados por el motor ML.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="badge-info">
            <Sparkles size={12} /> Modelo XGBoost v1
          </span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Comprador</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3">Arquetipo</th>
              <th className="px-4 py-3 w-32">Score</th>
              <th className="px-4 py-3">Monto potencial</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {signals?.map((s: any, idx: number) => (
              <tr
                key={s.signal_id}
                className={`border-b border-slate-100 hover:bg-edn-50/40 transition-colors ${
                  s.arquetipo_visible ? "bg-edn-50/30" : ""
                }`}
              >
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{s.proveedor_nombre}</div>
                  {s.arquetipo_visible && (
                    <span className="badge-info mt-0.5">⭐ Hero curado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{s.comprador_nombre}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.proveedor_sector}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-700">{archetypeLabel(s.arquetipo)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="score-bar flex-1 max-w-[80px]">
                      <div
                        className={`score-bar-fill ${scoreToColor(s.score)}`}
                        style={{ width: `${s.score * 100}%` }}
                      />
                    </div>
                    <span className={scoreToBadge(s.score)}>{(s.score * 100).toFixed(0)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {formatCOP(s.monto_potencial_centavos)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/leads/${s.signal_id}`}
                    className="text-edn-600 hover:text-edn-800 inline-flex"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Score normalizado 0-100 · Verde ≥75 (alta propensión) · Amarillo 50-74 · Gris &lt;50
      </p>
    </div>
  );
}
