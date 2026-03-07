import { useEffect, useState, useCallback, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { DetailPanel } from "@/components/shared/DetailPanel";

const TYPE_COLORS: Record<string, string> = {
  FILE: "#60a5fa",
  API: "#4ade80",
  ROUTE: "#facc15",
  COMPONENT: "#a78bfa",
  SCHEMA: "#f472b6",
  CONTRACT: "#fb923c",
  TOKEN: "#22d3ee",
  TEST: "#34d399",
};

const TYPE_ICONS: Record<string, string> = {
  FILE: "F",
  API: "A",
  ROUTE: "R",
  COMPONENT: "C",
  SCHEMA: "S",
  CONTRACT: "K",
  TOKEN: "T",
  TEST: "Q",
};

interface Artifact {
  id: string;
  type: string;
  identifier: string;
  producedBy: { agentId: string; taskId: string; featureSlug: string };
  files: { path: string; hash: string | null }[];
  dependencies: string[];
  producedAt: string;
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  metadata?: {
    roleId: string;
    model: string;
    tier: string;
    tokensUsed: { input: number; output: number; total: number };
    cost: number;
  };
}

function ArtifactCard({ artifact, onSelect }: { artifact: Artifact; onSelect: () => void }) {
  const color = TYPE_COLORS[artifact.type] || "#888";
  const icon = TYPE_ICONS[artifact.type] || "?";

  return (
    <div
      onClick={onSelect}
      style={{
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        padding: 12,
        gap: 12,
        cursor: "pointer",
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderColor: artifact.verified ? "#4ade80" : "rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Type badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: `${color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{icon}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {artifact.producedBy?.taskId || artifact.id}
          </span>
          {artifact.verified ? (
            <span style={{ fontSize: 9, fontWeight: 600, color: "#4ade80", backgroundColor: "rgba(74,222,128,0.15)", borderRadius: 4, padding: "1px 4px" }}>VERIFIED</span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 4, padding: "1px 4px" }}>UNVERIFIED</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color, fontWeight: 600 }}>{artifact.type}</span>
          {(artifact.files?.length || 0) > 0 && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {artifact.files[0]?.path || "—"}{artifact.files.length > 1 ? ` +${artifact.files.length - 1}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Right side: agent + cost */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 80 }}>
        {artifact.producedBy?.agentId && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{artifact.producedBy.agentId}</span>
        )}
        {artifact.metadata?.cost != null && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>${artifact.metadata.cost.toFixed(4)}</span>
        )}
        {artifact.metadata?.model && (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{artifact.metadata.model}</span>
        )}
      </div>
    </div>
  );
}

function DependencyGraph({ artifacts }: { artifacts: Artifact[] }) {
  const withDeps = artifacts.filter((a) => (a.dependencies?.length || 0) > 0);
  if (withDeps.length === 0) return null;

  return (
    <div style={{
      backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20,
      borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)",
      gap: 12, display: "flex", flexDirection: "column",
    }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Dependencies</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {withDeps.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4, paddingBottom: 4 }}>
            <span style={{ fontSize: 10, color: TYPE_COLORS[a.type] || "#888", minWidth: 80 }}>
              {a.producedBy?.taskId || a.id}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>&larr;</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flex: 1 }}>
              {(a.dependencies || []).join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArtifactsView() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [index, setIndex] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const activeFeature = useStore((s) => s.activeFeature);
  const { on } = useSocket();

  const fetchArtifacts = useCallback(() => {
    if (!activeFeature) {
      setLoading(false);
      return;
    }
    api.getArtifacts(activeFeature)
      .then((data) => {
        setArtifacts(data.artifacts || []);
        setIndex(data.index || null);
      })
      .catch(() => {
        setArtifacts([]);
        setIndex(null);
      })
      .finally(() => setLoading(false));
  }, [activeFeature]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  useEffect(() => {
    const unsub1 = on("task:completed", () => fetchArtifacts());
    const unsub2 = on("gate:passed", () => fetchArtifacts());
    return () => { unsub1(); unsub2(); };
  }, [on, fetchArtifacts]);

  const stats = useMemo(() => {
    const verified = artifacts.filter((a) => a.verified).length;
    const totalFiles = artifacts.reduce((sum, a) => sum + (a.files?.length || 0), 0);
    const totalCost = artifacts.reduce((sum, a) => sum + (a.metadata?.cost || 0), 0);
    const types = [...new Set(artifacts.map((a) => a.type))];
    const byType = types.reduce((acc, t) => {
      acc[t] = artifacts.filter((a) => a.type === t).length;
      return acc;
    }, {} as Record<string, number>);
    return { verified, totalFiles, totalCost, types, byType };
  }, [artifacts]);

  const filtered = typeFilter ? artifacts.filter((a) => a.type === typeFilter) : artifacts;

  const sorted = [...filtered].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? 1 : -1;
    return new Date(b.producedAt).getTime() - new Date(a.producedAt).getTime();
  });

  if (loading) return (
    <div style={{ flex: 1, position: "relative" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading artifacts...</span>
    </div>
  );

  if (!activeFeature) {
    return (
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Artifacts</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No active feature. Select a feature first.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Artifacts — {activeFeature}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {stats.verified === artifacts.length && artifacts.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#4ade80", backgroundColor: "rgba(74,222,128,0.15)", borderRadius: 4, padding: "2px 8px" }}>ALL VERIFIED</span>
          ) : artifacts.length > 0 ? (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              {stats.verified}/{artifacts.length} verified
            </span>
          ) : null}
        </div>
      </div>

      {artifacts.length === 0 ? (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            No artifacts yet. Artifacts are produced when agents complete tasks during build.
          </span>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Artifacts", value: String(artifacts.length), color: undefined },
              { label: "Verified", value: String(stats.verified), color: stats.verified === artifacts.length ? "#4ade80" : "#facc15" },
              { label: "Files", value: String(stats.totalFiles), color: undefined },
              { label: "Total Cost", value: `$${stats.totalCost.toFixed(4)}`, color: undefined },
              { label: "Types", value: String(stats.types.length), color: undefined },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 90, gap: 4, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Type filter chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setTypeFilter(null)}
              style={{
                paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
                borderRadius: 4, cursor: "pointer", border: "none",
                backgroundColor: typeFilter === null ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: typeFilter === null ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
                All ({artifacts.length})
              </span>
            </button>
            {stats.types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                style={{
                  paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 4, cursor: "pointer", border: "none",
                  backgroundColor: typeFilter === t ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)",
                  display: "flex", gap: 4, alignItems: "center",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLORS[t] || "#888" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: typeFilter === t ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
                  {t} ({stats.byType[t]})
                </span>
              </button>
            ))}
          </div>

          <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

          {/* Artifact list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((a) => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                onSelect={() => setSelectedArtifact(selectedArtifact?.id === a.id ? null : a)}
              />
            ))}
          </div>

          {/* Dependencies */}
          <DependencyGraph artifacts={artifacts} />
        </>
      )}

      {/* Detail Panel */}
      {selectedArtifact && (
        <DetailPanel
          title={selectedArtifact.identifier}
          data={{
            id: selectedArtifact.id,
            type: selectedArtifact.type,
            task: selectedArtifact.producedBy.taskId,
            agent: selectedArtifact.producedBy.agentId,
            verified: selectedArtifact.verified,
            verifiedBy: selectedArtifact.verifiedBy || "—",
            verifiedAt: selectedArtifact.verifiedAt || "—",
            producedAt: selectedArtifact.producedAt,
            files: selectedArtifact.files,
            dependencies: selectedArtifact.dependencies.length > 0 ? selectedArtifact.dependencies : "none",
            metadata: selectedArtifact.metadata || "—",
          }}
          onClose={() => setSelectedArtifact(null)}
        />
      )}
    </div>
  );
}
