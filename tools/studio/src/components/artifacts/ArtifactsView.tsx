import { useEffect, useState, useCallback, useMemo } from "react";
import { styled, Text, YStack, XStack, Separator } from "tamagui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { DetailPanel } from "@/components/shared/DetailPanel";

const Container = styled(YStack, { flex: 1, gap: "$4", position: "relative" as any });
const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$3",
});
const StatBox = styled(YStack, {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: "$2",
  padding: "$3",
  minWidth: 90,
  gap: "$1",
});
const TypeChip = styled(XStack, {
  paddingHorizontal: "$2",
  paddingVertical: 2,
  borderRadius: "$1",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.25)" },
      false: { backgroundColor: "rgba(255,255,255,0.04)", hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" } },
    },
  } as const,
});

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
    <XStack
      backgroundColor="rgba(255,255,255,0.03)"
      borderRadius="$2"
      padding="$3"
      gap="$3"
      cursor="pointer"
      hoverStyle={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      borderLeftWidth={3}
      borderColor={artifact.verified ? "#4ade80" : "rgba(255,255,255,0.1)"}
      onPress={onSelect}
      alignItems="center"
    >
      {/* Type badge */}
      <XStack
        width={28}
        height={28}
        borderRadius={14}
        backgroundColor={`${color}20`}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={11} fontWeight="700" color={color}>{icon}</Text>
      </XStack>

      {/* Info */}
      <YStack flex={1} gap="$1">
        <XStack gap="$2" alignItems="center">
          <Text fontSize="$2" fontWeight="600" fontFamily="$mono" numberOfLines={1} flex={1}>
            {artifact.producedBy?.taskId || artifact.id}
          </Text>
          {artifact.verified ? (
            <XStack backgroundColor="rgba(74,222,128,0.15)" borderRadius="$1" paddingHorizontal="$1">
              <Text fontSize={9} fontWeight="600" color="#4ade80">VERIFIED</Text>
            </XStack>
          ) : (
            <XStack backgroundColor="rgba(255,255,255,0.06)" borderRadius="$1" paddingHorizontal="$1">
              <Text fontSize={9} fontWeight="600" color="$colorPress">UNVERIFIED</Text>
            </XStack>
          )}
        </XStack>
        <XStack gap="$2" alignItems="center">
          <Text fontSize={10} color={color} fontWeight="600">{artifact.type}</Text>
          {(artifact.files?.length || 0) > 0 && (
            <Text fontSize={10} color="$colorPress" fontFamily="$mono" numberOfLines={1}>
              {artifact.files[0]?.path || "—"}{artifact.files.length > 1 ? ` +${artifact.files.length - 1}` : ""}
            </Text>
          )}
        </XStack>
      </YStack>

      {/* Right side: agent + cost */}
      <YStack alignItems="flex-end" gap="$1" minWidth={80}>
        {artifact.producedBy?.agentId && (
          <Text fontSize={10} color="$colorPress">{artifact.producedBy.agentId}</Text>
        )}
        {artifact.metadata?.cost != null && (
          <Text fontSize={10} color="$colorPress" fontFamily="$mono">${artifact.metadata.cost.toFixed(4)}</Text>
        )}
        {artifact.metadata?.model && (
          <Text fontSize={9} color="$colorPress">{artifact.metadata.model}</Text>
        )}
      </YStack>
    </XStack>
  );
}

function DependencyGraph({ artifacts }: { artifacts: Artifact[] }) {
  const withDeps = artifacts.filter((a) => (a.dependencies?.length || 0) > 0);
  if (withDeps.length === 0) return null;

  return (
    <Card>
      <Text fontSize="$3" fontWeight="600">Dependencies</Text>
      <YStack gap="$1">
        {withDeps.map((a) => (
          <XStack key={a.id} gap="$2" alignItems="center" paddingVertical="$1">
            <Text fontSize={10} color={TYPE_COLORS[a.type] || "#888"} fontFamily="$mono" minWidth={80}>
              {a.producedBy?.taskId || a.id}
            </Text>
            <Text fontSize={10} color="$colorPress">&larr;</Text>
            <Text fontSize={10} color="$colorPress" fontFamily="$mono" flex={1}>
              {(a.dependencies || []).join(", ")}
            </Text>
          </XStack>
        ))}
      </YStack>
    </Card>
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

  // Computed stats
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

  const filtered = typeFilter
    ? artifacts.filter((a) => a.type === typeFilter)
    : artifacts;

  // Sort: unverified first, then by producedAt desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? 1 : -1;
    return new Date(b.producedAt).getTime() - new Date(a.producedAt).getTime();
  });

  if (loading) return <Container><Text color="$colorPress">Loading artifacts...</Text></Container>;

  if (!activeFeature) {
    return (
      <Container>
        <Card>
          <Text fontSize="$3" fontWeight="600">Artifacts</Text>
          <Text fontSize="$2" color="$colorPress">No active feature. Select a feature first.</Text>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      {/* Header stats */}
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$5" fontWeight="700">Artifacts — {activeFeature}</Text>
        <XStack gap="$2" alignItems="center">
          {stats.verified === artifacts.length && artifacts.length > 0 ? (
            <XStack backgroundColor="rgba(74,222,128,0.15)" borderRadius="$1" paddingHorizontal="$2" paddingVertical={2}>
              <Text fontSize={10} fontWeight="600" color="#4ade80">ALL VERIFIED</Text>
            </XStack>
          ) : artifacts.length > 0 ? (
            <Text fontSize="$1" color="$colorPress">
              {stats.verified}/{artifacts.length} verified
            </Text>
          ) : null}
        </XStack>
      </XStack>

      {artifacts.length === 0 ? (
        <Card>
          <Text fontSize="$2" color="$colorPress">
            No artifacts yet. Artifacts are produced when agents complete tasks during build.
          </Text>
        </Card>
      ) : (
        <>
          {/* Stats row */}
          <XStack gap="$3" flexWrap="wrap">
            <StatBox>
              <Text fontSize={10} color="$colorPress">Artifacts</Text>
              <Text fontSize="$4" fontWeight="700">{artifacts.length}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize={10} color="$colorPress">Verified</Text>
              <Text fontSize="$4" fontWeight="700" color={stats.verified === artifacts.length ? "#4ade80" : "#facc15"}>
                {stats.verified}
              </Text>
            </StatBox>
            <StatBox>
              <Text fontSize={10} color="$colorPress">Files</Text>
              <Text fontSize="$4" fontWeight="700">{stats.totalFiles}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize={10} color="$colorPress">Total Cost</Text>
              <Text fontSize="$4" fontWeight="700">${stats.totalCost.toFixed(4)}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize={10} color="$colorPress">Types</Text>
              <Text fontSize="$4" fontWeight="700">{stats.types.length}</Text>
            </StatBox>
          </XStack>

          {/* Type filter chips */}
          <XStack gap="$2" flexWrap="wrap">
            <TypeChip active={typeFilter === null} onPress={() => setTypeFilter(null)}>
              <Text fontSize={11} fontWeight="600" color={typeFilter === null ? "#a78bfa" : "$colorPress"}>
                All ({artifacts.length})
              </Text>
            </TypeChip>
            {stats.types.map((t) => (
              <TypeChip key={t} active={typeFilter === t} onPress={() => setTypeFilter(typeFilter === t ? null : t)}>
                <XStack gap="$1" alignItems="center">
                  <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TYPE_COLORS[t] || "#888" }} />
                  <Text fontSize={11} fontWeight="600" color={typeFilter === t ? "#a78bfa" : "$colorPress"}>
                    {t} ({stats.byType[t]})
                  </Text>
                </XStack>
              </TypeChip>
            ))}
          </XStack>

          <Separator borderColor="rgba(255,255,255,0.08)" />

          {/* Artifact list */}
          <YStack gap="$2">
            {sorted.map((a) => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                onSelect={() => setSelectedArtifact(selectedArtifact?.id === a.id ? null : a)}
              />
            ))}
          </YStack>

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
    </Container>
  );
}
