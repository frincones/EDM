"use client";
import { FileText } from "lucide-react";
import { formatCOP } from "@/lib/format";

export function FacturaContributions({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm text-slate-500">Sin facturas relevantes para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <FileText size={16} className="text-edn-600" />
        Facturas que más pesaron en la señal
      </h2>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase">
          <tr className="border-b border-slate-200">
            <th className="py-2 text-left">Fecha</th>
            <th className="py-2 text-right">Monto neto</th>
            <th className="py-2 text-right">Plazo</th>
            <th className="py-2 text-right">vs promedio histórico</th>
            <th className="py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = Number(r.monto_pct_vs_media) * 100;
            return (
              <tr key={r.factura_id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-slate-700">{r.fecha_emision}</td>
                <td className="py-2 text-right font-medium">{formatCOP(r.monto_neto_centavos)}</td>
                <td className="py-2 text-right text-slate-700">{r.dias_plazo} días</td>
                <td
                  className={`py-2 text-right font-medium ${
                    pct > 0 ? "text-emerald-700" : pct < -10 ? "text-rose-700" : "text-slate-600"
                  }`}
                >
                  {pct > 0 ? "+" : ""}
                  {pct.toFixed(0)}%
                </td>
                <td className="py-2">
                  <span className="badge-neutral capitalize">{r.estado}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3 italic">
        Comparativa contra el monto promedio histórico de esta relación (excluye facturas del último mes).
      </p>
    </div>
  );
}
