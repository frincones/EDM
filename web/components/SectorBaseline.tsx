"use client";
import { Users } from "lucide-react";
import { formatCOP } from "@/lib/format";

export function SectorBaseline({
  sectorRow,
  proveedorTicket,
  proveedorPlazo,
}: {
  sectorRow: any;
  proveedorTicket?: number;
  proveedorPlazo?: number;
}) {
  if (!sectorRow) return null;
  const sectorTicket = Number(sectorRow.ticket_avg) || 0;
  const sectorPlazo = Number(sectorRow.plazo_avg) || 0;
  const pctFact = Number(sectorRow.pct_proveedores_con_factoring) || 0;

  const ticketDelta =
    proveedorTicket && sectorTicket
      ? (proveedorTicket - sectorTicket) / sectorTicket
      : 0;
  const plazoDelta =
    proveedorPlazo != null ? proveedorPlazo - sectorPlazo : 0;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Users size={16} className="text-edn-600" /> Cómo se compara con su sector
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Sector {sectorRow.sector_ciiu} — {sectorRow.n_proveedores} proveedores en nuestro ecosistema.
      </p>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <Compare
          label="Ticket promedio"
          mine={formatCOP(proveedorTicket || 0)}
          theirs={formatCOP(sectorTicket)}
          delta={`${ticketDelta > 0 ? "+" : ""}${(ticketDelta * 100).toFixed(0)}%`}
          good={ticketDelta > 0}
        />
        <Compare
          label="Plazo promedio"
          mine={`${(proveedorPlazo || 0).toFixed(0)} días`}
          theirs={`${sectorPlazo.toFixed(0)} días`}
          delta={`${plazoDelta > 0 ? "+" : ""}${plazoDelta.toFixed(0)} d`}
          good={plazoDelta < 0}
        />
        <Compare
          label="% del sector con factoring"
          mine={null}
          theirs={`${(pctFact * 100).toFixed(0)}%`}
          delta={null}
        />
      </div>
    </div>
  );
}

function Compare({
  label,
  mine,
  theirs,
  delta,
  good,
}: {
  label: string;
  mine: string | null;
  theirs: string;
  delta: string | null;
  good?: boolean;
}) {
  return (
    <div className="border border-slate-100 rounded p-3">
      <p className="text-xs text-slate-500">{label}</p>
      {mine && <p className="font-semibold text-slate-900 mt-1">{mine}</p>}
      <p className="text-xs text-slate-500 mt-1">Sector: {theirs}</p>
      {delta && (
        <p
          className={`text-xs font-medium mt-1 ${
            good ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
