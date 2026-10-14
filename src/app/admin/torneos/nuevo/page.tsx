import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { listTeams, listVenues } from "@/lib/data";
import { TournamentWizard } from "./wizard";

export const metadata: Metadata = { title: "Nuevo torneo" };
export const dynamic = "force-dynamic";

export default async function NewTournament() {
  const [teams, venues] = await Promise.all([listTeams(), listVenues()]);
  return (
    <div>
      <PageHeader eyebrow="Asistente" title="Nuevo torneo" sub="Datos, equipos, formato y calendario en un solo paso a paso." />
      <TournamentWizard teams={teams} venues={venues} />
    </div>
  );
}
