"use client";
import { useState } from "react";
import { Check, X, Loader2, ChevronDown, ChevronRight } from "lucide-react";

export type Step = {
  name: string;
  status: "running" | "ok" | "error";
  duration_ms?: number;
  payload?: any;
  response?: any;
  error?: string;
};

export function PipelineSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <StepRow key={i} step={step} index={i} />
      ))}
      {steps.length > 0 && steps.every((s) => s.status === "ok") && (
        <p className="text-sm text-emerald-700 font-medium mt-3">
          ✓ Pipeline completo —{" "}
          {steps.reduce((acc, s) => acc + (s.duration_ms || 0), 0)}ms total
        </p>
      )}
    </div>
  );
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(false);
  const isError = step.status === "error";
  const isRunning = step.status === "running";
  const isOk = step.status === "ok";

  return (
    <div
      className={`border rounded-md p-3 transition-colors ${
        isError
          ? "border-rose-300 bg-rose-50"
          : isOk
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-shrink-0">
          {isRunning && <Loader2 size={18} className="animate-spin text-edn-600" />}
          {isOk && <Check size={18} className="text-emerald-600" />}
          {isError && <X size={18} className="text-rose-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{step.name}</p>
          {isError && (
            <p className="text-xs text-rose-700 mt-1 truncate">{step.error}</p>
          )}
        </div>
        {step.duration_ms != null && (
          <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
            {step.duration_ms}ms
          </span>
        )}
        {(step.payload || step.response) && (
          <button className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {open && (step.payload || step.response) && (
        <div className="mt-3 space-y-2 text-xs">
          {step.payload && (
            <div>
              <p className="text-slate-500 font-medium mb-1">Request</p>
              <pre className="bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(step.payload, null, 2)}
              </pre>
            </div>
          )}
          {step.response && (
            <div>
              <p className="text-slate-500 font-medium mb-1">Response</p>
              <pre className="bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(step.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
