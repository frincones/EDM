export function formatCOP(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  const pesos = Number(centavos) / 100;
  if (pesos >= 1_000_000_000) return `$${(pesos / 1_000_000_000).toFixed(1)}B COP`;
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toFixed(1)}M COP`;
  if (pesos >= 1_000) return `$${(pesos / 1_000).toFixed(0)}K COP`;
  return `$${pesos.toFixed(0)} COP`;
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function scoreToColor(score: number): string {
  if (score >= 0.75) return "bg-emerald-500";
  if (score >= 0.5) return "bg-amber-500";
  if (score >= 0.25) return "bg-slate-400";
  return "bg-slate-300";
}

export function scoreToBadge(score: number): string {
  if (score >= 0.75) return "badge-success";
  if (score >= 0.5) return "badge-warn";
  return "badge-neutral";
}

export function archetypeLabel(arq: string): string {
  return {
    estable: "Estable",
    incremento_ventas: "Incremento de ventas",
    plazos_comprimidos: "Plazos comprimidos",
    ciclicidad_agricola: "Ciclicidad agrícola",
    ciclicidad_comercio_q4: "Comercio Q4",
  }[arq] || arq;
}
