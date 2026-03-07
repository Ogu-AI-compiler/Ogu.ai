/**
 * CmdKOverlay — global command palette triggered by Cmd+K.
 * Uses KadimaPrompt in overlay mode.
 */

import { useStore } from "@/lib/store";
import { KadimaPrompt } from "./KadimaPrompt";

export function CmdKOverlay() {
  const setCmdkOpen = useStore((s) => s.setCmdkOpen);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[20vh]"
      onClick={() => setCmdkOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Palette */}
      <div
        className="relative w-full max-w-[560px] rounded-xl border border-border bg-bg-card p-4 shadow-2xl"
        style={{ animation: "boot-fade-in 0.15s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted font-medium">Kadima Command Palette</span>
          <kbd className="text-[10px] text-text-muted border border-border rounded px-1.5 py-0.5 font-mono">
            Esc
          </kbd>
        </div>
        <KadimaPrompt overlay />
      </div>
    </div>
  );
}
