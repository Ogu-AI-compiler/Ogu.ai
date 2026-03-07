import { useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

export function useGates() {
  const { gateState, setGateState } = useStore();

  const refresh = useCallback(async () => {
    const data = await api.getGates();
    setGateState(data);
  }, [setGateState]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runGates = useCallback(async (slug: string, opts?: { force?: boolean; gate?: number }) => {
    await fetch("/api/gates/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...opts }),
    });
    setTimeout(refresh, 1000);
  }, [refresh]);

  const resetGates = useCallback(async (slug: string) => {
    await fetch("/api/gates/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    await refresh();
  }, [refresh]);

  return { gateState, refresh, runGates, resetGates };
}
