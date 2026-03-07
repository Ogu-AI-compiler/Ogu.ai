import { useState } from "react";

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: "rgba(108,92,231,0.2)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(108,92,231,0.3)",
  },
  success: {
    backgroundColor: "rgba(74,222,128,0.15)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(74,222,128,0.25)",
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(239,68,68,0.25)",
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "none",
  },
};

const VARIANT_COLORS = {
  primary: "#a78bfa",
  success: "#4ade80",
  danger: "#ef4444",
  ghost: "#888",
};

interface ActionButtonProps {
  label: string;
  variant?: "primary" | "success" | "danger" | "ghost";
  onAction: () => Promise<any> | void;
  confirm?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function ActionButton({ label, variant = "primary", onAction, confirm, disabled, size = "sm" }: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (disabled || loading) return;
    if (confirm && !window.confirm(confirm)) return;
    setLoading(true);
    try {
      await onAction();
    } finally {
      setLoading(false);
    }
  };

  const color = VARIANT_COLORS[variant];

  return (
    <button
      onClick={handlePress}
      style={{
        borderRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled || loading ? "default" : "pointer",
        gap: 4,
        opacity: disabled || loading ? 0.5 : 1,
        pointerEvents: disabled || loading ? "none" : "auto",
        ...VARIANT_STYLES[variant],
      }}
    >
      <span style={{ fontSize: size === "sm" ? 11 : 13, fontWeight: 600, color }}>
        {loading ? "..." : label}
      </span>
    </button>
  );
}
