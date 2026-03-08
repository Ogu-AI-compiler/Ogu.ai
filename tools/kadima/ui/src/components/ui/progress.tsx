import * as React from "react";
import { cn } from "@/lib/cn";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  color?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "h-1", md: "h-1.5", lg: "h-2.5" };

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, max = 100, color, size = "md", className, ...props }, ref) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div
        ref={ref}
        className={cn("w-full overflow-hidden rounded-full bg-border", sizeMap[size], className)}
        {...props}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color || "var(--color-text)" }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
