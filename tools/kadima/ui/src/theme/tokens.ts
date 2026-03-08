/**
 * Converts Ogu THEME.json generated_tokens → Tamagui token format
 */

export interface OguThemeTokens {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    success: string;
    warning: string;
    text: string;
    text_muted: string;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  typography: {
    font_body: string;
    font_heading: string;
    font_mono: string;
  };
  effects: {
    glow: string;
    border_style: string;
    shadow: string;
  };
}

const px = (v: string) => parseInt(v, 10) || 0;

export function oguToTamaguiTokens(tokens: OguThemeTokens) {
  return {
    color: {
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      background: tokens.colors.background,
      surface: tokens.colors.surface,
      error: tokens.colors.error,
      success: tokens.colors.success,
      warning: tokens.colors.warning,
      text: tokens.colors.text,
      textMuted: tokens.colors.text_muted,
    },
    space: {
      1: px(tokens.spacing.xs),
      2: px(tokens.spacing.sm),
      3: px(tokens.spacing.md),
      4: px(tokens.spacing.lg),
      5: px(tokens.spacing.xl),
      6: px(tokens.spacing["2xl"] || "48px"),
      true: px(tokens.spacing.md),
    },
    size: {
      1: 12,
      2: 14,
      3: 16,
      4: 20,
      5: 24,
      6: 32,
      7: 40,
      8: 48,
      true: 16,
    },
    radius: {
      1: px(tokens.radius.sm),
      2: px(tokens.radius.md),
      3: px(tokens.radius.lg),
      true: px(tokens.radius.md),
    },
    zIndex: {
      0: 0,
      1: 100,
      2: 200,
      3: 300,
      4: 400,
      5: 500,
    },
  };
}

export function oguToTamaguiFonts(tokens: OguThemeTokens) {
  return {
    body: {
      family: tokens.typography.font_body,
      size: { 1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6: 24 },
      lineHeight: { 1: 18, 2: 20, 3: 24, 4: 28, 5: 32, 6: 36 },
      weight: { 1: "400", 2: "500", 3: "700" },
      letterSpacing: { 1: 0, 2: 0 },
    },
    heading: {
      family: tokens.typography.font_heading,
      size: { 1: 16, 2: 20, 3: 24, 4: 32, 5: 40, 6: 48 },
      lineHeight: { 1: 24, 2: 28, 3: 32, 4: 40, 5: 48, 6: 56 },
      weight: { 1: "600", 2: "700", 3: "800" },
      letterSpacing: { 1: -0.5, 2: -1 },
    },
    mono: {
      family: tokens.typography.font_mono,
      size: { 1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6: 24 },
      lineHeight: { 1: 18, 2: 20, 3: 24, 4: 28, 5: 32, 6: 36 },
      weight: { 1: "400", 2: "500", 3: "700" },
      letterSpacing: { 1: 0, 2: 0 },
    },
  };
}
