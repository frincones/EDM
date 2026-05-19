import Link from "next/link";
import { Activity, BarChart3, ListChecks, Radio, Home } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const links = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/leads", label: "Leads", icon: ListChecks },
    { href: "/feed", label: "Feed en vivo", icon: Radio },
    { href: "/stats", label: "Impacto", icon: BarChart3 },
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
          <nav className="flex items-center gap-1">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 rounded text-sm text-slate-600 hover:text-edn-700 hover:bg-edn-50 inline-flex items-center gap-1.5"
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
        Demo EDM · Modelo XGBoost v1 · Datos sintéticos fieles a la transcripción de Felipe
      </footer>
    </div>
  );
}
