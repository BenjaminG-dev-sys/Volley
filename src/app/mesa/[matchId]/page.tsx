import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";
import { getMatchBundle } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getSession } from "@/lib/insforge/server";
import { scoringAccess } from "@/lib/scoring-window";
import { ScorerConsole } from "./scorer-console";

export const metadata: Metadata = { title: "Planilla electrónica" };
export const dynamic = "force-dynamic";

export default async function ScorerPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await getSession();
  if (!session) redirect(`/ingresar?next=/mesa/${matchId}`);
  const bundle = await getMatchBundle(matchId);
  if (!bundle) notFound();
  const access = scoringAccess(bundle.match, session.userId);
  if (!access.ok) {
    const w = access.window;
    const reasons = {
      not_assigned: "Solo el vocal designado para este partido puede llenar la planilla.",
      no_schedule: "El partido aún no tiene horario asignado. El organizador debe fijarlo para habilitar la planilla.",
      too_early: `La planilla se habilita el ${w ? fmtDateTime(w.opensAt.toISOString()) : ""}.`,
      too_late: `El horario de la planilla terminó el ${w ? fmtDateTime(w.closesAt.toISOString()) : ""}.`,
      finished: "El partido ya está cerrado.",
    } as const;
    return (
      <Card className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold">Planilla no disponible</h1>
        <p className="text-sm text-muted">{reasons[access.reason]}</p>
        <LinkButton variant="secondary" href={`/partidos/${matchId}/en-vivo`}>
          Ver marcador público
        </LinkButton>
      </Card>
    );
  }
  return <ScorerConsole bundle={bundle} closesAt={access.window.closesAt.toISOString()} />;
}
