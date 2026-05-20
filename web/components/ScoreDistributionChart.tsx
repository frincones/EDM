"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function ScoreDistribution({ rows }: { rows: any[] }) {
  const data = (rows || []).map((r: any) => ({
    bucket: `${Math.round(Number(r.bucket_lo) * 100)}-${Math.round(Number(r.bucket_hi) * 100)}`,
    count: Number(r.count),
  }));

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        Distribución de scores actuales
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Cuántos pares (proveedor, comprador) en cada rango. Idealmente los altos son pocos
        — es lo que queremos que sea priorizado.
      </p>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
              formatter={(v: any) => [v, "leads"]}
              labelFormatter={(l) => `Score ${l}/100`}
            />
            <Bar dataKey="count" fill="#108fea" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
