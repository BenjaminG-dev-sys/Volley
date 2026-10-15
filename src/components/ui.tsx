import Link from "next/link";
import type { CSSProperties, ComponentProps, ReactNode } from "react";
import { initials, teamVars } from "@/lib/color";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface", className)} {...p} />;
}

export function CardHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const BTN = {
  primary: "bg-primary text-primary-contrast hover:opacity-80",
  secondary: "border-[1.5px] border-line bg-transparent hover:border-ink",
  ghost: "hover:bg-surface-2",
  danger: "bg-live text-white hover:opacity-85",
  /** Bloque de campaña: naranja cancha con texto negro. */
  campaign: "bg-orange text-black hover:opacity-85",
  /** Sobre fondos de color u oscuros. */
  inverse: "bg-paper text-black hover:opacity-85",
} as const;

const SIZE = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

type ButtonStyle = { variant?: keyof typeof BTN; size?: keyof typeof SIZE };

const btnCls = (variant: keyof typeof BTN, size: keyof typeof SIZE, className?: string) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    BTN[variant],
    SIZE[size],
    className,
  );

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & ButtonStyle) {
  return <button className={btnCls(variant, size, className)} {...p} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={btnCls(variant, size, className)} {...p} />;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "live" | "ok" | "primary" | "accent"; children: ReactNode }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    live: "bg-live text-white",
    ok: "bg-ok/12 text-ok",
    primary: "bg-primary text-primary-contrast",
    accent: "bg-sun text-black",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", tones[tone])}>
      {children}
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-black px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-volt ring-1 ring-volt/30">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-volt" /> En vivo
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow text-muted", className)}>{children}</p>;
}

export function PageHeader({ title, sub, action, eyebrow }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="display-m">{title}</h1>
        {sub && <p className="mt-2 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  paper: "bg-paper text-black",
  ink: "bg-black text-paper",
  court: "bg-orange text-black",
  sky: "bg-sky text-paper",
  sun: "bg-sun text-black",
  rose: "bg-rose text-paper",
  lavender: "bg-lavender-soft text-ink",
  esfera: "bg-esfera text-paper",
  team: "bg-team text-team-ink",
} as const;
export type Tone = keyof typeof TONES;

/**
 * Bloque de color a sangre (rompe el ancho del contenedor). Para `tone="team"` pasar
 * `color` con el color del equipo o torneo.
 */
export function Section({
  tone = "paper",
  color,
  className,
  children,
}: {
  tone?: Tone;
  color?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx("relative left-1/2 w-screen -translate-x-1/2", TONES[tone], className)}
      style={color ? (teamVars(color) as CSSProperties) : undefined}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-12">{children}</div>
    </section>
  );
}

/**
 * Héroe de campaña: titular gigante sobre un bloque de color o una foto en duotono.
 */
export function Hero({
  eyebrow,
  title,
  sub,
  actions,
  tone = "court",
  color,
  image,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  tone?: Tone;
  color?: string;
  image?: string | null;
  aside?: ReactNode;
}) {
  const withImage = Boolean(image);
  return (
    <section
      className={cx(
        "relative left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden sm:-mt-8",
        withImage ? "bg-black text-paper" : TONES[tone],
      )}
      style={color ? (teamVars(color) as CSSProperties) : undefined}
    >
      {withImage && (
        <div className="duotone absolute inset-0 opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de Storage; se migra a next/image en la Fase 5 */}
          <img src={image!} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="relative mx-auto grid max-w-[1440px] gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12 lg:py-24">
        <div className="reveal">
          {eyebrow && <p className="eyebrow mb-4 opacity-80">{eyebrow}</p>}
          <h1 className="display-xl max-w-5xl">{title}</h1>
          {sub && <p className="mt-6 max-w-xl text-lg opacity-85">{sub}</p>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {aside}
      </div>
    </section>
  );
}

export function StatNumber({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="tabular font-display text-5xl font-extrabold leading-none sm:text-6xl">{value}</div>
      <div className="eyebrow mt-2 opacity-70">{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>;
}

const CREST = { xs: "h-3 w-3 text-[0px]", sm: "h-8 w-8 text-[10px]", md: "h-12 w-12 text-sm", lg: "h-20 w-20 text-xl" } as const;

/** Escudo del equipo: logo si existe; si no, la sigla sobre su color. */
export function TeamCrest({
  name,
  color,
  logo,
  size = "sm",
  className,
}: {
  name: string;
  color: string;
  logo?: string | null;
  size?: keyof typeof CREST;
  className?: string;
}) {
  const base = cx("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-extrabold", CREST[size], className);
  if (logo && size !== "xs")
    // eslint-disable-next-line @next/next/no-img-element -- logos de Storage; se migra a next/image en la Fase 5
    return <img src={logo} alt={name} className={cx(base, "bg-paper object-contain")} />;
  return (
    <span
      className={cx(base, "bg-team text-team-ink ring-1 ring-black/10")}
      style={teamVars(color) as CSSProperties}
      aria-hidden={size === "xs" || undefined}
      title={size === "xs" ? undefined : name}
    >
      {size !== "xs" && initials(name)}
    </span>
  );
}

/** Punto de color del equipo (compatibilidad con listados compactos). */
export function TeamDot({ color }: { color: string }) {
  return <TeamCrest name="" color={color} size="xs" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-ink";
