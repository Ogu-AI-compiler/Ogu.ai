import * as React from "react";
import { cn } from "@/lib/cn";

type StatusDotVariant = "success" | "error" | "warning" | "info" | "neutral";

const variantColors: Record<StatusDotVariant, string> = {
  success: "bg-success",
  error: "bg-error",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-text-muted",
};

interface StatusDotProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusDotVariant;
  color?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  glow?: boolean;
}

const sizeMap = { sm: "w-1.5 h-1.5", md: "w-2 h-2", lg: "w-2.5 h-2.5" };

const StatusDot = React.forwardRef<HTMLDivElement, StatusDotProps>(
  ({ variant = "neutral", color, size = "md", pulse, glow, className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "shrink-0 rounded-full",
        sizeMap[size],
        !color && variantColors[variant],
        pulse && "animate-pulse",
        className
      )}
      style={{
        ...(color ? { backgroundColor: color } : {}),
        ...(glow && color ? { boxShadow: `0 0 6px ${color}80` } : {}),
        ...style,
      }}
      {...props}
    />
  )
);
StatusDot.displayName = "StatusDot";

export { StatusDot };
export type { StatusDotVariant };
