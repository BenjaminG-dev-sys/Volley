import Link from "next/link";
import { TeamCrest, cx } from "@/components/ui";
import type { FormResult } from "@/lib/tournament/form";
import { type StandingRow, formatRatio } from "@/lib/tournament/standings";
import type { Team } from "@/lib/types";

/** Tabla de posiciones de alto contraste: escudo, forma reciente y zona de clasificación. */
export function StandingsTable({
  rows,
  teams,
  qualify,
  form,
}: {
  rows: StandingRow[];
  teams: Map<string, Team>;
  qualify: number;
  form: Map<string, FormResult[]>;
}) {
  const th = "px-2 py-3 text-center font-semibold";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm sm:min-w-[560px]">
        <thead className="eyebrow border-b-2 border-ink text-[11px] text-muted">
          <tr>
            <th className="w-12 py-3 pl-4 text-left font-semibold">#</th>
            <th className="py-3 text-left font-semibold">Equipo</th>
            <th className={th} title="Partidos jugados">PJ</th>
            <th className={cx(th, "hidden sm:table-cell")} title="Ganados">G</th>
            <th className={cx(th, "hidden sm:table-cell")} title="Perdidos">P</th>
            <th className={th} title="Sets ganados:perdidos">Sets</th>
            <th className={cx(th, "hidden md:table-cell")} title="Cociente de sets">C.S.</th>
            <th className={cx(th, "hidden md:table-cell")} title="Cociente de puntos">C.P.</th>
            <th className={cx(th, "hidden sm:table-cell")}>Forma</th>
            <th className="py-3 pr-4 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r, i) => {
            const t = teams.get(r.teamId);
            const inZone = i < qualify;
            return (
              <tr key={r.teamId} className={cx("border-b border-line", i === qualify - 1 && "border-b-2 border-b-ink")}>
                <td className="relative py-3 pl-4">
                  {inZone && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-volt ring-1 ring-black/10" aria-hidden />}
                  <span className="font-display text-2xl font-extrabold">{i + 1}</span>
                </td>
                <td className="py-3">
                  <Link href={`/equipos/${r.teamId}`} className="group flex items-center gap-3">
                    <TeamCrest name={t?.name ?? "—"} color={t?.color_primary ?? "#999"} logo={t?.logo_url} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-semibold group-hover:underline">{t?.short_name ?? "—"}</span>
                      <span className="hidden truncate text-xs text-muted lg:block">{t?.name}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-3 text-center">{r.played}</td>
                <td className="hidden px-2 py-3 text-center sm:table-cell">{r.won}</td>
                <td className="hidden px-2 py-3 text-center sm:table-cell">{r.lost}</td>
                <td className="px-2 py-3 text-center">
                  {r.setsWon}:{r.setsLost}
                </td>
                <td className="hidden px-2 py-3 text-center md:table-cell">{formatRatio(r.setRatio)}</td>
                <td className="hidden px-2 py-3 text-center md:table-cell">{formatRatio(r.pointRatio)}</td>
                <td className="hidden px-2 py-3 sm:table-cell">
                  <span className="flex justify-center gap-1">
                    {(form.get(r.teamId) ?? []).map((f, k) => (
                      <span
                        key={k}
                        className={cx("grid h-5 w-5 place-items-center rounded-sm text-[10px] font-bold", f === "G" ? "bg-ink text-bg" : "bg-surface-2 text-muted")}
                        title={f === "G" ? "Ganó" : "Perdió"}
                      >
                        {f}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-display text-2xl font-extrabold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {qualify > 0 && (
        <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted">
          <span className="h-3 w-1 rounded bg-volt ring-1 ring-black/10" aria-hidden /> Clasifica a la fase final
        </p>
      )}
    </div>
  );
}
