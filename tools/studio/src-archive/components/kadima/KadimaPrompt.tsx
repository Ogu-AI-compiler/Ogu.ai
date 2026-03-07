/**
 * KadimaPrompt — compact command prompt pinned to the bottom of the OS shell.
 * Routes through resolveIntent(): kadima → inline, ogu → inline, claude → Chat.
 */

import { useState, useRef, useEffect } from "react";
import { resolveIntent } from "@/lib/kadima-intent";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";

export function KadimaPrompt({ overlay }: { overlay?: boolean }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const setRoute = useStore((s) => s.setRoute);
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage);
  const setCmdkOpen = useStore((s) => s.setCmdkOpen);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const intent = resolveIntent(trimmed);
    setInput("");
    setOutput(null);

    if (intent.route === "kadima") {
      setLoading(true);
      try {
        const result = await runKadimaInline(intent.kadimaAction!, intent.kadimaArgs);
        setOutput(result);
      } catch (err: any) {
        setOutput(`Error: ${err.message}`);
      }
      setLoading(false);
      return;
    }

    if (intent.route === "ogu" && intent.oguCommand?.type === "command") {
      setLoading(true);
      const { command, args } = intent.oguCommand.data;
      try {
        const res = await fetch("/api/command/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, args }),
        });
        const data = await res.json();
        setOutput(data.stdout?.trim() || "(no output)");
      } catch (err: any) {
        setOutput(`Error: ${err.message}`);
      }
      setLoading(false);
      return;
    }

    // Claude — navigate to Chat and pass message
    if (overlay) setCmdkOpen(false);
    setPendingChatMessage(trimmed);
    setRoute("/chat");
  }

  return (
    <div className={`flex flex-col gap-2 ${overlay ? "" : "border-t border-border pt-4"}`}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-text-muted text-sm font-mono shrink-0">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={loading ? "Running..." : "Ask Kadima, run a command, or talk to Claude..."}
          disabled={loading}
          className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-muted font-mono"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="shrink-0 px-2 py-1 rounded text-xs text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-30"
        >
          <Icon d={icons.play} size={12} />
        </button>
      </form>
      {output && (
        <div className="rounded-lg border border-border bg-bg p-3 max-h-[200px] overflow-auto">
          <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}

async function runKadimaInline(action: string, args?: Record<string, string>): Promise<string> {
  let data: any;
  switch (action) {
    case "status":
    case "health":
      data = await api.getKadimaDashboard().catch(() => api.getKadimaHealth());
      break;
    case "standup":
    case "morning-brief":
      data = await api.getKadimaStandup();
      break;
    case "budget":
      data = await api.getBudget();
      break;
    case "who-working":
      data = await api.getAgents();
      break;
    case "next-task": {
      const sched = await api.getKadimaScheduler();
      const pending = (sched?.queue || []).filter((t: any) => t.status === "pending" || t.status === "queued");
      data = pending[0] || { message: "No pending tasks" };
      break;
    }
    case "approve":
      if (args?.taskId) data = await api.approveGovernance(args.taskId);
      else data = { error: "Missing task ID" };
      break;
    case "deny":
      if (args?.taskId) data = await api.denyGovernance(args.taskId, "Denied via prompt");
      else data = { error: "Missing task ID" };
      break;
    default:
      data = { message: `Unknown action: ${action}` };
  }
  return typeof data === "string" ? data
    : data?.stdout?.trim() || data?.message || JSON.stringify(data, null, 2);
}
