"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, scoreToColor, scoreToBadge, archetypeLabel } from "@/lib/format";
import { Radio, Sparkles } from "lucide-react";

type SignalRow = {
  id: string;
  created_at: string;
  score: number;
  monto_potencial_centavos: number | null;
  razones: any[];
  model_version: string;
  proveedor_id: string;
  comprador_id: string;
};

export default function FeedPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      const { data } = await supabase
        .from("v_top_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (mounted && data) setItems(data);
    }
    loadInitial();

    const channel = supabase
      .channel("signals_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        async (payload) => {
          // Fetch full row from view for the new signal
          const sig = payload.new as SignalRow;
          const { data } = await supabase
            .from("v_top_leads")
            .select("*")
            .eq("signal_id", sig.id)
            .single();
          if (data) setItems((prev) => [data, ...prev].slice(0, 60));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Radio className="text-edn-600" /> Feed en vivo
          <span className={`badge ${connected ? "badge-success" : "badge-neutral"}`}>
            {connected ? "● conectado" : "○ conectando..."}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Las nuevas señales aparecen en tiempo real (Supabase Realtime sobre tabla `signals`).
        </p>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            Cargando señales...
          </div>
        ) : (
          items.map((s, i) => (
            <div
              key={s.signal_id}
              className={`card p-4 flex items-start gap-4 animate-slideIn ${
                i === 0 && connected ? "ring-2 ring-edn-300" : ""
              }`}
            >
              <div className="w-2 self-stretch rounded-full bg-edn-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-edn-600" />
                  <span className="font-medium text-slate-900">{s.proveedor_nombre}</span>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="text-sm text-slate-600">{s.comprador_nombre}</span>
                  {s.arquetipo_visible && <span className="badge-info">⭐</span>}
                </div>
                <p className="text-xs text-slate-500">
                  {(s.razones?.[0]?.label as string) || archetypeLabel(s.arquetipo)}
                </p>
              </div>
              <div className="text-right">
                <p className={`${scoreToBadge(s.score)}`}>{(s.score * 100).toFixed(0)}/100</p>
                <p className="text-xs text-slate-500 mt-1">{formatCOP(s.monto_potencial_centavos)}</p>
              </div>
              <Link href={`/leads/${s.signal_id}`} className="text-edn-600 text-sm hover:underline">
                Ver →
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
