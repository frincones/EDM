// Escenarios pre-armados para el simulador
// Cada escenario describe una serie de facturas a insertar y la narrativa esperada

export type ScenarioEvent = {
  delay_ms?: number;
  monto_neto_cop: number;
  plazo_dias: number;
  fecha_offset_dias?: number; // dias desde "hoy"
};

export type Scenario = {
  slug: string;
  emoji: string;
  title: string;
  description: string;
  proveedorMatch: string; // ILIKE pattern para encontrar el proveedor
  expected: string;
  events: ScenarioEvent[];
};

export const SCENARIOS: Scenario[] = [
  {
    slug: "cosecha-sorpresiva",
    emoji: "🌾",
    title: "Cosecha sorpresiva",
    description:
      "Arrocera del Tolima emite 3 facturas grandes — pico cosecha + plazos extendidos típicos del sector.",
    proveedorMatch: "Arrocera del Tolima",
    expected:
      "Score sube por encima de 0.95. Razón principal: pico de cosecha agrícola + crecimiento estacional.",
    events: [
      { monto_neto_cop: 28_500_000, plazo_dias: 45, fecha_offset_dias: 0 },
      { monto_neto_cop: 32_100_000, plazo_dias: 60, fecha_offset_dias: -2 },
      { monto_neto_cop: 26_800_000, plazo_dias: 45, fecha_offset_dias: -4 },
    ],
  },
  {
    slug: "plazos-comprimidos",
    emoji: "📉",
    title: "Plazos comprimidos",
    description:
      "Comercializadora Andes emite 3 facturas con plazo a 15 días (su histórico era 30) — señal clara de necesidad de caja.",
    proveedorMatch: "Comercializadora Andes",
    expected:
      "Score sube significativamente. Razón: compresión de plazos de 30→15 días.",
    events: [
      { monto_neto_cop: 18_300_000, plazo_dias: 15, fecha_offset_dias: 0 },
      { monto_neto_cop: 22_100_000, plazo_dias: 15, fecha_offset_dias: -3 },
      { monto_neto_cop: 19_800_000, plazo_dias: 15, fecha_offset_dias: -6 },
    ],
  },
  {
    slug: "crecimiento-llano",
    emoji: "📈",
    title: "Crecimiento de Distribuidora El Llano",
    description:
      "Distribuidora El Llano emite 3 facturas grandes consecutivas — incremento 45% vs su ticket promedio.",
    proveedorMatch: "Distribuidora El Llano",
    expected: "Score sube. Razón: crecimiento de facturación detectado.",
    events: [
      { monto_neto_cop: 24_500_000, plazo_dias: 30, fecha_offset_dias: 0 },
      { monto_neto_cop: 26_200_000, plazo_dias: 30, fecha_offset_dias: -2 },
      { monto_neto_cop: 21_900_000, plazo_dias: 30, fecha_offset_dias: -5 },
    ],
  },
  {
    slug: "q4-textiles",
    emoji: "🎄",
    title: "Q4 Textiles (fuera de temporada)",
    description:
      "Textiles Bogotá emite facturas en mayo — el modelo debe entender que NO es Q4 todavía y NO priorizar.",
    proveedorMatch: "Textiles Bogota",
    expected:
      "Score se mantiene moderado / bajo. El motor sabe que la temporada Q4 todavía no llega.",
    events: [
      { monto_neto_cop: 8_900_000, plazo_dias: 30, fecha_offset_dias: 0 },
      { monto_neto_cop: 7_200_000, plazo_dias: 30, fecha_offset_dias: -3 },
    ],
  },
  {
    slug: "estable-sin-senal",
    emoji: "🟢",
    title: "Proveedor estable (control negativo)",
    description:
      "Industrias Estables emite facturas idénticas a su histórico — el modelo NO debería alertarlo.",
    proveedorMatch: "Industrias Estables",
    expected:
      "Score se mantiene bajo. El motor NO sugiere llamarlo — confirma que no hay falsos positivos.",
    events: [
      { monto_neto_cop: 6_500_000, plazo_dias: 30, fecha_offset_dias: 0 },
      { monto_neto_cop: 7_100_000, plazo_dias: 30, fecha_offset_dias: -4 },
    ],
  },
];

export function findScenario(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
