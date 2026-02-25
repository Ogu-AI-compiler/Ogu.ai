import type { OguThemeTokens } from "./tokens";

export const presets: Record<string, { label: string; description: string; tokens: OguThemeTokens }> = {
  dark: {
    label: "Dark",
    description: "Dark mode",
    tokens: {
      colors: {
        primary: "#d4d4d4",
        secondary: "#b3b3b3",
        background: "#101010",
        surface: "#161616",
        error: "#d05a5a",
        success: "#3fa36b",
        warning: "#c89b3c",
        text: "#f2f2f2",
        text_muted: "#7a7a7a",
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: { sm: "4px", md: "8px", lg: "12px" },
      typography: {
        font_body: "'Inter', -apple-system, sans-serif",
        font_heading: "'Inter', -apple-system, sans-serif",
        font_mono: "'SF Mono', 'JetBrains Mono', monospace",
      },
      effects: {
        glow: "none",
        border_style: "1px solid rgba(255,255,255,0.08)",
        shadow: "0 2px 10px rgba(0,0,0,0.4)",
      },
    },
  },

};
