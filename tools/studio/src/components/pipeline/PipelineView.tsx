import { useState } from "react";
import { styled, XStack, YStack, Text, Separator } from "tamagui";
import { useStore } from "@/lib/store";
import { useCommand } from "@/hooks/useCommand";
import { Icon, icons } from "@/lib/icons";
import { DAGView } from "@/components/dag/DAGView";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";

const Page = styled(YStack, {
  flex: 1,
  padding: "$7",
  gap: "$6",
  overflow: "scroll",
  position: "relative" as any,
});
const TabBtn = styled(XStack, {
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.2)" },
      false: { backgroundColor: "rgba(255,255,255,0.04)", hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" } },
    },
  } as const,
});

const stages = [
  { key: "idea", label: "Idea", icon: icons.lightbulb, command: null },
  { key: "feature", label: "Feature", icon: icons.clipboard, command: "feature:validate" },
  { key: "architect", label: "Architect", icon: icons.building, command: "feature:validate" },
  { key: "preflight", label: "Preflight", icon: icons.checkCircle, command: "doctor" },
  { key: "build", label: "Build", icon: icons.hammer, command: null },
  { key: "gates", label: "Gates", icon: icons.shield, command: "gates" },
  { key: "done", label: "Done", icon: icons.rocket, command: null },
];

const phaseOrder = ["idea", "feature", "architect", "ready", "done"];

const Node = styled(YStack, {
  width: 100,
  height: 88,
  borderRadius: "$4",
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  cursor: "pointer",
  borderWidth: 1,
  variants: {
    status: {
      active: {
        backgroundColor: "rgba(139,92,246,0.1)",
        borderColor: "rgba(139,92,246,0.3)",
      },
      completed: {
        backgroundColor: "rgba(34,197,94,0.06)",
        borderColor: "rgba(34,197,94,0.15)",
      },
      pending: {
        backgroundColor: "rgba(22,22,22,0.6)",
        borderColor: "rgba(255,255,255,0.06)",
        hoverStyle: {
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: "rgba(28,28,28,0.7)",
        },
      },
    },
  } as const,
});

const Connector = styled(YStack, {
  width: 40,
  height: 2,
  borderRadius: 1,
  alignSelf: "center",
  variants: {
    done: {
      true: { backgroundColor: "rgba(34,197,94,0.3)" },
      false: { backgroundColor: "rgba(255,255,255,0.06)" },
    },
  } as const,
});

type Tab = "phases" | "dag" | "artifacts";

function PhaseTimeline() {
  const features = useStore((s) => s.features);
  const activeFeature = useStore((s) => s.activeFeature);
  const cmd = useCommand();

  const active = features.find((f) => f.slug === activeFeature);
  const currentPhase = active?.phase || "idea";
  const currentIdx = phaseOrder.indexOf(currentPhase);

  function getStatus(i: number): "active" | "completed" | "pending" {
    const phaseIdx = Math.min(i, phaseOrder.length - 1);
    if (phaseIdx < currentIdx) return "completed";
    if (phaseIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <>
      <XStack alignItems="center" justifyContent="center" gap="$1" flexWrap="wrap" paddingVertical="$6">
        {stages.map((stage, i) => (
          <XStack key={stage.key} alignItems="center" gap="$1">
            <Node
              status={getStatus(i)}
              onPress={
                stage.command
                  ? () => cmd.runSync(stage.command!, activeFeature ? ["--phase-1"] : [])
                  : undefined
              }
            >
              <Icon d={stage.icon} size={22} />
              <Text
                fontSize="$1"
                fontWeight="600"
                color={getStatus(i) === "active" ? "#d4d4d4" : getStatus(i) === "completed" ? "#3fa36b" : "#b3b3b3"}
              >
                {stage.label}
              </Text>
            </Node>
            {i < stages.length - 1 && <Connector done={getStatus(i) === "completed"} />}
          </XStack>
        ))}
      </XStack>

      {cmd.output.length > 0 && (
        <YStack
          backgroundColor="rgba(15,15,23,0.8)"
          borderRadius="$3"
          padding="$4"
          borderWidth={1}
          borderColor={cmd.exitCode === 0 ? "rgba(34,197,94,0.2)" : cmd.exitCode != null ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}
          maxHeight={300}
          overflow="hidden"
          gap="$1"
        >
          <XStack justifyContent="space-between" marginBottom="$1">
            <Text fontSize="$1" fontFamily="$body" color="#b3b3b3">output</Text>
            {cmd.exitCode != null && (
              <Text fontSize="$1" fontFamily="$body" color={cmd.exitCode === 0 ? "#3fa36b" : "#d05a5a"}>
                exit {cmd.exitCode}
              </Text>
            )}
          </XStack>
          {cmd.output.slice(-20).map((line, i) => (
            <Text key={i} fontSize="$2" fontFamily="$body" color="$color">{line}</Text>
          ))}
        </YStack>
      )}
    </>
  );
}

export function PipelineView() {
  const [tab, setTab] = useState<Tab>("phases");
  const activeFeature = useStore((s) => s.activeFeature);
  const features = useStore((s) => s.features);
  const active = features.find((f) => f.slug === activeFeature);
  const currentPhase = active?.phase || "idea";

  return (
    <Page>
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>Pipeline</Text>
        <Text fontSize="$4" color="#b3b3b3">
          {activeFeature ? `Active: ${activeFeature} (${currentPhase})` : 'No active feature — run "switch <slug>" in chat'}
        </Text>
      </YStack>

      {/* Tabs */}
      <XStack gap="$2">
        <TabBtn active={tab === "phases"} onPress={() => setTab("phases")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "phases" ? "#a78bfa" : "$colorPress"}>
            Phase Pipeline
          </Text>
        </TabBtn>
        <TabBtn active={tab === "dag"} onPress={() => setTab("dag")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "dag" ? "#a78bfa" : "$colorPress"}>
            Task DAG
          </Text>
        </TabBtn>
        <TabBtn active={tab === "artifacts"} onPress={() => setTab("artifacts")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "artifacts" ? "#a78bfa" : "$colorPress"}>
            Artifacts
          </Text>
        </TabBtn>
      </XStack>

      <Separator borderColor="rgba(255,255,255,0.08)" />

      {tab === "phases" && <PhaseTimeline />}
      {tab === "dag" && <DAGView />}
      {tab === "artifacts" && <ArtifactsView />}
    </Page>
  );
}
