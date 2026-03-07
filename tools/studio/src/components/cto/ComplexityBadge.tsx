const TIER_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  low:      { bg: "rgba(99, 241, 157, 0.08)", color: "var(--color-accent)", label: "Low" },
  medium:   { bg: "rgba(255, 255, 255, 0.07)", color: "var(--color-text-secondary)", label: "Medium" },
  high:     { bg: "rgba(255, 255, 255, 0.07)", color: "var(--color-text-secondary)", label: "High" },
  critical: { bg: "rgba(255, 100, 100, 0.1)",  color: "rgba(255,120,120,0.9)", label: "Critical" },
};

export function ComplexityBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] || TIER_STYLES.medium;
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}
