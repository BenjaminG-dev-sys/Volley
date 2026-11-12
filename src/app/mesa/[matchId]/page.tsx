import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";
import { getMatchBundle } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getSession } from "@/lib/insforge/server";
import { scoringAccess } from "@/lib/match";
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
  if (access.ok) return <ScorerConsole bundle={bundle} closesAt={access.closes.toISOString()} />;

  if (access.reason === "finished") redirect(`/partidos/${matchId}/planilla`);
  const message: Record<typeof access.reason, string> = {
    not_assigned: "Solo el vocal designado para este partido puede llevar la planilla.",
    unscheduled: "El partido aún no tiene horario; la planilla se habilita cuando se programe.",
    too_early: `La planilla se habilita el ${fmtDateTime(access.opens?.toISOString() ?? null)}.`,
    too_late: `El horario de la planilla terminó el ${fmtDateTime(access.closes?.toISOString() ?? null)}. Pide al organizador que reprograme el partido.`,
  };
  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <h1 className="font-display text-xl font-bold">Planilla no disponible</h1>
      <p className="mt-2 text-sm text-muted">{message[access.reason]}</p>
      <div className="mt-4 flex justify-center gap-2">
        <LinkButton href={`/partidos/${matchId}/en-vivo`}>Ver marcador en vivo</LinkButton>
      </div>
    </Card>
  );
}
