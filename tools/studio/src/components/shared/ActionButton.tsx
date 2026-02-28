import { useState } from "react";
import { styled, Text, XStack } from "tamagui";

const Btn = styled(XStack, {
  borderRadius: "$2",
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  gap: "$1",
  variants: {
    variant: {
      primary: {
        backgroundColor: "rgba(108,92,231,0.2)",
        borderWidth: 1,
        borderColor: "rgba(108,92,231,0.3)",
        hoverStyle: { backgroundColor: "rgba(108,92,231,0.3)" },
      },
      success: {
        backgroundColor: "rgba(74,222,128,0.15)",
        borderWidth: 1,
        borderColor: "rgba(74,222,128,0.25)",
        hoverStyle: { backgroundColor: "rgba(74,222,128,0.25)" },
      },
      danger: {
        backgroundColor: "rgba(239,68,68,0.15)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.25)",
        hoverStyle: { backgroundColor: "rgba(239,68,68,0.25)" },
      },
      ghost: {
        backgroundColor: "rgba(255,255,255,0.04)",
        hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" },
      },
    },
  } as const,
  defaultVariants: { variant: "primary" },
});

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
    <Btn
      variant={variant}
      onPress={handlePress}
      opacity={disabled || loading ? 0.5 : 1}
      pointerEvents={disabled || loading ? "none" : "auto"}
    >
      <Text fontSize={size === "sm" ? 11 : "$2"} fontWeight="600" color={color}>
        {loading ? "..." : label}
      </Text>
    </Btn>
  );
}
