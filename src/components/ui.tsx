import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-line bg-surface shadow-sm", className)} {...p} />;
}

export function CardHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const BTN = {
  primary: "bg-primary text-primary-contrast hover:opacity-90",
  secondary: "border border-line bg-surface hover:bg-surface-2",
  ghost: "hover:bg-surface-2",
  danger: "bg-live text-white hover:opacity-90",
} as const;

export function Button({
  variant = "primary",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: keyof typeof BTN }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        BTN[variant],
        className,
      )}
      {...p}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...p
}: ComponentProps<typeof Link> & { variant?: keyof typeof BTN }) {
  return (
    <Link
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition", BTN[variant], className)}
      {...p}
    />
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "live" | "ok" | "primary" | "accent"; children: ReactNode }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    live: "bg-live/10 text-live",
    ok: "bg-ok/10 text-ok",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-ink",
  };
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function LiveBadge() {
  return (
    <Badge tone="live">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" /> EN VIVO
    </Badge>
  );
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function TeamDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: color }} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
