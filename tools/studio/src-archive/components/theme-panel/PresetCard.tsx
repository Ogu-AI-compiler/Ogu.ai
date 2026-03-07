import type { OguThemeTokens } from "@/theme/tokens";

interface Props {
  name: string;
  label: string;
  description: string;
  tokens: OguThemeTokens;
  isActive: boolean;
  onPress: () => void;
}

export function PresetCard({ label, description, tokens, isActive, onPress }: Props) {
  return (
    <div
      onClick={onPress}
      style={{
        backgroundColor: "rgba(22,22,22,0.6)",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: isActive ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)",
        gap: 12,
        width: 200,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#b3b3b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {description}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {[tokens.colors.primary, tokens.colors.secondary, tokens.colors.background, tokens.colors.surface, tokens.colors.error].map((color, i) => (
          <div key={i} style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: color }} />
        ))}
      </div>
      {isActive && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "#d4d4d4" }}>ACTIVE</span>
      )}
    </div>
  );
}
