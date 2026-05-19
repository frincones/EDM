"use client";
import { useState, useTransition } from "react";
import { recordCallOutcome } from "@/app/actions";

const OPTIONS = [
  { value: "factoring_cerrado", label: "✅ Factoring cerrado", color: "bg-emerald-600 text-white" },
  { value: "factoring_rechazado", label: "❌ Rechazado", color: "bg-slate-200" },
  { value: "no_contesto", label: "📵 No contestó", color: "bg-slate-200" },
  { value: "recontactar", label: "🔁 Re-contactar", color: "bg-amber-100 text-amber-800" },
];

export function CallOutcomeForm({
  signalId,
  proveedorId,
}: {
  signalId: string;
  proveedorId: string;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    if (!outcome) return;
    startTransition(async () => {
      await recordCallOutcome({
        signalId,
        proveedorId,
        outcome,
        montoCerrado: monto ? Number(monto) * 100 : null,
        notas: notas || null,
      });
      setDone(true);
    });
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
        ✓ Outcome registrado. El modelo lo usará en el próximo re-entrenamiento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setOutcome(o.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              outcome === o.value ? o.color + " ring-2 ring-edn-400" : o.color
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {outcome === "factoring_cerrado" && (
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto cerrado (millones COP)"
          className="w-full md:w-64 px-3 py-1.5 border border-slate-300 rounded text-sm"
        />
      )}
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Notas (opcional)"
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        rows={2}
      />
      <button onClick={submit} disabled={!outcome || isPending} className="btn-primary disabled:opacity-50">
        {isPending ? "Guardando..." : "Registrar resultado"}
      </button>
    </div>
  );
}
