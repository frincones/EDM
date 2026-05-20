"use client";
import { Activity } from "lucide-react";

export function SHAPWaterfall({
  score,
  razones,
}: {
  score: number;
  razones: Array<{
    feature: string;
    value: number;
    contribution: number;
    label: string;
  }>;
}) {
  // base value = score - sum of all contributions (approximation)
  const sumContrib = razones.reduce((acc, r) => acc + (r.contribution || 0), 0);
  const baseValue = score - sumContrib;

  // Sort by absolute contribution descending
  const sorted = [...razones].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  const maxAbs = Math.max(
    ...sorted.map((r) => Math.abs(r.contribution)),
    Math.abs(baseValue),
    0.1
  );

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Activity size={16} className="text-edn-600" />
        Composición del score (SHAP)
      </h2>

      <div className="space-y-2">
        <RowLabel
          label="Punto de partida (modelo)"
          value={baseValue}
          maxAbs={maxAbs}
          color="bg-slate-400"
          dim
        />
        {sorted.map((r, i) => (
          <RowLabel
            key={i}
            label={r.label}
            value={r.contribution}
            maxAbs={maxAbs}
            color={r.contribution > 0 ? "bg-emerald-500" : "bg-rose-500"}
          />
        ))}
        <div className="border-t border-slate-200 pt-2">
          <RowLabel
            label={`= Score final ${(score * 100).toFixed(0)}/100`}
            value={score}
            maxAbs={maxAbs}
            color="bg-edn-600"
            highlight
          />
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4 italic">
        Cada barra muestra cuánto suma o resta esa razón al score base del modelo. Las barras verdes empujan hacia ofrecer factoring; las rojas hacia no.
      </p>
    </div>
  );
}

function RowLabel({
  label,
  value,
  maxAbs,
  color,
  dim,
  highlight,
}: {
  label: string;
  value: number;
  maxAbs: number;
  color: string;
  dim?: boolean;
  highlight?: boolean;
}) {
  const pctWidth = Math.max(2, (Math.abs(value) / maxAbs) * 100);
  return (
    <div className={`grid grid-cols-12 gap-2 items-center text-xs ${dim ? "opacity-70" : ""}`}>
      <span
        className={`col-span-6 ${highlight ? "font-semibold text-slate-900" : "text-slate-700"} truncate`}
        title={label}
      >
        {label}
      </span>
      <div className="col-span-5 relative h-4 bg-slate-50 rounded overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${color} rounded`} style={{ width: `${pctWidth}%` }} />
      </div>
      <span
        className={`col-span-1 text-right font-mono ${
          value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-slate-500"
        }`}
      >
        {value > 0 ? "+" : ""}
        {(value * 100).toFixed(0)}
      </span>
    </div>
  );
}
