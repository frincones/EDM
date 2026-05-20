import { createServiceClient } from "@/lib/supabase/server";
import { BookOpen, Check, AlertCircle, Quote } from "lucide-react";
import { ScoreDistribution } from "@/components/ScoreDistributionChart";
import { ArchetypeDistribution } from "@/components/ArchetypeDistributionPie";

export const dynamic = "force-dynamic";

const ARQUETIPOS = [
  {
    nombre: "Estable",
    color: "bg-slate-100 border-slate-300",
    porcentaje: "60%",
    label: "Negativo (no necesita)",
    descripcion:
      "Proveedor con facturación regular, plazos consistentes, sin señales de necesidad de liquidez.",
    quoteFelipe: null,
    ejemplo: "Industrias Estables S.A. — 18 meses planos, sin cambios.",
  },
  {
    nombre: "Incremento de ventas",
    color: "bg-emerald-50 border-emerald-300",
    porcentaje: "12%",
    label: "Positivo",
    descripcion:
      "Proveedor que aumenta significativamente su facturación a un comprador específico vs el histórico.",
    quoteFelipe:
      "Un proveedor le empieza a vender más a un comprador de lo históricamente vendido. Eso es una señal de que puede necesitar financiación. Porque cuando uno incrementa, normalmente necesita mayor financiación.",
    ejemplo: "Distribuidora El Llano — creció 47% vendiendo a Sodecorp.",
  },
  {
    nombre: "Plazos comprimidos",
    color: "bg-amber-50 border-amber-300",
    porcentaje: "10%",
    label: "Positivo",
    descripcion:
      "Proveedor cuyos vencimientos típicos se acortan recientemente (ej. de 30 a 15 días) → presión sobre flujo de caja.",
    quoteFelipe:
      "Los vencimientos de las facturas que le emite un proveedor a un comprador son todos los 30. Y de repente esas facturas empiezan a irse hacia el 15. Significa que sí hubo un cambio en los vencimientos, hay cambio en los pagos... seguramente empieza a tener necesidad.",
    ejemplo: "Comercializadora Andes — plazos pasaron de 30 a 15 días.",
  },
  {
    nombre: "Ciclicidad agrícola",
    color: "bg-green-50 border-green-300",
    porcentaje: "9%",
    label: "Positivo (estacional)",
    descripcion:
      "Sector arrocero / agrícola en pico de cosecha (Mayo-Junio y Nov-Dic en Colombia). Liquidez puntual durante el pico.",
    quoteFelipe:
      "Si alguien hace una operación de factoring hoy, que es del sector arrocero, y el sector arrocero hace muchas operaciones de factoring en este momento, porque son cíclicas las operaciones. Yo sé que en esta época el arroz es cuando están en cosecha, está facturando mucho.",
    ejemplo: "Arrocera del Tolima — pico de cosecha mayo (score 0.998).",
  },
  {
    nombre: "Ciclicidad comercio Q4",
    color: "bg-edn-50 border-edn-300",
    porcentaje: "9%",
    label: "Positivo (estacional)",
    descripcion:
      "Comercio en temporada alta de Q4 (octubre–diciembre). Acumula 40-50% de las ventas anuales en 3 meses.",
    quoteFelipe:
      "El comercio, resulta que el comercio es al final del año, en el Q4 se hacen entre el 40 y 50% de las ventas del sector comercio.",
    ejemplo: "Textiles Bogotá — score sube cuando empieza octubre.",
  },
];

const REQUIREMENTS = [
  {
    requerimiento:
      "Identificar CUÁNDO ofrecer factoring (no QUIÉN — eso lo resuelve el banco)",
    solucion: "Motor de propensity scoring con XGBoost sobre features point-in-time",
    estado: "completo",
  },
  {
    requerimiento:
      "Detectar incremento de ventas vs histórico entre proveedor↔comprador",
    solucion: "Feature delta_facturacion_30v180 y delta_vs_mismo_mes_ya",
    estado: "completo",
  },
  {
    requerimiento: "Detectar compresión de plazos (de 30 a 15 días)",
    solucion: "Feature delta_plazo_30v180 con peso alto en el modelo",
    estado: "completo",
  },
  {
    requerimiento: "Capturar ciclos sectoriales (arrocero en cosecha)",
    solucion: "Feature is_pico_cosecha_agro (29.8% importancia en el modelo)",
    estado: "completo",
  },
  {
    requerimiento: "Capturar Q4 comercio",
    solucion: "Feature is_q4 multiplicada por estacionalidad_q4 del comprador",
    estado: "completo",
  },
  {
    requerimiento:
      "Ciclicidad propia por comprador (Sodexo ≠ ACER ≠ arrocero)",
    solucion:
      "Features del comprador: plazo_promedio, estacionalidad_q4, tasa_aceptacion",
    estado: "completo",
  },
  {
    requerimiento: "Operar sin tocar el ERP del banco (CRM independiente)",
    solucion: "EDN POSTea eventos a nuestro endpoint público (Edge Function /ingest)",
    estado: "completo",
  },
  {
    requerimiento: "Feedback loop para que el modelo aprenda por convenio",
    solucion: "Tabla call_outcomes capturada desde dashboard → re-training",
    estado: "completo",
  },
  {
    requerimiento: "Validación XML factura (DIAN compliance)",
    solucion: "Esquema UBL 2.1 soportado vía external_id + CUFE en facturas",
    estado: "parcial",
  },
  {
    requerimiento: "Cold start con poca data histórica",
    solucion:
      "Heurísticas + relabeling sintético basado en features point-in-time, evoluciona a supervised conforme se acumulan outcomes",
    estado: "completo",
  },
];

export default async function MetodologiaPage() {
  const sb = await createServiceClient();

  const { data: archDist } = await sb.rpc("archetype_distribution");
  const { data: scoreDist } = await sb.rpc("score_distribution", {
    n_buckets: 10,
  });
  const { data: countsRow } = await sb.rpc("system_counts");
  const counts = (countsRow as any) || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="text-edn-600" /> Metodología
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cómo está construido el motor — qué arquetipos detecta, qué dijo Felipe en
          la llamada, y cómo se mapea a la solución entregada.
        </p>
      </div>

      {/* Requirements mapping */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          ¿Qué pidió Felipe vs qué entregamos?
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Cada fila corresponde a un requerimiento extraído de la transcripción de la
          llamada de descubrimiento (mayo 2026) y cómo está cubierto en la solución actual.
        </p>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="text-left py-2">Requerimiento</th>
              <th className="text-left py-2">En la solución</th>
              <th className="text-center py-2 w-24">Estado</th>
            </tr>
          </thead>
          <tbody>
            {REQUIREMENTS.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4 text-slate-700">{r.requerimiento}</td>
                <td className="py-3 pr-4 text-slate-700">{r.solucion}</td>
                <td className="py-3 text-center">
                  {r.estado === "completo" ? (
                    <span className="badge-success">
                      <Check size={12} /> OK
                    </span>
                  ) : (
                    <span className="badge-warn">
                      <AlertCircle size={12} /> parcial
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Arquetipos */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Los 5 arquetipos del modelo (fiel a Felipe)
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Cada proveedor en el sistema se modela bajo uno de estos arquetipos. Los 4
          positivos vienen de las señales que Felipe identificó textualmente en la
          llamada; el 5º (estable) es la contrapartida necesaria para entrenar el
          modelo.
        </p>
        <div className="space-y-4">
          {ARQUETIPOS.map((a, i) => (
            <div key={i} className={`border-2 rounded-lg p-4 ${a.color}`}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-semibold text-slate-900">{a.nombre}</h3>
                <div className="text-sm">
                  <span className="text-slate-500 mr-2">{a.porcentaje} del universo</span>
                  <span
                    className={
                      a.label.includes("Positivo")
                        ? "badge-success"
                        : "badge-neutral"
                    }
                  >
                    {a.label}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-2">{a.descripcion}</p>
              {a.quoteFelipe && (
                <blockquote className="border-l-2 border-slate-400 pl-3 my-2 italic text-xs text-slate-600">
                  <Quote size={12} className="inline text-slate-400 mr-1" />
                  "{a.quoteFelipe}"
                  <span className="block text-[10px] text-slate-400 not-italic mt-1">
                    — Felipe, llamada de descubrimiento
                  </span>
                </blockquote>
              )}
              <p className="text-xs text-slate-500 mt-2">
                <strong>Ejemplo en el demo:</strong> {a.ejemplo}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="grid md:grid-cols-2 gap-6">
        <ArchetypeDistribution rows={archDist || []} />
        <ScoreDistribution rows={scoreDist || []} />
      </section>

      {/* Model card */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">El modelo</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Metric label="Tipo" value="XGBoost classifier" />
          <Metric label="Versión" value="v1" />
          <Metric label="Features" value="23" />
          <Metric label="AUC-ROC (test)" value="0.807" />
          <Metric label="PR-AUC (test)" value="0.745" />
          <Metric label="Top-decile capture" value="21%" />
          <Metric label="Dataset entrenamiento" value="1.506 outcomes históricos" />
          <Metric label="Histórico cubierto" value="18 meses" />
          <Metric label="Predicciones generadas hoy" value={counts.signals?.toString() ?? "..."} />
        </div>
      </section>

      {/* Architecture summary */}
      <section className="card p-6 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Arquitectura del pipeline
        </h2>
        <div className="text-sm space-y-3 text-slate-700">
          <p>
            <strong>1. Ingesta:</strong> EDN POSTea cada evento (factura emitida, aceptación,
            pago, etc.) a una <strong>Edge Function</strong> desplegada en Supabase. La
            función valida HMAC, normaliza datos y persiste en{" "}
            <code className="text-xs bg-slate-100 px-1">eventos_raw</code> + tablas de
            dominio.
          </p>
          <p>
            <strong>2. Feature engineering:</strong> Una <strong>materialized view</strong>{" "}
            <code className="text-xs bg-slate-100 px-1">features_par</code> se refresca
            con <strong>pg_cron</strong> cada 15 min. Calcula las ~23 features por par
            (proveedor, comprador) usando SQL con window functions.
          </p>
          <p>
            <strong>3. Inferencia:</strong> Un <strong>AWS Lambda</strong> con container
            Python (FastAPI + Mangum + XGBoost + SHAP) carga el modelo desde S3 al
            iniciar y expone un endpoint público{" "}
            <code className="text-xs bg-slate-100 px-1">/score</code>. Devuelve score +
            razones SHAP en español.
          </p>
          <p>
            <strong>4. Realtime:</strong> Cuando se inserta una nueva fila en{" "}
            <code className="text-xs bg-slate-100 px-1">signals</code>, Supabase
            Realtime envía un push WebSocket a los clientes conectados. El dashboard
            actualiza sin recargar.
          </p>
          <p>
            <strong>5. Frontend:</strong> Next.js en Vercel. Auth + datos vía Supabase
            SDK. Llamadas al Lambda públicas.
          </p>
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
          <Box title="Supabase" lines={["Postgres", "Edge Functions", "Realtime", "pg_cron", "RLS"]} />
          <Box title="AWS" lines={["Lambda container", "S3 (model.pkl)", "ECR (image)", "CloudWatch"]} />
          <Box title="Vercel" lines={["Next.js 14 SSR", "API routes", "Edge runtime"]} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 rounded p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function Box({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="border border-slate-200 rounded p-3 bg-white">
      <p className="font-semibold text-slate-900 mb-2">{title}</p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-slate-600">
            • {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
