"use client";
import { formatCOP, scoreToColor } from "@/lib/format";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function BeforeAfter({
  scoreBefore,
  scoreAfter,
  proveedorNombre,
  razonesAfter,
}: {
  scoreBefore: number | null;
  scoreAfter: number | null;
  proveedorNombre: string;
  razonesAfter?: any[];
}) {
  if (scoreBefore == null || scoreAfter == null) return null;

  const delta = scoreAfter - scoreBefore;
  const trend =
    Math.abs(delta) < 0.02 ? "flat" : delta > 0 ? "up" : "down";

  return (
    <div className="card p-6 border-l-4 border-l-edn-500">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">
        Cambio en el score de {proveedorNombre}
      </h3>

      <div className="grid grid-cols-3 items-center gap-4 mb-5">
        <ScoreBox label="Antes" score={scoreBefore} />
        <div className="flex justify-center">
          {trend === "up" && <TrendingUp size={28} className="text-emerald-600" />}
          {trend === "down" && <TrendingDown size={28} className="text-rose-600" />}
          {trend === "flat" && <Minus size={28} className="text-slate-400" />}
        </div>
        <ScoreBox label="Ahora" score={scoreAfter} highlight />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs uppercase text-slate-500 mb-2">Cambio</p>
        <p
          className={`text-xl font-bold ${
            trend === "up"
              ? "text-emerald-700"
              : trend === "down"
              ? "text-rose-700"
              : "text-slate-700"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {(delta * 100).toFixed(1)} puntos
        </p>
      </div>

      {razonesAfter && razonesAfter.length > 0 && (
        <div className="border-t border-slate-200 pt-4 mt-4">
          <p className="text-xs uppercase text-slate-500 mb-2">
            Razones del nuevo score
          </p>
          <ul className="text-sm text-slate-700 space-y-1">
            {razonesAfter.slice(0, 3).map((r: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={
                    r.contribution > 0 ? "text-emerald-600" : "text-rose-500"
                  }
                >
                  {r.contribution > 0 ? "↑" : "↓"}
                </span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreBox({
  label,
  score,
  highlight,
}: {
  label: string;
  score: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "p-4 bg-edn-50 rounded-md" : "p-4"}>
      <p className="text-xs uppercase text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">
        {(score * 100).toFixed(0)}
        <span className="text-base text-slate-400">/100</span>
      </p>
      <div className="score-bar mt-2">
        <div
          className={`score-bar-fill ${scoreToColor(score)}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}
