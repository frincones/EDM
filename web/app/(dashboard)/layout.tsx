import Link from "next/link";
import {
  Activity,
  BarChart3,
  ListChecks,
  Radio,
  Home,
  Beaker,
  BookOpen,
  Server,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const links = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/leads", label: "Leads", icon: ListChecks },
    { href: "/feed", label: "Feed", icon: Radio },
    { href: "/simulador", label: "Simulador", icon: Beaker, accent: true },
    { href: "/metodologia", label: "Metodología", icon: BookOpen },
    { href: "/stats", label: "Impacto", icon: BarChart3 },
    { href: "/sistema", label: "Sistema", icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-edn-600" size={22} />
            <span className="font-semibold text-slate-900">
              EDM <span className="text-edn-600">Factoring Signals</span>
            </span>
          </div>
          <nav className="flex items-center gap-0.5">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-2.5 py-1.5 rounded text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors ${
                    l.accent
                      ? "text-edn-700 hover:bg-edn-50 font-medium"
                      : "text-slate-600 hover:text-edn-700 hover:bg-edn-50"
                  }`}
                >
                  <Icon size={14} /> {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">{children}</main>
      <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        Demo EDM · Modelo XGBoost v1 · Datos sintéticos fieles a la transcripción de Felipe ·{" "}
        <Link href="/sistema" className="hover:text-edn-600">
          Estado del sistema →
        </Link>
      </footer>
    </div>
  );
}
