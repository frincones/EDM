"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCOP, scoreToColor, scoreToBadge, archetypeLabel } from "@/lib/format";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";

export function LeadsTable({ signals }: { signals: any[] }) {
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(0);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (s.score < minScore) return false;
      if (!q) return true;
      const hay = `${s.proveedor_nombre} ${s.comprador_nombre} ${s.proveedor_sector} ${s.arquetipo}`.toLowerCase();
      return hay.includes(q);
    });
  }, [signals, q, minScore]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads priorizados</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filtered.length} de {signals.length} pares (proveedor, comprador) — filtrá o buscá.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="badge-info">
            <Sparkles size={12} /> Modelo XGBoost v1
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <SearchBar
            placeholder="Buscar por proveedor, comprador, sector o arquetipo..."
            onSearch={setQ}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Score mínimo: {(minScore * 100).toFixed(0)}</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore * 100}
            onChange={(e) => setMinScore(Number(e.target.value) / 100)}
            className="w-full"
          />
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
              <th className="px-4 py-3" title="Volumen proyectado de factoring = ticket promedio últimos 30 días × 3">Volumen proy.</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: any, idx: number) => (
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                  Sin resultados para "{q}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Score normalizado 0-100 · Verde ≥75 · Amarillo 50-74 · Gris &lt;50
      </p>
    </div>
  );
}
