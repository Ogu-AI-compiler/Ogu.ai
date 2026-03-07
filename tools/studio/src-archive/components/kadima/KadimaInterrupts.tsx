/**
 * KadimaInterrupts — headless component bridging WebSocket events → toasts.
 * Mounted in App.tsx. No visual output.
 */

import { useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";

export function KadimaInterrupts() {
  const { on } = useSocket();
  const { toast } = useToast();

  useEffect(() => {
    const unsubs = [
      on("budget:exhausted", (e: any) => {
        toast(`Budget exhausted — ${e.spent ?? "?"}/${e.limit ?? "?"}`, { severity: "error", duration: 0 });
      }),
      on("budget:alert", (e: any) => {
        toast(`Budget warning: ${e.percent ?? "?"}% used`, { severity: "warning" });
      }),
      on("agent:completed", (e: any) => {
        toast(`Agent ${e.roleId ?? "agent"} completed ${e.taskId ?? "task"}`, { severity: "success" });
      }),
      on("agent:failed", (e: any) => {
        toast(`Agent ${e.roleId ?? "agent"} failed: ${e.reason ?? "unknown"}`, { severity: "error" });
      }),
      on("compile:started", (e: any) => {
        toast(`Compilation started for ${e.slug ?? "feature"}`, { severity: "info" });
      }),
      on("compile:completed", (e: any) => {
        const ok = e.passed || e.success;
        toast(`Compilation ${ok ? "passed" : "failed"}${e.slug ? ` — ${e.slug}` : ""}`, {
          severity: ok ? "success" : "error",
        });
      }),
      on("governance:approval_required", (e: any) => {
        toast(`Approval needed: ${e.description ?? e.taskId ?? "action"}`, { severity: "warning", duration: 8000 });
      }),
      on("task:dispatched", (e: any) => {
        toast(`Task ${e.taskId ?? "?"} dispatched to ${e.roleId ?? "agent"}`, { severity: "info", duration: 3000 });
      }),
      on("wave:started", (e: any) => {
        toast(`Wave ${e.wave ?? "?"} started — ${e.taskCount ?? "?"} tasks`, { severity: "info" });
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [on, toast]);

  return null;
}
