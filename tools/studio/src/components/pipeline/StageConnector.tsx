import { styled, YStack } from "tamagui";

const Arrow = styled(YStack, {
  width: 32,
  height: 2,
  alignSelf: "center",
  variants: {
    done: {
      true: { backgroundColor: "#d4d4d4" },
      false: { backgroundColor: "$borderColor" },
    },
  } as const,
});

export function StageConnector({ done = false }: { done?: boolean }) {
  return <Arrow done={done} />;
}
