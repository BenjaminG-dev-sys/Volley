import type { Metadata } from "next";
import Link from "next/link";
import { TeamTile } from "@/components/team-tile";
import { Card, Empty, PageHeader } from "@/components/ui";
import { listTeams } from "@/lib/data";
import { SPORT_LABEL, type Sport } from "@/lib/scoresheet/rules";

export const metadata: Metadata = { title: "Ligas parroquiales" };
export const dynamic = "force-dynamic";

export default async function TeamsIndex({ searchParams }: { searchParams: Promise<{ deporte?: string }> }) {
  const { deporte } = await searchParams;
  const filter: Sport | null = deporte === "voley" || deporte === "ecuavoley" ? deporte : null;
  const teams = await listTeams();
  const sports = (["voley", "ecuavoley"] as const).filter((s) => !filter || s === filter);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow={`${teams.length} ligas afiliadas`}
        title="Ligas parroquiales"
        sub="Las selecciones de cada liga parroquial afiliada a la Asociación: nóminas, calendario y resultados."
      />
      <nav aria-label="Deporte" className="-mt-6 flex flex-wrap gap-2">
        {[{ id: null, label: "Todo" }, ...(["voley", "ecuavoley"] as const).map((s) => ({ id: s, label: SPORT_LABEL[s] }))].map((m) => {
          const active = filter === m.id;
          return (
            <Link
              key={m.label}
              href={m.id ? `/equipos?deporte=${m.id}` : "/equipos"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border-[1.5px] px-5 py-2 text-sm font-semibold transition ${active ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"}`}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>
      {sports.map((s) => {
        const list = teams.filter((t) => (t.sport ?? "voley") === s);
        return (
          <section key={s}>
            <h2 className="display-m mb-5">{SPORT_LABEL[s]}</h2>
            {list.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((t) => (
                  <TeamTile key={t.id} team={t} />
                ))}
              </div>
            ) : (
              <Card>
                <Empty>Aún no hay ligas inscritas en {SPORT_LABEL[s].toLowerCase()}.</Empty>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
