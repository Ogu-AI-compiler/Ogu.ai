import { useState, useRef, useEffect } from "react";
import { styled, YStack, XStack, Text, ScrollView } from "tamagui";
import { ChatMessage, type Message } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { parseChat } from "@/lib/chat-parser";
import { Icon, icons } from "@/lib/icons";

const Panel = styled(YStack, {
  width: 320,
  height: "100%",
  backgroundColor: "$backgroundHover",
  borderLeftWidth: 1,
  borderLeftColor: "$borderColor",
});

const Header = styled(XStack, {
  padding: "$2",
  borderBottomWidth: 1,
  borderBottomColor: "$borderColor",
  alignItems: "center",
  justifyContent: "space-between",
});

const Toggle = styled(Text, {
  fontSize: "$1",
  color: "$colorPress",
  cursor: "pointer",
  fontFamily: "$body",
  padding: "$2",
  hoverStyle: { color: "$color" },
});

let msgId = 0;

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "system", text: "Welcome to Ogu Studio. Type a command like \"doctor\", \"status\", or \"create feature my-feature\"." },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current?.scrollToEnd) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  async function handleSend(text: string) {
    const userMsg: Message = { id: `msg-${++msgId}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    const parsed = parseChat(text);
    if (parsed.type !== "command") {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${++msgId}`, role: "system", text: "Unrecognized command. Try: doctor, validate, status, create feature <name>, switch <name>, theme <mood>" },
      ]);
      return;
    }

    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `msg-${++msgId}`, role: "system", text: parsed.data.description + "..." },
    ]);

    try {
      const res = await fetch("/api/command/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: parsed.data.command, args: parsed.data.args }),
      });
      const data = await res.json();
      const output = data.stdout?.trim() || `Exit code: ${data.exitCode}`;
      setMessages((prev) => [
        ...prev,
        { id: `msg-${++msgId}`, role: "system", text: output },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${++msgId}`, role: "system", text: `Error: ${err.message}` },
      ]);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Toggle
        position="absolute"
        right={0}
        top="50%"
        backgroundColor="$backgroundHover"
        borderTopLeftRadius="$2"
        borderBottomLeftRadius="$2"
        borderWidth={1}
        borderRightWidth={0}
        borderColor="$borderColor"
        paddingVertical="$3"
        paddingHorizontal="$1"
        style={{ writingMode: "vertical-rl" }}
        onPress={() => setOpen(true)}
      >
        Chat
      </Toggle>
    );
  }

  return (
    <Panel>
      <Header>
        <Text fontSize="$2" fontFamily="$heading" color="$color">
          Ogu Chat
        </Text>
        <Toggle onPress={() => setOpen(false)}><Icon d={icons.x} size={14} /></Toggle>
      </Header>

      <ScrollView flex={1} ref={scrollRef}>
        <YStack padding="$2" gap="$2">
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} text={m.text} />
          ))}
        </YStack>
      </ScrollView>

      <ChatInput onSend={handleSend} disabled={loading} />
    </Panel>
  );
}
