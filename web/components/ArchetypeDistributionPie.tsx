"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { archetypeLabel } from "@/lib/format";

const COLORS = ["#94a3b8", "#10b981", "#f59e0b", "#22c55e", "#108fea"];

export function ArchetypeDistribution({ rows }: { rows: any[] }) {
  const data = (rows || []).map((r: any) => ({
    name: archetypeLabel(r.arquetipo),
    value: Number(r.n_proveedores),
    topN: Number(r.n_signals_top),
  }));

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        Distribución de arquetipos
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Cuántos proveedores hay de cada arquetipo en el universo. Refleja la
        distribución que diseñamos según las señales que Felipe identificó.
      </p>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius={80}
              label={(d) => `${d.value}`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: any, _n, p: any) => [
                `${v} proveedores (${p.payload.topN} en top)`,
                p.payload.name,
              ]}
            />
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              iconSize={10}
              formatter={(v: any) => <span style={{ fontSize: 11 }}>{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
