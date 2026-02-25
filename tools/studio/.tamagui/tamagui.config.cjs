var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/theme/config.ts
var config_exports = {};
__export(config_exports, {
  default: () => config_default
});
module.exports = __toCommonJS(config_exports);
var import_core = require("@tamagui/core");

// src/theme/presets.ts
var presets = {
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
        text_muted: "#7a7a7a"
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: { sm: "4px", md: "8px", lg: "12px" },
      typography: {
        font_body: "'Inter', -apple-system, sans-serif",
        font_heading: "'Inter', -apple-system, sans-serif",
        font_mono: "'SF Mono', 'JetBrains Mono', monospace"
      },
      effects: {
        glow: "none",
        border_style: "1px solid rgba(255,255,255,0.08)",
        shadow: "0 2px 10px rgba(0,0,0,0.4)"
      }
    }
  }
};

// src/theme/config.ts
var inter = (0, import_core.createFont)({
  family: "'Google Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  size: { 1: 12, 2: 13, 3: 14, 4: 16, 5: 18, 6: 20, 7: 24, 8: 30, 9: 36 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 24, 5: 26, 6: 28, 7: 32, 8: 40, 9: 44 },
  weight: { 1: "400", 2: "500", 3: "600", 4: "700" },
  letterSpacing: { 1: 0, 2: -0.2, 3: -0.3 }
});
var mono = (0, import_core.createFont)({
  family: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
  size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 22, 5: 24, 6: 28 },
  weight: { 1: "400", 2: "500", 3: "600" },
  letterSpacing: { 1: 0 }
});
var tokens = (0, import_core.createTokens)({
  color: {
    // Base (shared across themes, overridden by theme values)
    bg: "#101010",
    bgCard: "#161616",
    bgCardHover: "#1c1c1c",
    bgElevated: "#232323",
    bgInput: "#141414",
    border: "rgba(255,255,255,0.08)",
    borderHover: "rgba(255,255,255,0.14)",
    borderFocus: "rgba(200,200,200,0.35)",
    text: "#f2f2f2",
    textSecondary: "#b3b3b3",
    textMuted: "#7a7a7a",
    accent: "#d4d4d4",
    accentHover: "#e4e4e4",
    accentSoft: "rgba(212,212,212,0.12)",
    success: "#3fa36b",
    error: "#d05a5a",
    warning: "#c89b3c",
    info: "#8c8c8c",
    userBubble: "rgba(212,212,212,0.10)",
    oguBubble: "rgba(255,255,255,0.05)",
    // extra slots for presets
    successSoft: "rgba(63,163,107,0.15)",
    errorSoft: "rgba(208,90,90,0.15)",
    warningSoft: "rgba(200,155,60,0.15)",
    infoSoft: "rgba(140,140,140,0.15)"
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 32,
    8: 40,
    9: 48,
    10: 64,
    true: 16
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
    9: 56,
    true: 16
  },
  radius: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 9999,
    true: 12
  },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 }
});
function buildTheme(p) {
  const c = p.tokens.colors;
  return {
    background: c.background,
    backgroundHover: c.surface,
    backgroundPress: c.surface,
    backgroundFocus: c.surface,
    color: c.text,
    colorHover: c.text,
    colorPress: c.text_muted,
    colorFocus: c.text,
    borderColor: `${c.text_muted}20`,
    borderColorHover: `${c.text_muted}30`,
    borderColorFocus: `${c.primary}80`,
    borderColorPress: c.primary,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowColorHover: `${c.primary}25`
  };
}
__name(buildTheme, "buildTheme");
var themes = {};
for (const [name, preset] of Object.entries(presets)) {
  themes[name] = buildTheme(preset);
}
var config = (0, import_core.createTamagui)({
  tokens,
  themes,
  fonts: {
    body: inter,
    heading: inter,
    mono
  },
  defaultFont: "body"
});
var config_default = config;
