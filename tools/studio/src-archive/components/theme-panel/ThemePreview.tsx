import type { OguThemeTokens } from "@/theme/tokens";

interface Props {
  tokens: OguThemeTokens;
}

export function ThemePreview({ tokens }: Props) {
  const c = tokens.colors;
  const fx = tokens.effects;

  return (
    <div
      style={{
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderStyle: "solid",
        gap: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.background,
        borderColor: c.surface,
      }}
    >
      <span style={{ fontFamily: tokens.typography.font_heading as any, fontSize: 20, color: c.text }}>
        Preview
      </span>
      <span style={{ fontFamily: tokens.typography.font_body as any, fontSize: 14, color: c.text_muted }}>
        Body text with muted secondary content
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            backgroundColor: c.surface,
            borderRadius: parseInt(tokens.radius.md),
            padding: 12,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: c.primary,
            boxShadow: fx.glow !== "none" ? fx.glow : undefined,
          }}
        >
          <span style={{ fontFamily: tokens.typography.font_mono as any, fontSize: 12, color: c.primary }}>
            Primary
          </span>
        </div>
        <div style={{ backgroundColor: c.surface, borderRadius: parseInt(tokens.radius.md), padding: 12 }}>
          <span style={{ fontFamily: tokens.typography.font_mono as any, fontSize: 12, color: c.secondary }}>
            Secondary
          </span>
        </div>
        <div style={{ backgroundColor: c.error, borderRadius: parseInt(tokens.radius.md), padding: 12 }}>
          <span style={{ fontFamily: tokens.typography.font_mono as any, fontSize: 12, color: c.background }}>
            Error
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 60, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
        <div style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: c.secondary }} />
        <div style={{ width: 20, height: 8, borderRadius: 4, backgroundColor: c.text_muted }} />
      </div>
    </div>
  );
}
