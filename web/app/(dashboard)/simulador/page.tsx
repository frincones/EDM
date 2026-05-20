"use client";
import { useEffect, useState } from "react";
import { Beaker, Send, RefreshCw, Sparkles } from "lucide-react";
import { SCENARIOS } from "@/lib/scenarios";
import { PipelineSteps, type Step } from "@/components/PipelineSteps";
import { BeforeAfter } from "@/components/BeforeAfter";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SimuladorPage() {
  const sb = createClient();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [compradores, setCompradores] = useState<any[]>([]);
  const [provId, setProvId] = useState("");
  const [compId, setCompId] = useState("");
  const [monto, setMonto] = useState("15000000");
  const [plazo, setPlazo] = useState("30");
  const [fecha, setFecha] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [scenarioResult, setScenarioResult] = useState<any | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: pr } = await sb
        .from("proveedores")
        .select("id, razon_social, sector_nombre, arquetipo, arquetipo_visible")
        .order("arquetipo_visible", { ascending: false })
        .order("razon_social");
      const { data: cp } = await sb
        .from("compradores")
        .select("id, razon_social");
      if (pr) setProveedores(pr);
      if (cp) setCompradores(cp);
    })();
  }, []);

  async function submitFactura() {
    if (!provId || !compId) {
      alert("Selecciona proveedor y comprador");
      return;
    }
    setSteps([]);
    setResult(null);
    setScenarioResult(null);
    setActiveScenario(null);
    setRunning(true);

    try {
      const res = await fetch("/api/simulate-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proveedor_id: provId,
          comprador_id: compId,
          monto_neto_cop: Number(monto),
          plazo_dias: Number(plazo),
          fecha_emision: fecha,
        }),
      });
      const data = await res.json();
      setSteps(data.steps || []);
      setResult(data.result);
    } catch (e: any) {
      setSteps((s) => [
        ...s,
        { name: "Error", status: "error", error: e.message },
      ]);
    } finally {
      setRunning(false);
    }
  }

  async function runScenario(slug: string) {
    setSteps([]);
    setResult(null);
    setScenarioResult(null);
    setActiveScenario(slug);
    setRunning(true);

    try {
      const res = await fetch(`/api/scenarios/${slug}`, { method: "POST" });
      const data = await res.json();
      if (data.runs && data.runs.length > 0) {
        // Mostrar pasos del ULTIMO run (el final del escenario)
        setSteps(data.runs[data.runs.length - 1].steps);
        setResult(data.runs[data.runs.length - 1].result);
      }
      setScenarioResult(data);
    } catch (e: any) {
      setSteps([{ name: "Error", status: "error", error: e.message }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Beaker className="text-edn-600" /> Simulador en vivo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inyectá una factura al sistema y mirá cómo el pipeline procesa, el
            modelo scorea y aparece como señal en{" "}
            <Link href="/feed" className="text-edn-600 hover:underline">
              /feed
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Manual form */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Send size={16} className="text-edn-600" /> Crear factura manual
          </h2>
          <div className="space-y-3">
            <Field label="Proveedor">
              <select
                value={provId}
                onChange={(e) => setProvId(e.target.value)}
                className="select"
              >
                <option value="">— elegir —</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.arquetipo_visible ? "⭐ " : ""}
                    {p.razon_social} ({p.arquetipo})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comprador">
              <select
                value={compId}
                onChange={(e) => setCompId(e.target.value)}
                className="select"
              >
                <option value="">— elegir —</option>
                {compradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto neto (COP)">
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Plazo (días)">
                <input
                  type="number"
                  value={plazo}
                  onChange={(e) => setPlazo(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Fecha emisión">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input"
              />
            </Field>
            <button
              onClick={submitFactura}
              disabled={running}
              className="btn-primary w-full disabled:opacity-50"
            >
              {running ? "Procesando..." : "Enviar al pipeline"}
            </button>
          </div>
        </div>

        {/* Scenarios */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-edn-600" /> O elegí un escenario
            pre-armado
          </h2>
          <div className="space-y-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.slug}
                onClick={() => runScenario(s.slug)}
                disabled={running}
                className={`w-full text-left p-3 rounded-md border transition-colors disabled:opacity-50 ${
                  activeScenario === s.slug
                    ? "border-edn-400 bg-edn-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{s.emoji}</span>
                  <span className="font-medium text-slate-900">{s.title}</span>
                </div>
                <p className="text-xs text-slate-500">{s.description}</p>
                <p className="text-xs text-edn-700 mt-1 italic">
                  Esperado: {s.expected}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline steps */}
      {steps.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <RefreshCw size={16} className={running ? "animate-spin" : ""} />
            Pipeline en ejecución
          </h2>
          <PipelineSteps steps={steps} />
        </div>
      )}

      {/* Final result + Before/After */}
      {scenarioResult && (
        <BeforeAfter
          scoreBefore={scenarioResult.score_before}
          scoreAfter={scenarioResult.score_after}
          proveedorNombre={scenarioResult.proveedor.razon_social}
          razonesAfter={scenarioResult.razones_after}
        />
      )}

      {result && !scenarioResult && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Resultado final
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase text-slate-500">Score generado</p>
              <p className="text-2xl font-bold">
                {(result.score * 100).toFixed(0)}/100
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Tiempo total</p>
              <p className="text-2xl font-bold">{result.total_ms}ms</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Signal id</p>
              <p className="text-xs font-mono text-slate-700 break-all">
                {result.signal_id}
              </p>
            </div>
          </div>
          {result.razones && (
            <div className="mt-4">
              <p className="text-xs uppercase text-slate-500 mb-2">
                Razones (SHAP)
              </p>
              <ul className="text-sm space-y-1">
                {result.razones.map((r: any, i: number) => (
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
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
