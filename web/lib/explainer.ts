// Convierte SHAP + features + arquetipo en parrafo legible para Felipe (no tecnico)
export function buildPlainLanguageExplanation(args: {
  proveedor: string;
  comprador: string;
  arquetipo: string;
  score: number;
  razones: Array<{ feature: string; value: number; contribution: number; label: string }>;
  features: Record<string, any>;
}): string {
  const { proveedor, comprador, arquetipo, score, razones, features } = args;
  const scorePct = (score * 100).toFixed(0);

  const positivos = razones.filter((r) => r.contribution > 0).slice(0, 3);
  const negativos = razones.filter((r) => r.contribution < 0).slice(0, 2);

  let primera = "";
  if (score >= 0.75) {
    primera = `**${proveedor}** tiene una propensión MUY ALTA a aceptar factoring ahora mismo (${scorePct}/100).`;
  } else if (score >= 0.5) {
    primera = `**${proveedor}** muestra señales positivas para factoring (${scorePct}/100), aunque no es el caso más urgente.`;
  } else if (score >= 0.25) {
    primera = `**${proveedor}** está fuera de momento para factoring (${scorePct}/100).`;
  } else {
    primera = `**${proveedor}** no es candidato a factoring ahora (${scorePct}/100). El motor sugiere NO llamarlo.`;
  }

  let segunda = "";
  if (positivos.length === 0 && score < 0.5) {
    segunda = " Su comportamiento de facturación con " + comprador + " está estable, sin señales que indiquen necesidad de liquidez.";
  } else if (positivos.length > 0) {
    segunda = " Las razones principales son: ";
    segunda += positivos.map((p) => p.label.toLowerCase()).join("; ") + ".";
  }

  let tercera = "";
  const ticketAvg = Number(features.ticket_avg_30d) || 0;
  const delta = Number(features.delta_facturacion_30v180) || 0;
  if (Math.abs(delta) > 0.15) {
    const pct = Math.abs(Math.round(delta * 100));
    if (delta > 0) {
      tercera = ` En los últimos 30 días sus ventas a ${comprador} crecieron un ${pct}% respecto al promedio de los últimos 6 meses.`;
    } else {
      tercera = ` En los últimos 30 días sus ventas a ${comprador} bajaron un ${pct}% respecto al promedio de los últimos 6 meses.`;
    }
  }

  let cuarta = "";
  if (negativos.length > 0 && score >= 0.5) {
    cuarta = " También hay factores que reducen el score: " + negativos.map((n) => n.label.toLowerCase()).join(", ") + ".";
  }

  return primera + segunda + tercera + cuarta;
}
