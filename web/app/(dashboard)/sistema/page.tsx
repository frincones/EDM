import { createServiceClient } from "@/lib/supabase/server";
import { Server, Database, Cloud, Globe } from "lucide-react";
import { SystemHealth } from "./SystemHealth";

export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const sb = await createServiceClient();

  const { data: counts } = await sb.rpc("system_counts");
  const { data: lastEvents } = await sb
    .from("eventos_raw")
    .select("event_id, event_type, source, received_at")
    .order("received_at", { ascending: false })
    .limit(15);
  const { data: lastSignals } = await sb
    .from("signals")
    .select("id, score, model_version, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Server className="text-edn-600" /> Estado del sistema
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Salud de cada componente + eventos recientes. Si una pieza falla, se nota acá.
        </p>
      </div>

      <SystemHealth />

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Database size={16} className="text-edn-600" /> Tablas
          </h2>
          <div className="space-y-1.5 text-sm">
            {counts &&
              Object.entries(counts)
                .filter(([k]) => k !== "now")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-mono text-slate-900">{String(v)}</span>
                  </div>
                ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Snapshot: {counts?.now ? new Date(counts.now).toLocaleString("es-CO") : "-"}
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Cloud size={16} className="text-edn-600" /> Eventos recientes (ingesta)
          </h2>
          <div className="space-y-1 text-xs font-mono max-h-72 overflow-y-auto">
            {(lastEvents || []).map((e) => (
              <div key={e.event_id} className="flex items-center gap-2 border-b border-slate-100 pb-1">
                <span className="text-slate-400 text-[10px]">
                  {new Date(e.received_at).toLocaleTimeString("es-CO")}
                </span>
                <span className="text-edn-700 truncate">{e.event_type}</span>
                <span className="text-slate-400 ml-auto text-[10px]">{e.source}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Globe size={16} className="text-edn-600" /> Últimos scores generados
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left">Fecha</th>
              <th className="py-2 text-left">Signal ID</th>
              <th className="py-2 text-left">Versión modelo</th>
              <th className="py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {(lastSignals || []).map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-slate-600 text-xs">
                  {new Date(s.created_at).toLocaleString("es-CO")}
                </td>
                <td className="py-2 font-mono text-xs">{s.id.slice(0, 8)}...</td>
                <td className="py-2 text-slate-600">{s.model_version}</td>
                <td className="py-2 text-right font-medium">{(Number(s.score) * 100).toFixed(0)}/100</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-6 bg-slate-50/50">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">URLs del sistema</h2>
        <ul className="text-xs space-y-2 font-mono">
          <li>
            <span className="text-slate-500">Edge Function /ingest:</span>{" "}
            <a
              href={process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/ingest"}
              target="_blank"
              className="text-edn-600 break-all"
              rel="noopener noreferrer"
            >
              {process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest
            </a>
          </li>
          <li>
            <span className="text-slate-500">AWS Lambda /score:</span>{" "}
            <a
              href="https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws/health"
              target="_blank"
              className="text-edn-600 break-all"
              rel="noopener noreferrer"
            >
              https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws
            </a>
          </li>
          <li>
            <span className="text-slate-500">Repo GitHub:</span>{" "}
            <a
              href="https://github.com/frincones/EDM"
              target="_blank"
              className="text-edn-600"
              rel="noopener noreferrer"
            >
              github.com/frincones/EDM
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
