import { styled, YStack, Text } from "tamagui";

const Node = styled(YStack, {
  width: 100,
  height: 80,
  borderRadius: "$2",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  gap: "$1",
  cursor: "pointer",
  hoverStyle: { borderColor: "$borderColorHover" },
  variants: {
    status: {
      active: { borderColor: "#d4d4d4", backgroundColor: "rgba(212,212,212,0.10)" },
      completed: { borderColor: "#7a7a7a", backgroundColor: "$backgroundHover" },
      pending: { borderColor: "$borderColor", backgroundColor: "$backgroundHover" },
    },
  } as const,
});

interface Props {
  label: string;
  icon: string;
  status: "active" | "completed" | "pending";
  onPress?: () => void;
}

export function StageNode({ label, icon, status, onPress }: Props) {
  return (
    <Node status={status} onPress={onPress}>
      <Text fontSize={20}>{icon}</Text>
      <Text
        fontSize="$1"
        fontFamily="$body"
        color={status === "active" ? "#d4d4d4" : "$colorPress"}
        textAlign="center"
      >
        {label}
      </Text>
    </Node>
  );
}
