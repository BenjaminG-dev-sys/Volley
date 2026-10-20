import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { ScoresheetView } from "@/components/scoresheet-view";
import { Card, Empty } from "@/components/ui";
import { getMatchBundle, getTournament } from "@/lib/data";

export const metadata: Metadata = { title: "Planillas por jornada" };
export const dynamic = "force-dynamic";

/** Todas las planillas de una jornada en una página, una por hoja al imprimir. */
export default async function RoundSheets({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jornada?: string }> }) {
  const { id } = await params;
  const { jornada } = await searchParams;
  const { tournament, matches } = await getTournament(id);
  if (!tournament) notFound();
  const round = jornada === "final" ? null : Number(jornada);
  const selected = matches.filter((m) => (round === null ? m.round === null : m.round === round));
  const bundles = (await Promise.all(selected.map((m) => getMatchBundle(m.id)))).filter((b) => b !== null);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/torneos/${id}?tab=exportar`} className="text-sm text-muted hover:underline">
          ← {tournament.name}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            {round === null ? "Fase final" : `Jornada ${round}`} · {bundles.length} planillas
          </span>
          <PrintButton />
        </div>
      </div>
      {bundles.map((b) => (
        <div key={b.match.id} className="break-after-page">
          <ScoresheetView bundle={b} withStats={false} />
        </div>
      ))}
      {!bundles.length && (
        <Card>
          <Empty>No hay partidos en esta jornada.</Empty>
        </Card>
      )}
    </div>
  );
}
