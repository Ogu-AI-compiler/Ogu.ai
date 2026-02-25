import { styled, YStack, XStack, Text } from "tamagui";

const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
  gap: "$3",
  cursor: "pointer",
  minWidth: 220,
  hoverStyle: {
    borderColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(28,28,28,0.7)",
  },
  variants: {
    isActive: {
      true: { borderColor: "rgba(139,92,246,0.3)" },
    },
  } as const,
});

const Badge = styled(Text, {
  fontSize: 11,
  fontWeight: "600",
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: "$7",
  textTransform: "uppercase",
  letterSpacing: 0.5,
});

const phaseStyles: Record<string, { bg: string; color: string }> = {
  idea: { bg: "rgba(245,158,11,0.15)", color: "#c89b3c" },
  feature: { bg: "rgba(59,130,246,0.15)", color: "#b3b3b3" },
  architect: { bg: "rgba(212,212,212,0.12)", color: "#d4d4d4" },
  ready: { bg: "rgba(34,197,94,0.15)", color: "#3fa36b" },
  done: { bg: "rgba(148,148,168,0.15)", color: "#b3b3b3" },
};

interface Props {
  slug: string;
  phase: string;
  tasks: number;
  isActive: boolean;
  onPress: () => void;
}

export function FeatureCard({ slug, phase, tasks, isActive, onPress }: Props) {
  const style = phaseStyles[phase] || phaseStyles.idea;

  return (
    <Card isActive={isActive} onPress={onPress}>
      <Text fontSize="$4" fontWeight="600" color="$color">{slug}</Text>
      <XStack justifyContent="space-between" alignItems="center">
        <Badge backgroundColor={style.bg} color={style.color}>{phase}</Badge>
        {tasks > 0 && (
          <Text fontSize="$1" color="#7a7a7a">{tasks} tasks</Text>
        )}
      </XStack>
      {isActive && (
        <Text fontSize="$1" fontWeight="600" color="#d4d4d4">ACTIVE</Text>
      )}
    </Card>
  );
}
