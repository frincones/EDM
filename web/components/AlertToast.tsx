"use client";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  score?: number;
};

export function AlertToast({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {items.map((it) => (
        <ToastCard key={it.id} item={it} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 300);
    }, 6000);
    return () => clearTimeout(t);
  }, [item.id]);

  return (
    <div
      className={`bg-white border-l-4 border-l-edn-500 shadow-lg rounded-md p-3 min-w-[280px] transition-all ${
        visible ? "animate-slideIn" : "opacity-0 translate-x-4"
      }`}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-edn-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
          )}
          {item.score != null && (
            <p className="text-xs font-mono text-edn-700 mt-1">
              Score: {(item.score * 100).toFixed(0)}/100
            </p>
          )}
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
