import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-bold">Ingresar</h1>
        <p className="mb-5 text-sm text-muted">Acceso para organizadores y planilleros. El público no necesita cuenta.</p>
        <LoginForm next={next} />
      </Card>
    </div>
  );
}
