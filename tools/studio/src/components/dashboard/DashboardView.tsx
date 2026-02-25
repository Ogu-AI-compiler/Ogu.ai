import { useEffect, useState } from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { useStore } from "@/lib/store";
import { useCommand } from "@/hooks/useCommand";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { StatusCard } from "./StatusCard";
import { GateProgressBar } from "./GateProgressBar";
import { RecentActivity } from "./RecentActivity";

/* ── Pipeline stages ── */
const stages = [
  { key: "discovery", label: "Discovery", icon: icons.lightbulb, command: null },
  { key: "feature", label: "Feature", icon: icons.clipboard, command: "feature:validate" },
  { key: "architect", label: "Architect", icon: icons.building, command: "feature:validate" },
  { key: "preflight", label: "Preflight", icon: icons.checkCircle, command: "doctor" },
  { key: "build", label: "Build", icon: icons.hammer, command: null },
  { key: "gates", label: "Gates", icon: icons.shield, command: "gates" },
  { key: "deliver", label: "Done", icon: icons.rocket, command: null },
];

const phaseOrder = ["discovery", "feature", "architect", "preflight", "build", "gates", "deliver"];

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

export function DashboardView() {
  const { features, activeFeature, platform, gateState } = useStore();
  const [themeData, setThemeData] = useState<any>(null);
  const [detectedPhase, setDetectedPhase] = useState<string>("discovery");
  const [involvement, setInvolvement] = useState<string | null>(null);
  const doctor = useCommand();
  const pipelineCmd = useCommand();

  const refresh = () => {
    api.getState().then((d) => setThemeData(d.theme));
    api.getGates().then((g) => useStore.getState().setGateState(g));
    // Use server-detected phase (phase-guard)
    fetch("/api/state/phase").then((r) => r.json()).then((d) => {
      if (d.phase) setDetectedPhase(d.phase);
      if (d.involvement) setInvolvement(d.involvement);
    }).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = features.filter((f) => f.phase !== "done").length;
  const doneCount = features.filter((f) => f.phase === "done").length;
  const mood = themeData?.mood || "dark";

  const currentPhase = detectedPhase;
  const currentIdx = phaseOrder.indexOf(currentPhase);

  function getStatus(i: number): "active" | "completed" | "pending" {
    const phaseIdx = Math.min(i, phaseOrder.length - 1);
    if (phaseIdx < currentIdx) return "completed";
    if (phaseIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <YStack flex={1} padding="$7" gap="$6" overflow="scroll">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5} style={{ color: "var(--text)" }}>Dashboard</Text>
        <Text fontSize="$4" style={{ color: "var(--text-secondary)" }}>Project overview and health status</Text>
      </YStack>

      <XStack gap="$4" flexWrap="wrap">
        <StatusCard label="Platform" value={platform} />
        <StatusCard label="Active Feature" value={activeFeature || "None"} accent={!!activeFeature} />
        <StatusCard label="Features" value={String(activeCount)} sub={`${doneCount} completed`} />
        <StatusCard label="Theme" value={mood} />
      </XStack>

      {/* Pipeline */}
      <YStack gap="$3" borderRadius="$4" padding="$5"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$2" fontWeight="500" textTransform="uppercase" letterSpacing={0.5}
            style={{ color: "var(--text-secondary)" }}>
            Pipeline {activeFeature ? `- ${activeFeature}` : ""}
          </Text>
          <XStack gap="$2" alignItems="center">
            {involvement && (
              <Text fontSize={10} fontWeight="600" style={{
                color: "var(--accent)", backgroundColor: "var(--accent-soft)",
                padding: "2px 8px", borderRadius: 10,
              }}>{involvement}</Text>
            )}
            <Text fontSize={10} fontWeight="600" style={{
              color: currentIdx >= 0 ? "#8b5cf6" : "var(--text-secondary)",
              backgroundColor: currentIdx >= 0 ? "rgba(139,92,246,0.12)" : "transparent",
              padding: "2px 8px", borderRadius: 10,
            }}>{currentPhase.toUpperCase()}</Text>
          </XStack>
        </XStack>
        <XStack alignItems="center" justifyContent="center" gap="$1" flexWrap="wrap" paddingVertical="$3">
          {stages.map((stage, i) => (
            <XStack key={stage.key} alignItems="center" gap="$1">
              <Node
                status={getStatus(i)}
                onPress={
                  stage.command
                    ? () => pipelineCmd.runSync(stage.command!, activeFeature ? ["--phase-1"] : [])
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
        {pipelineCmd.output.length > 0 && (
          <YStack borderRadius="$3" padding="$3" gap="$1" marginTop="$2"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)",
              border: `1px solid ${pipelineCmd.exitCode === 0 ? "var(--success)" : "var(--error)"}33`,
            }}>
            {pipelineCmd.output.slice(-10).map((line, i) => (
              <Text key={i} fontSize="$2" fontFamily="$body" style={{ color: "var(--text)" }}>{line}</Text>
            ))}
          </YStack>
        )}
      </YStack>

      {/* Gates */}
      <YStack borderRadius="$4" padding="$5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <GateProgressBar gates={gateState?.gates || {}} />
        {gateState?.feature && (
          <Text fontSize="$2" marginTop="$3" style={{ color: "var(--text-secondary)" }}>
            Feature: {gateState.feature}
          </Text>
        )}
      </YStack>

      {/* Actions */}
      <XStack gap="$3">
        <YStack borderRadius="$3" paddingHorizontal="$5" paddingVertical="$3" cursor="pointer"
          onPress={() => doctor.runSync("doctor")}
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          hoverStyle={{ opacity: 0.85 }}>
          <Text fontSize="$3" fontWeight="600" style={{ color: "var(--text)" }}>
            {doctor.loading ? "Running..." : "Run Doctor"}
          </Text>
        </YStack>
        <YStack borderRadius="$3" paddingHorizontal="$5" paddingVertical="$3" cursor="pointer"
          onPress={() => doctor.runSync("validate")}
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          hoverStyle={{ opacity: 0.85 }}>
          <Text fontSize="$3" fontWeight="600" style={{ color: "var(--text)" }}>Validate</Text>
        </YStack>
      </XStack>

      {doctor.output.length > 0 && (
        <YStack borderRadius="$3" padding="$4" gap="$1"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)",
            border: `1px solid ${doctor.exitCode === 0 ? "var(--success)" : "var(--error)"}33`,
          }}>
          <XStack justifyContent="space-between" marginBottom="$2">
            <Text fontSize="$1" fontFamily="$body" style={{ color: "var(--text-secondary)" }}>output</Text>
            {doctor.exitCode != null && (
              <Text fontSize="$1" fontFamily="$body"
                style={{ color: doctor.exitCode === 0 ? "var(--success)" : "var(--error)" }}>
                exit {doctor.exitCode}
              </Text>
            )}
          </XStack>
          {doctor.output.map((line, i) => (
            <Text key={i} fontSize="$2" fontFamily="$body" style={{ color: "var(--text)" }}>{line}</Text>
          ))}
        </YStack>
      )}

      <RecentActivity />
    </YStack>
  );
}
