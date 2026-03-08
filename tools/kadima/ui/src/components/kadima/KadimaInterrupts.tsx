import { useToastStore } from "@/lib/toast-store";

export function KadimaInterrupts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  const SEVERITY_COLORS: Record<string, string> = {
    info: "var(--color-text-muted)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    error: "var(--color-error)",
  };

  return (
    <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2" style={{ maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="px-4 py-3 rounded-lg border cursor-pointer"
          style={{
            backgroundColor: "var(--color-bg-card)",
            borderColor: SEVERITY_COLORS[t.severity] || "var(--color-border)",
            animation: t.dismissing ? "toast-out 0.3s ease forwards" : "toast-in 0.3s ease forwards",
          }}
        >
          <span className="text-sm text-text">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
