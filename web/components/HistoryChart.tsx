"use client";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function HistoryChart({
  data,
  metric,
  label,
  color,
}: {
  data: { fecha: string; [k: string]: any }[];
  metric: string;
  label: string;
  color: string;
}) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => v?.slice(5, 10)}
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
            labelFormatter={(v) => `Fecha: ${v}`}
            formatter={(v: any) => [`${v} ${label.split(" ")[0]}`, label]}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
