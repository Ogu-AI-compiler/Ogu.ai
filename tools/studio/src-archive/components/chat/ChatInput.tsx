import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div
      style={{
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: "rgba(255,255,255,0.08)",
        padding: 8,
        gap: 8,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Input
        style={{ flex: 1 }}
        placeholder="Type a command or question..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handle()}
        disabled={disabled}
      />
      <Button
        style={{
          backgroundColor: disabled ? "rgba(255,255,255,0.08)" : "#d4d4d4",
          color: "#0a0a0f",
        }}
        onClick={handle}
        disabled={disabled}
      >
        Send
      </Button>
    </div>
  );
}
