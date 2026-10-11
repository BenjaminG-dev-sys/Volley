import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMatchBundle } from "@/lib/data";
import { getSession, isStaff } from "@/lib/insforge/server";
import { ScorerConsole } from "./scorer-console";

export const metadata: Metadata = { title: "Planilla electrónica" };
export const dynamic = "force-dynamic";

export default async function ScorerPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await getSession();
  if (!session) redirect(`/ingresar?next=/mesa/${matchId}`);
  const bundle = await getMatchBundle(matchId);
  if (!bundle) notFound();
  if (!isStaff(session) && bundle.match.scorer_id !== session.userId) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-display text-xl font-bold">Sin acceso a esta planilla</h1>
        <p className="mt-2 text-sm text-muted">Este partido está asignado a otro planillero.</p>
      </Card>
    );
  }
  return <ScorerConsole bundle={bundle} />;
}
