const TZ = "America/Guayaquil";

export function fmtDateTime(iso: string | null) {
  if (!iso) return "Por definir";
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDate(iso: string | null) {
  if (!iso) return "Por definir";
  return new Intl.DateTimeFormat("es-EC", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

export function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-EC", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export const BRANCH_LABEL: Record<string, string> = { femenino: "Femenino", masculino: "Masculino", mixto: "Mixto" };
