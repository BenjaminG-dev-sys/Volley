import { ImageResponse } from "next/og";

// Íconos de la app instalable: pelota negra sobre círculo volt, fondo negro.
export const dynamic = "force-static";

const SIZES = { "192": { px: 192, ball: 0.72 }, "512": { px: 512, ball: 0.72 }, maskable: { px: 512, ball: 0.56 } } as const;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size as keyof typeof SIZES] ?? SIZES["512"];
  const d = Math.round(spec.px * spec.ball);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111111" }}>
        <svg width={d} height={d} viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth={1.6} strokeLinecap="round">
          <circle cx="12" cy="12" r="11" fill="#d4ff3a" stroke="none" />
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3c-1.5 3.5-1.2 7 1 9.5M3.6 9.5c3.6-.6 7 .5 9.4 2.5M7 19.5c1-3.6 3.4-6.2 6-7.5M21 12.5c-3 1.8-6.5 2-8-.5M15.5 20.3c-.8-3.4-.6-6 .3-8.3" />
        </svg>
      </div>
    ),
    { width: spec.px, height: spec.px },
  );
}
