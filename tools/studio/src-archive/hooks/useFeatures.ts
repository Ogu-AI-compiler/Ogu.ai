import { useEffect, useCallback } from "react";
import { useStore, type Feature } from "@/lib/store";
import { api } from "@/lib/api";

export function useFeatures() {
  const { features, activeFeature, setFeatures } = useStore();

  const refresh = useCallback(async () => {
    const data = await api.getFeatures();
    setFeatures(data.features, data.active);
  }, [setFeatures]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchTo = useCallback(async (slug: string) => {
    await fetch("/api/features/" + slug + "/switch", { method: "POST" });
    await refresh();
  }, [refresh]);

  const create = useCallback(async (slug: string) => {
    await fetch("/api/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    await refresh();
  }, [refresh]);

  return { features, activeFeature, refresh, switchTo, create };
}
