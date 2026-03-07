import { useState, useRef, useEffect, useCallback } from "react";
import { Icon, icons } from "@/lib/icons";

interface TermSession {
  id: string;
  label: string;
  type: "shell" | "process";
  lines: string[];
  running: boolean;
}

let _sid = 0;
const sid = () => `t-${++_sid}`;

export function TerminalPanel() {
  const [sessions, setSessions] = useState<TermSession[]>([
    { id: sid(), label: "zsh", type: "shell", lines: [], running: true },
  ]);
  const [activeId, setActiveId] = useState(sessions[0].id);
  const [shellInput, setShellInput] = useState("");
  const [shellLoading, setShellLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = sessions.find((s) => s.id === activeId) || sessions[0];

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [active?.lines.length]);

  const appendLines = useCallback((sessionId: string, newLines: string[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, lines: [...s.lines, ...newLines] } : s
      )
    );
  }, []);

  const addSession = useCallback((label: string, type: "shell" | "process") => {
    const s: TermSession = { id: sid(), label, type, lines: [], running: true };
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    return s.id;
  }, []);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const s: TermSession = { id: sid(), label: "zsh", type: "shell", lines: [], running: true };
        return [s];
      }
      return next;
    });
    setActiveId((prev) => {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length > 0) return remaining[0].id;
      return prev;
    });
  }, [sessions]);

  /* Run a shell command in the active session */
  async function runShellCmd() {
    const cmd = shellInput.trim();
    if (!cmd || shellLoading) return;
    setShellInput("");
    setShellLoading(true);

    appendLines(active.id, [`$ ${cmd}`]);

    try {
      const res = await fetch("/api/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();

      const out = data.stdout?.trim();
      const err = data.stderr?.trim();
      const outLines: string[] = [];
      if (out) outLines.push(...out.split("\n"));
      if (err) outLines.push(...err.split("\n"));
      if (!outLines.length) outLines.push("(no output)");

      appendLines(active.id, outLines);
    } catch (e: any) {
      appendLines(active.id, [`Error: ${e.message}`]);
    }
    setShellLoading(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      backgroundColor: "var(--bg-card)",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "var(--font)", fontSize: 11,
                color: s.id === activeId ? "var(--text)" : "var(--text-muted)",
                backgroundColor: s.id === activeId ? "var(--bg-card-hover)" : "transparent",
                borderRight: "1px solid var(--border)",
                userSelect: "none",
              }}
            >
              <span style={{ display: "inline-flex" }}>{s.type === "shell" ? <Icon d={icons.terminal} size={12} /> : <Icon d={icons.play} size={10} />}</span>
              <span>{s.label}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                style={{
                  cursor: "pointer", padding: "0 2px",
                  color: "var(--text-muted)", borderRadius: 2,
                  display: "inline-flex",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Icon d={icons.x} size={10} />
              </span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
          <button
            onClick={() => addSession("zsh", "shell")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontFamily: "var(--font)", fontSize: 14,
              padding: "2px 4px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            title="New terminal"
          >
            +
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        style={{
          flex: 1, overflow: "auto", padding: "8px 12px",
          fontFamily: "var(--font)", fontSize: 12, lineHeight: "18px",
          color: "var(--text)",
        }}
      >
        {active.lines.map((line, i) => (
          <div key={i} style={{
            color: line.startsWith("$") ? "var(--accent)"
              : line.startsWith("Error") ? "var(--error)"
              : "var(--text)",
            whiteSpace: "pre-wrap",
          }}>
            {line}
          </div>
        ))}
      </div>



    </div>
  );
}
