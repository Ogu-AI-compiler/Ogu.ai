import { useState } from "react";
import { styled, YStack, XStack, Text, Input } from "tamagui";
import { useCommand } from "@/hooks/useCommand";

const Page = styled(YStack, {
  flex: 1,
  padding: "$7",
  gap: "$4",
});

const TermContainer = styled(YStack, {
  flex: 1,
  backgroundColor: "rgba(15,15,23,0.9)",
  borderRadius: "$4",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
  overflow: "hidden",
});

const OutputArea = styled(YStack, {
  flex: 1,
  padding: "$4",
  overflow: "scroll",
});

const InputBar = styled(XStack, {
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,0.06)",
  padding: "$3",
  paddingHorizontal: "$4",
  gap: "$3",
  alignItems: "center",
});

const RunBtn = styled(YStack, {
  backgroundColor: "#d4d4d4",
  borderRadius: "$2",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "#e4e4e4" },
});

export function TerminalView() {
  const [input, setInput] = useState("");
  const cmd = useCommand();

  function handleRun() {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    cmd.runSync(parts[0], parts.slice(1));
    setInput("");
  }

  return (
    <Page>
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>Terminal</Text>
        <Text fontSize="$4" color="#b3b3b3">Run any ogu command directly</Text>
      </YStack>

      <TermContainer>
        <OutputArea>
          {cmd.output.length === 0 ? (
            <Text fontSize="$2" fontFamily="$body" color="#7a7a7a">
              Type a command below and press Enter...
            </Text>
          ) : (
            cmd.output.map((line, i) => (
              <Text key={i} fontSize="$2" fontFamily="$body" color="$color" lineHeight={22}>
                {line}
              </Text>
            ))
          )}
          {cmd.exitCode != null && (
            <Text
              fontSize="$2"
              fontFamily="$body"
              color={cmd.exitCode === 0 ? "#3fa36b" : "#d05a5a"}
              marginTop="$2"
            >
              exit {cmd.exitCode}
            </Text>
          )}
        </OutputArea>

        <InputBar>
          <Text fontSize="$2" fontFamily="$body" color="#d4d4d4" fontWeight="600">ogu</Text>
          <Input
            flex={1}
            size="$3"
            placeholder="command [args]"
            placeholderTextColor="#7a7a7a"
            value={input}
            onChangeText={setInput}
            fontFamily="$body"
            backgroundColor="transparent"
            borderWidth={0}
            color="$color"
            onSubmitEditing={handleRun}
            disabled={cmd.loading}
          />
          <RunBtn onPress={handleRun}>
            <Text fontSize="$2" color="white" fontWeight="600">
              {cmd.loading ? "..." : "Run"}
            </Text>
          </RunBtn>
        </InputBar>
      </TermContainer>
    </Page>
  );
}
