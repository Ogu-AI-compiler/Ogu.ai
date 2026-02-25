import { styled, XStack, YStack, Text } from "tamagui";

const Segment = styled(YStack, {
  width: 28,
  height: 28,
  borderRadius: "$2",
  alignItems: "center",
  justifyContent: "center",
  variants: {
    status: {
      passed: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
      failed: { backgroundColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
      pending: { backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
    },
  } as const,
});

const gateNames = [
  "doctor", "ctx_lock", "plan", "no_todos", "ui",
  "smoke", "vision", "contracts", "preview", "memory",
];

interface Props {
  gates: Record<string, { status: string }>;
}

export function GateProgressBar({ gates }: Props) {
  const passed = Object.values(gates).filter((g) => g.status === "passed").length;

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$2" color="#b3b3b3" fontWeight="500" textTransform="uppercase" letterSpacing={0.5}>
          Completion Gates
        </Text>
        <Text fontSize="$4" fontWeight="700" color={passed > 0 ? "#3fa36b" : "$color"}>
          {passed}/10
        </Text>
      </XStack>
      <XStack gap={6}>
        {gateNames.map((name, i) => {
          const gate = gates[String(i + 1)];
          const status = (gate?.status || "pending") as "passed" | "failed" | "pending";
          const textColor = status === "passed" ? "#3fa36b" : status === "failed" ? "#d05a5a" : "#7a7a7a";
          return (
            <YStack key={name} alignItems="center" gap="$1">
              <Segment status={status}>
                <Text fontSize={11} fontWeight="600" color={textColor}>{i + 1}</Text>
              </Segment>
              <Text fontSize={9} color="#7a7a7a">{name.slice(0, 4)}</Text>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}
