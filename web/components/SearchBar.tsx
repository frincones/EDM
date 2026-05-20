"use client";
import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";

export function SearchBar({
  placeholder = "Buscar...",
  onSearch,
  value,
  debounceMs = 150,
}: {
  placeholder?: string;
  onSearch: (q: string) => void;
  value?: string;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState(value ?? "");

  useEffect(() => {
    const t = setTimeout(() => onSearch(local.trim().toLowerCase()), debounceMs);
    return () => clearTimeout(t);
  }, [local, debounceMs]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="pl-9 pr-9 py-2 w-full border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-edn-400 focus:border-edn-400"
      />
      {local && (
        <button
          onClick={() => setLocal("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
