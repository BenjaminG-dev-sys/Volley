"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Card, Field, TeamCrest, cx, inputCls } from "@/components/ui";
import { BRANCH_LABEL } from "@/lib/format";
import { RULE_PRESETS, SPORT_LABEL, type RulePresetId } from "@/lib/scoresheet/rules";
import { CATEGORIES } from "@/lib/tournament/categories";
import { buildSchedule } from "@/lib/tournament/scheduler";
import { STANDINGS_PRESETS, type StandingsPresetId } from "@/lib/tournament/standings";
import type { Team, Venue } from "@/lib/types";
import { type WizardPayload, createTournamentWizard } from "../../actions";

const STEPS = ["Datos", "Equipos", "Formato", "Calendario", "Confirmar"] as const;

export function TournamentWizard({ teams, venues }: { teams: Team[]; venues: Venue[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const [p, setP] = useState<WizardPayload>({
    name: "",
    season: new Date().getFullYear(),
    category: "Mayores",
    branch: "femenino",
    city: "",
    format: "round_robin",
    preset: "voley_fivb",
    standings: "fivb",
    color: "#ff6b1a",
    teamIds: [],
    groups: 2,
    startDate: "",
    venueId: "",
    publish: false,
  });
  const set = <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => setP((x) => ({ ...x, [k]: v }));
  const sport = RULE_PRESETS[p.preset].sport;
  const available = teams.filter((t) => (t.sport ?? "voley") === sport);
  const selected = p.teamIds.map((id) => teams.find((t) => t.id === id)!).filter(Boolean);
  const preview = useMemo(
    () =>
      p.teamIds.length >= 2
        ? buildSchedule({
            teamIds: p.teamIds,
            groupCount: p.format === "groups_knockout" ? p.groups : 1,
            startMs: p.startDate ? new Date(`${p.startDate}T09:00:00-05:00`).getTime() : 0,
            venueId: null,
          })
        : null,
    [p.teamIds, p.format, p.groups, p.startDate],
  );
  const rounds = preview ? Math.max(...preview.matches.map((m) => m.round)) : 0;

  const problem = (() => {
    if (step === 0 && !p.name.trim()) return "Escribe el nombre del torneo.";
    if (step === 1 && p.teamIds.length < 2) return "Elige al menos 2 equipos.";
    if (step === 2 && p.format === "groups_knockout" && p.teamIds.length < p.groups * 2) return `Con ${p.groups} grupos necesitas al menos ${p.groups * 2} equipos.`;
    return null;
  })();

  const next = () => {
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const submit = () =>
    start(async () => {
      const r = await createTournamentWizard(p);
      if (r.error || !r.id) return setError(r.error ?? "No se pudo crear el torneo.");
      router.push(`/admin/torneos/${r.id}`);
    });

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cx(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                i === step ? "bg-ink text-bg" : i < step ? "border-[1.5px] border-ink" : "border-[1.5px] border-line text-muted",
              )}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <Card className="space-y-5 p-5 sm:p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Interparroquial 2026" autoFocus />
            </Field>
            <Field label="Deporte y reglamento">
              <select
                className={inputCls}
                value={p.preset}
                onChange={(e) => {
                  set("preset", e.target.value as RulePresetId);
                  set("teamIds", []);
                }}
              >
                {Object.entries(RULE_PRESETS).map(([id, r]) => (
                  <option key={id} value={id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temporada">
              <input type="number" className={inputCls} value={p.season} onChange={(e) => set("season", Number(e.target.value))} />
            </Field>
            <Field label="Ciudad">
              <input className={inputCls} value={p.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Categoría">
              <select className={inputCls} value={p.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Rama">
              <select className={inputCls} value={p.branch} onChange={(e) => set("branch", e.target.value)}>
                {Object.entries(BRANCH_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sistema de puntos">
              <select className={inputCls} value={p.standings} onChange={(e) => set("standings", e.target.value as StandingsPresetId)}>
                {Object.entries(STANDINGS_PRESETS).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Color del torneo">
              <input type="color" value={p.color} onChange={(e) => set("color", e.target.value)} className="h-11 w-24 rounded-lg border border-line" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Equipos de {SPORT_LABEL[sport].toLowerCase()} · el orden de selección es el sembrado ({p.teamIds.length} elegidos).
              </p>
              <input className={cx(inputCls, "sm:w-64")} placeholder="Filtrar equipos" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available
                .filter((t) => `${t.name} ${t.short_name} ${t.city ?? ""}`.toLowerCase().includes(filter.toLowerCase()))
                .map((t) => {
                  const idx = p.teamIds.indexOf(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("teamIds", idx >= 0 ? p.teamIds.filter((x) => x !== t.id) : [...p.teamIds, t.id])}
                      className={cx(
                        "flex items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-left text-sm transition",
                        idx >= 0 ? "border-ink bg-surface-2" : "border-line hover:border-ink",
                      )}
                    >
                      <TeamCrest name={t.name} color={t.color_primary} logo={t.logo_url} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{t.short_name}</span>
                        <span className="block truncate text-xs text-muted">{t.name}</span>
                      </span>
                      {idx >= 0 && <Badge tone="primary">#{idx + 1}</Badge>}
                    </button>
                  );
                })}
              {!available.length && <p className="text-sm text-muted">No hay equipos de este deporte. Créalos en «Equipos y nóminas».</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(["round_robin", "groups_knockout"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("format", f)}
                  className={cx("rounded-xl border-[1.5px] px-4 py-3 text-left", p.format === f ? "border-ink bg-surface-2" : "border-line")}
                >
                  <span className="block font-semibold">{f === "round_robin" ? "Todos contra todos" : "Grupos + eliminatoria"}</span>
                  <span className="text-xs text-muted">{f === "round_robin" ? "Una tabla única" : "Grupos en serpentina y semifinales"}</span>
                </button>
              ))}
            </div>
            {p.format === "groups_knockout" && (
              <Field label="Cantidad de grupos">
                <select className={cx(inputCls, "w-40")} value={p.groups} onChange={(e) => set("groups", Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {preview && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[...new Set(preview.groups.map((g) => g.group_label ?? "Única"))].map((label) => (
                  <div key={label} className="rounded-xl border border-line p-3">
                    <p className="eyebrow mb-2 text-muted">{label === "Única" ? "Tabla única" : `Grupo ${label}`}</p>
                    <ul className="space-y-1 text-sm">
                      {preview.groups
                        .filter((g) => (g.group_label ?? "Única") === label)
                        .map((g) => (
                          <li key={g.team_id}>{teams.find((t) => t.id === g.team_id)?.short_name}</li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primera jornada" hint="Opcional: sin fecha, el calendario se genera después">
                <input type="date" className={inputCls} value={p.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="Sede">
                <select className={inputCls} value={p.venueId} onChange={(e) => set("venueId", e.target.value)}>
                  <option value="">Por definir</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {preview && (
              <p className="text-sm text-muted">
                {preview.matches.length} partidos en {rounds} jornadas, una por semana, desde las 09:00 cada 2 horas.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">Torneo</dt>
              <dd className="font-semibold">{p.name}</dd>
              <dt className="text-muted">Reglamento</dt>
              <dd>{RULE_PRESETS[p.preset].label}</dd>
              <dt className="text-muted">Categoría</dt>
              <dd>
                {p.category} · {BRANCH_LABEL[p.branch]} · {p.season}
              </dd>
              <dt className="text-muted">Puntos</dt>
              <dd>{STANDINGS_PRESETS[p.standings].label}</dd>
              <dt className="text-muted">Equipos</dt>
              <dd>{selected.map((t) => t.short_name).join(", ")}</dd>
              <dt className="text-muted">Formato</dt>
              <dd>{p.format === "round_robin" ? "Todos contra todos" : `${p.groups} grupos + eliminatoria`}</dd>
              <dt className="text-muted">Calendario</dt>
              <dd>{p.startDate && preview ? `${preview.matches.length} partidos desde ${p.startDate}` : "Se genera después"}</dd>
            </dl>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.publish} onChange={(e) => set("publish", e.target.checked)} /> Publicar ahora (si no, queda como borrador)
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}
        <div className="flex justify-between gap-3 border-t border-line pt-4">
          <Button variant="secondary" type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Creando…" : "Crear torneo"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
