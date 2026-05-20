"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Health = { status: "ok" | "fail" | "loading"; latencyMs?: number; detail?: string };

export function SystemHealth() {
  const [supabase, setSupabase] = useState<Health>({ status: "loading" });
  const [lambda, setLambda] = useState<Health>({ status: "loading" });
  const [vercel, setVercel] = useState<Health>({ status: "ok" });

  useEffect(() => {
    // Supabase REST
    const t1 = Date.now();
    fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/health", {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
      .then((r) => {
        if (r.ok) setSupabase({ status: "ok", latencyMs: Date.now() - t1 });
        else setSupabase({ status: "fail", detail: "HTTP " + r.status });
      })
      .catch((e) => setSupabase({ status: "fail", detail: e.message }));

    // Lambda /health
    const t2 = Date.now();
    fetch("https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws/health")
      .then((r) => r.json())
      .then((body) => {
        setLambda({
          status: "ok",
          latencyMs: Date.now() - t2,
          detail: `${body.model_version} · ${body.n_features} features`,
        });
      })
      .catch((e) => setLambda({ status: "fail", detail: e.message }));
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card name="Supabase (DB + Edge + Realtime)" health={supabase} url={process.env.NEXT_PUBLIC_SUPABASE_URL} />
      <Card name="AWS Lambda (XGBoost + SHAP)" health={lambda} url="https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws" />
      <Card name="Vercel (Next.js frontend)" health={vercel} url="https://edm-demo-pi.vercel.app" />
    </div>
  );
}

function Card({ name, health, url }: { name: string; health: Health; url?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        {health.status === "loading" && <Loader2 size={16} className="animate-spin text-slate-400" />}
        {health.status === "ok" && <CheckCircle2 size={16} className="text-emerald-600" />}
        {health.status === "fail" && <XCircle size={16} className="text-rose-600" />}
        <p className="text-sm font-medium text-slate-900">{name}</p>
      </div>
      <p className="text-xs text-slate-500">
        {health.status === "loading"
          ? "chequeando..."
          : health.status === "ok"
          ? `OK · ${health.latencyMs}ms`
          : `Error: ${health.detail || "fail"}`}
      </p>
      {health.detail && health.status === "ok" && (
        <p className="text-xs text-slate-400 mt-1">{health.detail}</p>
      )}
      {url && (
        <p className="text-[10px] text-slate-400 mt-1 truncate font-mono" title={url}>
          {url}
        </p>
      )}
    </div>
  );
}
