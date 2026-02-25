import { styled, YStack, Text } from "tamagui";

const Bubble = styled(YStack, {
  borderRadius: "$2",
  padding: "$2",
  maxWidth: "90%",
  variants: {
    role: {
      user: {
        alignSelf: "flex-end",
        backgroundColor: "rgba(212,212,212,0.10)",
        borderWidth: 1,
        borderColor: "rgba(212,212,212,0.16)",
      },
      system: {
        alignSelf: "flex-start",
        backgroundColor: "$backgroundHover",
        borderWidth: 1,
        borderColor: "$borderColor",
      },
    },
  } as const,
});

export interface Message {
  id: string;
  role: "user" | "system";
  text: string;
}

export function ChatMessage({ role, text }: { role: "user" | "system"; text: string }) {
  return (
    <Bubble role={role}>
      <Text fontSize="$1" fontFamily="$body" color="$color" whiteSpace="pre-wrap">
        {text}
      </Text>
    </Bubble>
  );
}
