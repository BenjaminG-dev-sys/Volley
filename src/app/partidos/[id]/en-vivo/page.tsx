import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMatchBundle } from "@/lib/data";
import { LiveView } from "./live-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const b = await getMatchBundle((await params).id);
  return { title: b ? `${b.home.short_name} vs ${b.away.short_name} en vivo` : "Partido" };
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const bundle = await getMatchBundle((await params).id);
  if (!bundle) notFound();
  return <LiveView bundle={bundle} />;
}
