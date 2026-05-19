import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-edn-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-edn-600 text-sm font-semibold tracking-wide uppercase mb-3">
            Bancolombia × Oregon Interfactura
          </p>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Factoring Signals Engine
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            El motor ML que detecta <span className="font-semibold text-edn-700">cuándo</span> cada
            proveedor en el ecosistema EDN necesita factoring — y lo dispara como lead al equipo
            comercial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card p-6">
            <p className="text-3xl font-bold text-slate-900">5.000+</p>
            <p className="text-sm text-slate-500 mt-1">proveedores activos hoy</p>
            <p className="text-xs text-slate-400 mt-3">solo entre Sodexo y ACER</p>
          </div>
          <div className="card p-6">
            <p className="text-3xl font-bold text-amber-600">~10%</p>
            <p className="text-sm text-slate-500 mt-1">conversión cold call actual</p>
            <p className="text-xs text-slate-400 mt-3">"spray and pray"</p>
          </div>
          <div className="card p-6">
            <p className="text-3xl font-bold text-emerald-600">3x</p>
            <p className="text-sm text-slate-500 mt-1">mejora proyectada de conversión</p>
            <p className="text-xs text-slate-400 mt-3">con leads priorizados por ML</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/leads" className="btn-primary">
            Ver leads priorizados →
          </Link>
          <Link href="/stats" className="btn-secondary">
            Ver impacto antes/después
          </Link>
        </div>

        <div className="mt-16 text-center text-xs text-slate-400">
          Demo · Datos sintéticos · Arquitectura productiva (Supabase + AWS Lambda + Vercel)
        </div>
      </div>
    </main>
  );
}
