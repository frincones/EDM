"use client";
import { useEffect, useMemo, useState } from "react";
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
type Relacion = { id: string; proveedor_id: string; comprador_id: string };

export function SimuladorClient({
  proveedores,
  compradores,
  relaciones,
}: {
  proveedores: Proveedor[];
  compradores: Comprador[];
  relaciones: Relacion[];
}) {
  // Filter only proveedores that have at least one relación (otherwise nothing to simulate)
  const provsValidos = useMemo(() => {
    const withRels = new Set(relaciones.map((r) => r.proveedor_id));
    return proveedores.filter((p) => withRels.has(p.id));
  }, [proveedores, relaciones]);

  const heroDefault = provsValidos.find((p) => p.arquetipo_visible);
  const [provId, setProvId] = useState(heroDefault?.id || provsValidos[0]?.id || "");

  // Compradores VALIDOS = los que tienen relación con el proveedor seleccionado
  const compradoresValidos = useMemo(() => {
    if (!provId) return [];
    const validIds = new Set(
      relaciones.filter((r) => r.proveedor_id === provId).map((r) => r.comprador_id)
    );
    return compradores.filter((c) => validIds.has(c.id));
  }, [provId, relaciones, compradores]);

  const [compId, setCompId] = useState("");

  // Cada vez que cambia el proveedor, auto-seleccionar primer comprador válido
  useEffect(() => {
    if (compradoresValidos.length > 0) {
      // si el compId actual no es válido, resetear
      const stillValid = compradoresValidos.some((c) => c.id === compId);
      if (!stillValid) {
        setCompId(compradoresValidos[0].id);
      }
    } else {
      setCompId("");
    }
  }, [compradoresValidos, compId]);

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

  const selectedProveedor = provsValidos.find((p) => p.id === provId);

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
              ({provsValidos.length} proveedores · {relaciones.length} relaciones activas)
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
            <Field label={`Proveedor (${provsValidos.length} con relaciones)`}>
              <select
                value={provId}
                onChange={(e) => setProvId(e.target.value)}
                className="select"
              >
                {provsValidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.arquetipo_visible ? "⭐ " : ""}
                    {p.razon_social} ({p.arquetipo})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={`Comprador (${compradoresValidos.length} disponible${
                compradoresValidos.length !== 1 ? "s" : ""
              } para ${selectedProveedor?.razon_social || "este proveedor"})`}
            >
              <select
                value={compId}
                onChange={(e) => setCompId(e.target.value)}
                className="select"
              >
                {compradoresValidos.length === 0 && (
                  <option value="">— sin relaciones activas —</option>
                )}
                {compradoresValidos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social}
                  </option>
                ))}
              </select>
              {compradoresValidos.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Este proveedor no tiene relaciones activas en el ecosistema.
                </p>
              )}
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
              disabled={running || compradoresValidos.length === 0}
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
        <div className="space-y-4">
          {/* Resumen ejecutivo */}
          <div className="card p-6 border-l-4 border-l-edn-500 bg-edn-50/30">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Resultado del pipeline
            </h2>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-slate-500">Score generado</p>
                <p className="text-3xl font-bold text-slate-900">
                  {(result.score * 100).toFixed(0)}
                  <span className="text-base text-slate-400">/100</span>
                </p>
                {result.score_before != null && (
                  <p className="text-xs text-slate-500 mt-1">
                    antes: {(result.score_before * 100).toFixed(0)} (Δ{" "}
                    {result.score > result.score_before ? "+" : ""}
                    {((result.score - result.score_before) * 100).toFixed(1)})
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Tiempo total</p>
                <p className="text-3xl font-bold text-slate-900">{result.total_ms}ms</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Factura ID</p>
                <p className="text-xs font-mono text-slate-700 break-all">
                  {result.factura_persisted?.external_id}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Signal ID</p>
                <p className="text-xs font-mono text-slate-700 break-all">
                  {result.signal_id?.slice(0, 8)}…
                </p>
              </div>
            </div>
          </div>

          {/* Lo que se persistió: AMOUNT TRANSPARENCY */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              💰 La factura que ingresó al sistema
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Este es el registro EXACTO que quedó en la base de datos tras tu ingesta.
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <FactItem
                label="Monto neto (lo que ingresaste)"
                value={formatPesos(result.factura_persisted?.monto_neto_pesos)}
                highlight
              />
              <FactItem
                label="IVA 19%"
                value={formatPesos(result.factura_persisted?.impuestos_pesos)}
              />
              <FactItem
                label="Monto bruto total"
                value={formatPesos(result.factura_persisted?.monto_bruto_pesos)}
              />
              <FactItem
                label="Fecha emisión"
                value={result.factura_persisted?.fecha_emision}
              />
              <FactItem
                label="Fecha vencimiento"
                value={result.factura_persisted?.fecha_vencimiento}
              />
              <FactItem
                label="Plazo"
                value={`${result.factura_persisted?.dias_plazo} días`}
              />
            </div>
          </div>

          {/* Cómo CAMBIARON las features tras tu inyección */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              📊 Cómo cambiaron las features de este par (proveedor, comprador)
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              El motor recalculó esto en tiempo real (paso 3 del pipeline). Es la
              evidencia de que TU factura fue procesada.
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <DeltaRow
                label="Ticket promedio últimos 30 días"
                before={formatPesos(result.features_change?.ticket_avg_30d_before_pesos)}
                after={formatPesos(result.features_change?.ticket_avg_30d_after_pesos)}
                deltaPct={result.features_change?.delta_pct}
              />
              <DeltaRow
                label="Δ facturación 30d vs 6 meses"
                before={`${(
                  (result.features_change?.delta_facturacion_30v180_before || 0) *
                  100
                ).toFixed(1)}%`}
                after={`${(
                  (result.features_change?.delta_facturacion_30v180_after || 0) *
                  100
                ).toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Por qué ese score (SHAP) */}
          {result.razones && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                🧠 Razones del modelo (SHAP del Lambda XGBoost)
              </h2>
              <ul className="text-sm space-y-2">
                {result.razones.map((r: any, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 ${
                        r.contribution > 0 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {r.contribution > 0 ? "↑" : "↓"}
                    </span>
                    <div className="flex-1">
                      <span>{r.label}</span>{" "}
                      <span
                        className={`text-xs font-mono ${
                          r.contribution > 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        ({r.contribution > 0 ? "+" : ""}
                        {r.contribution?.toFixed(2)})
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nota sobre monto factoring estimado */}
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3">
            <strong>Sobre el "monto potencial" que ves en /feed:</strong> es una
            estimación del volumen de factoring proyectado (= ticket promedio 30d ×
            3). Es distinto al monto neto de la factura que ingresaste — ese ya quedó
            persistido tal cual lo escribiste.
            <br />
            En este caso: monto factoring estimado ={" "}
            {formatPesos(result.monto_factoring_estimado_pesos)}.
          </div>
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

function FactItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | undefined;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded p-3 ${highlight ? "border-edn-300 bg-edn-50" : "border-slate-200"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold mt-1 ${highlight ? "text-edn-700" : "text-slate-900"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function DeltaRow({
  label,
  before,
  after,
  deltaPct,
}: {
  label: string;
  before: string;
  after: string;
  deltaPct?: number | null;
}) {
  return (
    <div className="border border-slate-100 rounded p-3">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">antes</span>
        <span className="font-mono">{before}</span>
        <span className="text-slate-300">→</span>
        <span className="font-semibold text-slate-900">{after}</span>
        {deltaPct != null && (
          <span
            className={`ml-auto text-xs font-medium ${
              deltaPct > 0 ? "text-emerald-700" : deltaPct < 0 ? "text-rose-700" : "text-slate-500"
            }`}
          >
            {deltaPct > 0 ? "+" : ""}
            {deltaPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatPesos(pesos: number | undefined | null): string {
  if (pesos == null) return "—";
  const n = Number(pesos);
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B COP`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M COP`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K COP`;
  return `$${n.toFixed(0)} COP`;
}
