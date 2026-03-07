import { useEffect } from "react";
import { presets } from "@/theme/presets";

/**
 * Sets CSS custom properties on :root from the dark preset.
 * Syncs both legacy (--bg) and Tailwind v4 (--color-bg) variables.
 */

function getVars() {
  const c = presets.dark.tokens.colors;
  const bg = "#1a1a1a";
  const bgCard = "#242424";
  const bgCardHover = "#2c2c2c";
  const bgInput = "#1e1e1e";
  const border = "#383838";
  const borderHover = "#4a4a4a";
  const textMuted = "#737373";
  const accent = "#63f19d";
  const accentHover = "#8af4b6";
  const accentSoft = "rgba(99,241,157,0.15)";

  return {
    // Legacy variables (used by inline styles)
    "--bg": bg,
    "--bg-card": bgCard,
    "--bg-card-hover": bgCardHover,
    "--bg-input": bgInput,
    "--border": border,
    "--border-hover": borderHover,
    "--text": c.text,
    "--text-secondary": c.text_muted,
    "--text-muted": textMuted,
    "--accent": accent,
    "--accent-hover": accentHover,
    "--accent-soft": accentSoft,
    "--accent-text": "#1a1a1a",
    "--success": c.success,
    "--error": c.error,
    "--warning": c.warning,
    "--gradient": `linear-gradient(135deg, ${bg} 0%, ${bgCard} 50%, ${bg} 100%)`,

    // Tailwind v4 variables (used by utility classes like bg-bg-card, border-border)
    "--color-bg": bg,
    "--color-bg-card": bgCard,
    "--color-bg-card-hover": bgCardHover,
    "--color-bg-input": bgInput,
    "--color-bg-elevated": "#303030",
    "--color-border": border,
    "--color-border-hover": borderHover,
    "--color-border-focus": accent,
    "--color-text": c.text,
    "--color-text-secondary": c.text_muted,
    "--color-text-muted": textMuted,
    "--color-accent": accent,
    "--color-accent-hover": accentHover,
    "--color-accent-soft": accentSoft,
    "--color-accent-text": "#1a1a1a",
    "--color-success": c.success,
    "--color-success-soft": `${c.success}1f`,
    "--color-error": c.error,
    "--color-error-soft": `${c.error}1f`,
    "--color-warning": c.warning,
    "--color-warning-soft": `${c.warning}1f`,
    "--color-info": "#a3a3a3",
    "--color-info-soft": "rgba(163,163,163,0.12)",
  };
}

export function useThemeCSS() {
  useEffect(() => {
    const vars = getVars();
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.body.style.background = vars["--gradient"];
  }, []);
}
