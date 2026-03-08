/**
 * Toast container — fixed bottom-right, Vercel style.
 * CSS-only animations via globals.css keyframes.
 */

import { useToastStore, type ToastSeverity } from "@/lib/toast-store";
import { Icon, icons } from "@/lib/icons";

const severityStyles: Record<ToastSeverity, { border: string; icon: string; iconColor: string }> = {
  info:    { border: "var(--color-border)", icon: icons.circle, iconColor: "var(--color-info)" },
  success: { border: "var(--color-success)", icon: icons.checkCircle, iconColor: "var(--color-success)" },
  warning: { border: "var(--color-warning)", icon: icons.shield, iconColor: "var(--color-warning)" },
  error:   { border: "var(--color-error)", icon: icons.x, iconColor: "var(--color-error)" },
};

function ToastItem({ toast }: { toast: ReturnType<typeof useToastStore.getState>["toasts"][0] }) {
  const dismissToast = useToastStore((s) => s.dismissToast);
  const style = severityStyles[toast.severity];

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg bg-bg-card border shadow-lg max-w-[380px] cursor-pointer"
      style={{
        borderColor: style.border,
        animation: toast.dismissing ? "toast-out 0.3s ease forwards" : "toast-in 0.3s ease",
      }}
      onClick={() => dismissToast(toast.id)}
    >
      <div className="shrink-0 mt-0.5">
        <Icon d={style.icon} size={16} stroke={style.iconColor} />
      </div>
      <span className="text-sm text-text flex-1">{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      style={{ pointerEvents: "auto" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
