import { MessageSquare } from "lucide-react";
import { buildPlainLanguageExplanation } from "@/lib/explainer";

export function PlainLanguageExplanation({
  proveedor,
  comprador,
  arquetipo,
  score,
  razones,
  features,
}: {
  proveedor: string;
  comprador: string;
  arquetipo: string;
  score: number;
  razones: any[];
  features: Record<string, any>;
}) {
  const text = buildPlainLanguageExplanation({
    proveedor,
    comprador,
    arquetipo,
    score,
    razones,
    features,
  });

  // Render markdown-ish: **bold** -> <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <div className="card p-6 border-l-4 border-l-edn-500 bg-edn-50/30">
      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <MessageSquare size={16} className="text-edn-600" />
        En lenguaje simple
      </h2>
      <p className="text-base text-slate-800 leading-relaxed">
        {parts.map((p, i) =>
          p.startsWith("**") ? (
            <strong key={i} className="text-edn-700">
              {p.replace(/\*\*/g, "")}
            </strong>
          ) : (
            <span key={i}>{p}</span>
          )
        )}
      </p>
    </div>
  );
}
