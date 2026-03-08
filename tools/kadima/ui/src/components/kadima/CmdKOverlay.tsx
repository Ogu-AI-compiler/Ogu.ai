import { useStore } from "@/store";

export function CmdKOverlay() {
  const setCmdkOpen = useStore((s) => s.setCmdkOpen);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setCmdkOpen(false); }}
    >
      <div className="w-[520px] bg-bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
        <input
          autoFocus
          placeholder="Type a command..."
          className="w-full px-4 py-3 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-muted"
          onKeyDown={(e) => { if (e.key === "Escape") setCmdkOpen(false); }}
        />
        <div className="border-t border-border px-4 py-2">
          <span className="text-[11px] text-text-muted">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
