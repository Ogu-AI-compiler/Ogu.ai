import { useEffect } from "react";
import { presets } from "@/theme/presets";

/**
 * Sets CSS custom properties on :root from the dark preset.
 * Every component using var(--xxx) updates instantly.
 */

function getVars() {
  const c = presets.dark.tokens.colors;
  return {
    "--bg": "#101010",
    "--bg-card": "#161616",
    "--bg-card-hover": "#1c1c1c",
    "--bg-input": "#141414",
    "--border": "rgba(255,255,255,0.08)",
    "--border-hover": "rgba(255,255,255,0.14)",
    "--text": c.text,
    "--text-secondary": c.text_muted,
    "--text-muted": "#7a7a7a",
    "--accent": "#d4d4d4",
    "--accent-hover": "#e4e4e4",
    "--accent-soft": "rgba(212,212,212,0.12)",
    "--accent-text": "#000000",
    "--success": c.success,
    "--error": c.error,
    "--warning": c.warning,
    "--gradient": "linear-gradient(135deg, #101010 0%, #161616 50%, #101010 100%)",
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
