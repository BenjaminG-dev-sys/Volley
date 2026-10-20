import Link from "next/link";
import type { CSSProperties } from "react";
import { TeamCrest, cx } from "@/components/ui";
import { teamVars } from "@/lib/color";
import type { PlayerPublic, Team } from "@/lib/types";

/** Tarjeta de equipo tipo "producto": bloque del color del club con su sigla gigante. Enlaza a su perfil. */
export function TeamTile({ team }: { team: Team }) {
  return (
    <Link
      href={`/equipos/${team.id}`}
      className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl bg-team p-4 text-team-ink transition hover:-translate-y-0.5"
      style={teamVars(team.color_primary) as CSSProperties}
    >
      <TeamCrest name={team.name} color={team.color_secondary || "#ffffff"} logo={team.logo_url} size="md" className="ring-2 ring-white/40" />
      <span
        className="img-hover pointer-events-none absolute -right-3 top-6 font-display text-[7rem] font-extrabold uppercase leading-none opacity-15 sm:text-[9rem]"
        aria-hidden
      >
        {team.short_name.slice(0, 3)}
      </span>
      <div className="relative">
        <p className="font-display text-2xl font-extrabold uppercase leading-none">{team.short_name}</p>
        <p className="mt-1 truncate text-sm opacity-80">{team.name}</p>
        {team.city && <p className="eyebrow mt-2 opacity-70">{team.city}</p>}
      </div>
    </Link>
  );
}

const POSITION_LABEL: Record<string, string> = {
  armador: "Armador(a)",
  opuesto: "Opuesto(a)",
  central: "Central",
  punta: "Punta",
  libero: "Líbero",
  servidor: "Servidor",
  colocador: "Colocador",
  volador: "Volador",
};
export const positionLabel = (p: string | null) => (p ? (POSITION_LABEL[p] ?? p) : "—");

/** Ficha de jugador: número gigante en el color del equipo (requiere `--team` en un ancestro). */
export function PlayerTile({ player }: { player: PlayerPublic }) {
  return (
    <Link
      href={`/jugadores/${player.id}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:border-ink"
    >
      <div className="flex justify-between gap-2">
        <span className="eyebrow text-muted">{positionLabel(player.is_libero ? "libero" : player.position)}</span>
        <span className="flex gap-1">
          {player.is_captain && <span className="rounded-sm bg-ink px-1.5 text-[11px] font-bold text-bg">C</span>}
          {player.is_libero && <span className="rounded-sm bg-volt px-1.5 text-[11px] font-bold text-black">L</span>}
        </span>
      </div>
      <span
        className={cx(
          "img-hover tabular font-display text-[6.5rem] font-extrabold leading-[0.8] sm:text-[8rem]",
          player.is_libero ? "text-ink" : "text-team",
        )}
      >
        {player.number}
      </span>
      <div>
        <p className="truncate font-display text-xl font-extrabold uppercase leading-tight">{player.last_name}</p>
        <p className="truncate text-sm text-muted">{player.first_name}</p>
      </div>
    </Link>
  );
}
