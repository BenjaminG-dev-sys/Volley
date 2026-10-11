"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { insforge } from "@/lib/insforge/client";

/** Re-renderiza la página del servidor cuando cambia un partido en vivo (canal `live`). */
export function LiveRefresher({ tournamentId }: { tournamentId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const rt = insforge().realtime;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = (msg: { tournament_id?: string }) => {
      if (tournamentId && msg.tournament_id !== tournamentId) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, 800);
    };
    rt.on("match_updated", onUpdate);
    rt.subscribe("live").catch(() => {});
    return () => {
      rt.off("match_updated", onUpdate);
      rt.unsubscribe("live");
      if (timer) clearTimeout(timer);
    };
  }, [router, tournamentId]);
  return null;
}
