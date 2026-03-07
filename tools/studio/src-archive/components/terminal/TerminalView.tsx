import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useCommand } from "@/hooks/useCommand";

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
    <div style={{ flex: 1, padding: 28, gap: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Terminal</span>
        <span style={{ fontSize: 16, color: "#b3b3b3" }}>Run any ogu command directly</span>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: "rgba(15,15,23,0.9)",
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: 16,
            overflow: "scroll",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {cmd.output.length === 0 ? (
            <span style={{ fontSize: 13, color: "#7a7a7a" }}>
              Type a command below and press Enter...
            </span>
          ) : (
            cmd.output.map((line, i) => (
              <span key={i} style={{ fontSize: 13, lineHeight: "22px" }}>{line}</span>
            ))
          )}
          {cmd.exitCode != null && (
            <span
              style={{
                fontSize: 13,
                color: cmd.exitCode === 0 ? "#3fa36b" : "#d05a5a",
                marginTop: 8,
              }}
            >
              exit {cmd.exitCode}
            </span>
          )}
        </div>

        <div
          style={{
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "rgba(255,255,255,0.06)",
            padding: 12,
            paddingLeft: 16,
            paddingRight: 16,
            gap: 12,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "#d4d4d4", fontWeight: 600 }}>ogu</span>
          <Input
            style={{ flex: 1 }}
            placeholder="command [args]"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            disabled={cmd.loading}
          />
          <button
            onClick={handleRun}
            style={{
              backgroundColor: "#d4d4d4",
              borderRadius: 8,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              cursor: "pointer",
              border: "none",
              color: "white",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {cmd.loading ? "..." : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
