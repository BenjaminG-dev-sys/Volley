import type { Metadata } from "next";
import { BrandBand, BrandSeal } from "@/components/brand";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex justify-center">
        <BrandSeal size={128} priority />
      </div>
      <Card className="overflow-hidden">
        <BrandBand height={4} />
        <div className="p-6">
          <h1 className="font-display text-2xl font-bold uppercase">Ingresar</h1>
          <p className="mb-5 text-sm text-muted">
            Acceso para la directiva de la Asociación, los delegados de cada liga parroquial y los planilleros. El público no
            necesita cuenta.
          </p>
          <LoginForm next={next} />
        </div>
      </Card>
    </div>
  );
}
