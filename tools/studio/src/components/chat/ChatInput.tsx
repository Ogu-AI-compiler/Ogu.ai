import { useState } from "react";
import { styled, XStack, Input, Button } from "tamagui";

const Bar = styled(XStack, {
  borderTopWidth: 1,
  borderTopColor: "$borderColor",
  padding: "$2",
  gap: "$2",
  alignItems: "center",
});

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  function handle() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <Bar>
      <Input
        flex={1}
        size="$2"
        placeholder="Type a command or question..."
        value={text}
        onChangeText={setText}
        fontFamily="$body"
        backgroundColor="transparent"
        borderWidth={0}
        color="$color"
        onSubmitEditing={handle}
        disabled={disabled}
      />
      <Button
        size="$2"
        backgroundColor={disabled ? "$borderColor" : "#d4d4d4"}
        color="#0a0a0f"
        onPress={handle}
        disabled={disabled}
      >
        Send
      </Button>
    </Bar>
  );
}
