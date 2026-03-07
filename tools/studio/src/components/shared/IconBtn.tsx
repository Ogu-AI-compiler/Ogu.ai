/** Shared icon button — glass pill with 3D inset shadow. */
import React from "react";

const SHADOW = "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset";
const SHADOW_HOVER = "rgba(99,241,157,0.35) -8px -6px 4px -8px inset, rgba(255,255,255,0.3) 6px 6px 4px -5px inset";
const SHADOW_ACTIVE = "rgba(99,241,157,0.12) -4px -3px 4px -8px inset, rgba(255,255,255,0.12) 3px 3px 4px -5px inset";

// Green accent variant (for primary action buttons)
const SHADOW_GREEN = "rgba(99,241,157,0.5) -8px -6px 4px -8px inset, rgba(255,255,255,0.4) 6px 6px 4px -5px inset, 0 0 10px rgba(99,241,157,0.2) inset";
const SHADOW_GREEN_HOVER = "rgba(99,241,157,0.7) -8px -6px 4px -8px inset, rgba(255,255,255,0.5) 6px 6px 4px -5px inset, 0 0 14px rgba(99,241,157,0.3) inset";
const SHADOW_GREEN_ACTIVE = "rgba(99,241,157,0.3) -4px -3px 4px -8px inset, rgba(255,255,255,0.25) 3px 3px 4px -5px inset";

export function IconBtn({
  onClick,
  children,
  size = 30,
  title,
  disabled,
  style,
  className,
  variant = "default",
}: {
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  size?: number;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  variant?: "default" | "green";
}) {
  const shadow     = variant === "green" ? SHADOW_GREEN        : SHADOW;
  const shadowHov  = variant === "green" ? SHADOW_GREEN_HOVER  : SHADOW_HOVER;
  const shadowAct  = variant === "green" ? SHADOW_GREEN_ACTIVE : SHADOW_ACTIVE;
  const bg         = variant === "green" ? "rgba(99,241,157,0.18)" : "rgba(70,70,70,0.3)";
  const bgHov      = variant === "green" ? "rgba(99,241,157,0.24)" : "rgba(70,70,70,0.38)";
  const bgAct      = variant === "green" ? "rgba(99,241,157,0.12)" : "rgba(70,70,70,0.42)";

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        background: bg,
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: shadow,
        borderRadius: 8,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "box-shadow 0.15s, background 0.15s",
        color: "currentColor",
        ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = shadowHov;
        e.currentTarget.style.background = bgHov;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadow;
        e.currentTarget.style.background = bg;
      }}
      onMouseDown={e => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = shadowAct;
        e.currentTarget.style.background = bgAct;
      }}
      onMouseUp={e => {
        e.currentTarget.style.boxShadow = shadowHov;
        e.currentTarget.style.background = bgHov;
      }}
    >
      {children}
    </button>
  );
}
