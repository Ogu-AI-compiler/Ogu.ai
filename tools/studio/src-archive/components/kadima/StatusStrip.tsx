/**
 * StatusStrip — compact health/phase bar for the OS shell.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { StatusDot } from "@/components/ui/status-dot";

export function StatusStrip() {
  const [health, setHealth] = useState<any>(null);
  const [runners, setRunners] = useState<any>(null);
  const activeFeature = useStore((s) => s.activeFeature);
  const features = useStore((s) => s.features);
  const feat = features.find((f) => f.slug === activeFeature);

  useEffect(() => {
    const fetch = () => {
      api.getKadimaHealth().then(setHealth).catch(() => setHealth(null));
      api.getKadimaRunners().then(setRunners).catch(() => setRunners(null));
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  const online = health && !health.error;

  return (
    <div className="flex items-center gap-4 px-1 py-2 text-xs text-text-muted">
      {/* Health dot */}
      <div className="flex items-center gap-1.5">
        <StatusDot variant={online ? "success" : "error"} />
        <span>{online ? "Online" : "Offline"}</span>
      </div>

      {/* Runners */}
      {runners && (
        <span>{runners.active || 0}/{runners.maxConcurrent || 4} runners</span>
      )}

      {/* Active feature */}
      {feat && (
        <span className="font-mono text-text-secondary">
          {feat.slug} &middot; {feat.phase}
        </span>
      )}

      {/* Uptime */}
      {health?.uptimeMs && (
        <span className="ml-auto">{Math.floor(health.uptimeMs / 60000)}m uptime</span>
      )}
    </div>
  );
}
