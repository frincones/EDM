"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, scoreToBadge, archetypeLabel } from "@/lib/format";
import { Radio, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { AlertToast, type ToastItem } from "@/components/AlertToast";

export default function FeedPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [q, setQ] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let activeQuery = q;

    async function loadInitial() {
      const { data } = await supabase
        .from("v_top_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (mounted && data) setItems(data);
    }
    loadInitial();

    const channel = supabase
      .channel("signals_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        async (payload) => {
          const sig = payload.new as any;
          const { data } = await supabase
            .from("v_top_leads")
            .select("*")
            .eq("signal_id", sig.id)
            .single();
          if (!data) return;

          setItems((prev) => [data, ...prev].slice(0, 80));
          setNewIds((prev) => new Set(prev).add(data.signal_id));
          setTimeout(() => {
            setNewIds((prev) => {
              const n = new Set(prev);
              n.delete(data.signal_id);
              return n;
            });
          }, 3000);

          // Show toast if matches active search OR if high score
          const match = activeQuery
            ? `${data.proveedor_nombre} ${data.comprador_nombre} ${data.proveedor_sector}`
                .toLowerCase()
                .includes(activeQuery)
            : data.score >= 0.85;
          if (match) {
            const toast: ToastItem = {
              id: data.signal_id,
              title: `🔔 ${data.proveedor_nombre}`,
              description: data.razones?.[0]?.label || archetypeLabel(data.arquetipo),
              score: data.score,
            };
            setToasts((prev) => [toast, ...prev].slice(0, 3));
          }
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

  // Keep activeQuery ref in sync
  useEffect(() => {
    (window as any).__activeQuery = q;
  }, [q]);

  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter((s) =>
      `${s.proveedor_nombre} ${s.comprador_nombre} ${s.proveedor_sector} ${s.arquetipo}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, q]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <AlertToast items={toasts} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Radio className="text-edn-600" /> Feed en vivo
          <span className={`badge ${connected ? "badge-success" : "badge-neutral"}`}>
            {connected ? "● conectado" : "○ conectando..."}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada vez que el motor emite una nueva señal, aparece acá. Las que coincidan con tu búsqueda generan alerta arriba a la derecha.
        </p>
      </div>

      <SearchBar
        placeholder="Buscar por proveedor, comprador o sector — recibís alertas cuando algo nuevo matchee..."
        onSearch={setQ}
      />

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            {q ? `Sin señales que coincidan con "${q}"` : "Cargando señales..."}
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.signal_id}
              className={`card p-4 flex items-start gap-4 ${
                newIds.has(s.signal_id) ? "ring-2 ring-edn-400 animate-slideIn" : ""
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
                {s.factura_monto_neto_centavos ? (
                  <p className="text-xs text-slate-700 mt-1" title="Monto neto de la factura que disparó la señal">
                    Factura{" "}
                    <span className="font-semibold">
                      {formatCOP(s.factura_monto_neto_centavos)}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1" title="Volumen proyectado de factoring = ticket promedio × 3">
                    Proy.{" "}
                    <span className="font-semibold">
                      {formatCOP(s.monto_potencial_centavos)}
                    </span>
                  </p>
                )}
              </div>
              <Link
                href={`/leads/${s.signal_id}`}
                className="text-edn-600 text-sm hover:underline"
              >
                Ver →
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
