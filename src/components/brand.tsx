import Image from "next/image";
import { cx } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export function BrandSeal({ size = 120, priority, className }: { size?: number; priority?: boolean; className?: string }) {
  const inner = Math.round(size * 0.9);
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full bg-paper ring-1 ring-black/10", className)}
      style={{ width: size, height: size }}
    >
      <Image src={BRAND.logo} alt={BRAND.name} width={inner} height={inner} priority={priority} />
    </span>
  );
}

export function BrandBand({ height = 8, className }: { height?: number; className?: string }) {
  return (
    <div className={cx("brand-band", className)} style={{ height }} aria-hidden>
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
