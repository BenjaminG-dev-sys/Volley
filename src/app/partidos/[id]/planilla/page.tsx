import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { ScoresheetView } from "@/components/scoresheet-view";
import { LinkButton } from "@/components/ui";
import { getMatchBundle } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const b = await getMatchBundle((await params).id);
  return { title: b ? `Planilla ${b.home.short_name} vs ${b.away.short_name}` : "Planilla" };
}

export default async function ScoresheetPage({ params }: { params: Promise<{ id: string }> }) {
  const bundle = await getMatchBundle((await params).id);
  if (!bundle) notFound();
  const { match, tournament } = bundle;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`/torneos/${tournament.id}`} className="text-sm text-muted hover:underline">
          ← {tournament.name}
        </Link>
        <div className="flex gap-2">
          <LinkButton variant="secondary" href={`/partidos/${match.id}/en-vivo`}>
            Marcador
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <ScoresheetView bundle={bundle} />
    </div>
  );
}
