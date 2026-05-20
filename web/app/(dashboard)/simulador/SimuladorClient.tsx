"use client";
import { useState } from "react";
import { Beaker, Send, RefreshCw, Sparkles } from "lucide-react";
import { SCENARIOS } from "@/lib/scenarios";
import { PipelineSteps, type Step } from "@/components/PipelineSteps";
import { BeforeAfter } from "@/components/BeforeAfter";
import Link from "next/link";

type Proveedor = {
  id: string;
  razon_social: string;
  arquetipo: string;
  arquetipo_visible: boolean;
};
type Comprador = { id: string; razon_social: string };

export function SimuladorClient({
  proveedores,
  compradores,
}: {
  proveedores: Proveedor[];
  compradores: Comprador[];
}) {
  // Pre-seleccionar el primer hero como proveedor y primer comprador
  const heroDefault = proveedores.find((p) => p.arquetipo_visible);
  const [provId, setProvId] = useState(heroDefault?.id || proveedores[0]?.id || "");
  const [compId, setCompId] = useState(compradores[0]?.id || "");
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
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submitFactura() {
    if (!provId || !compId) {
      setErrMsg("Seleccioná proveedor y comprador");
      return;
    }
    setErrMsg(null);
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
      if (!res.ok) {
        setErrMsg(data.error || `HTTP ${res.status}`);
      }
      setSteps(data.steps || []);
      setResult(data.result);
    } catch (e: any) {
      setErrMsg(e.message);
      setSteps((s) => [
        ...s,
        { name: "Error de red", status: "error", error: e.message },
      ]);
    } finally {
      setRunning(false);
    }
  }

  async function runScenario(slug: string) {
    setErrMsg(null);
    setSteps([]);
    setResult(null);
    setScenarioResult(null);
    setActiveScenario(slug);
    setRunning(true);

    try {
      const res = await fetch(`/api/scenarios/${slug}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || `HTTP ${res.status}`);
        return;
      }
      if (data.runs && data.runs.length > 0) {
        setSteps(data.runs[data.runs.length - 1].steps);
        setResult(data.runs[data.runs.length - 1].result);
      }
      setScenarioResult(data);
    } catch (e: any) {
      setErrMsg(e.message);
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
            .{" "}
            <span className="text-slate-400">
              ({proveedores.length} proveedores · {compradores.length} compradores
              cargados)
            </span>
          </p>
        </div>
      </div>

      {errMsg && (
        <div className="card p-3 bg-rose-50 border-rose-300 border text-sm text-rose-800">
          {errMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Manual form */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Send size={16} className="text-edn-600" /> Crear factura manual
          </h2>
          <div className="space-y-3">
            <Field label={`Proveedor (${proveedores.length} disponibles)`}>
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
            <Field label={`Comprador (${compradores.length} disponibles)`}>
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
