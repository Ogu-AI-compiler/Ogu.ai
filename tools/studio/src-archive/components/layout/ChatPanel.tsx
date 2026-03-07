import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage, type Message } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { parseChat } from "@/lib/chat-parser";
import { Icon, icons } from "@/lib/icons";

let msgId = 0;

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "system", text: "Welcome to Ogu Studio. Type a command like \"doctor\", \"status\", or \"create feature my-feature\"." },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      <span
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          backgroundColor: "rgba(255,255,255,0.04)",
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
          borderWidth: 1,
          borderRightWidth: 0,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.08)",
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 4,
          paddingRight: 4,
          writingMode: "vertical-rl" as any,
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          cursor: "pointer",
        }}
      >
        Chat
      </span>
    );
  }

  return (
    <div
      style={{
        width: 320,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderLeftWidth: 1,
        borderLeftStyle: "solid",
        borderLeftColor: "rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottomWidth: 1,
          borderBottomStyle: "solid",
          borderBottomColor: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13 }}>Ogu Chat</span>
        <span
          onClick={() => setOpen(false)}
          style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 8 }}
        >
          <Icon d={icons.x} size={14} />
        </span>
      </div>

      <ScrollArea style={{ flex: 1 }}>
        <div ref={scrollRef} style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} text={m.text} />
          ))}
        </div>
      </ScrollArea>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
