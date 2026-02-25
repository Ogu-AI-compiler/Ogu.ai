import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

const PRESETS = {
  cyberpunk: {
    mood: "cyberpunk",
    description: "Dark, neon-accented, futuristic. Think Blade Runner meets modern SaaS.",
    references: ["cyberpunk 2077 UI", "matrix terminal aesthetic"],
    constraints: {
      dark_mode: true,
      high_contrast: true,
      animations: "subtle-glow",
      typography_feel: "monospace-tech",
      color_palette: "neon-on-dark",
    },
    generated_tokens: {
      colors: {
        primary: "#00ff9f",
        secondary: "#00d4ff",
        background: "#0a0a0f",
        surface: "#1a1a2e",
        error: "#ff0044",
        success: "#00ff9f",
        warning: "#ffb800",
        text: "#e0e0e0",
        text_muted: "#666680",
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: { sm: "2px", md: "4px", lg: "8px" },
      typography: {
        font_body: "'JetBrains Mono', 'Fira Code', monospace",
        font_heading: "'Orbitron', 'Space Grotesk', sans-serif",
        font_mono: "'JetBrains Mono', monospace",
      },
      effects: {
        glow: "0 0 10px rgba(0, 255, 159, 0.3)",
        border_style: "1px solid rgba(0, 255, 159, 0.2)",
        shadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
      },
    },
  },

  minimal: {
    mood: "minimal",
    description: "Clean, white, lots of breathing room. Less is more.",
    references: ["apple.com", "linear.app", "notion"],
    constraints: {
      dark_mode: false,
      high_contrast: false,
      animations: "subtle-fade",
      typography_feel: "clean-sans",
      color_palette: "neutral-with-accent",
    },
    generated_tokens: {
      colors: {
        primary: "#000000",
        secondary: "#6366f1",
        background: "#ffffff",
        surface: "#f8f9fa",
        error: "#ef4444",
        success: "#22c55e",
        warning: "#f59e0b",
        text: "#111827",
        text_muted: "#9ca3af",
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px", "2xl": "64px" },
      radius: { sm: "6px", md: "8px", lg: "12px" },
      typography: {
        font_body: "'Inter', -apple-system, system-ui, sans-serif",
        font_heading: "'Inter', -apple-system, system-ui, sans-serif",
        font_mono: "'SF Mono', 'Fira Code', monospace",
      },
      effects: {
        glow: "none",
        border_style: "1px solid #e5e7eb",
        shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      },
    },
  },

  brutalist: {
    mood: "brutalist",
    description: "Raw, bold, system fonts, visible structure. Function over form.",
    references: ["brutalistwebsites.com", "craigslist", "hacker news"],
    constraints: {
      dark_mode: false,
      high_contrast: true,
      animations: "none",
      typography_feel: "system-mono",
      color_palette: "black-white-accent",
    },
    generated_tokens: {
      colors: {
        primary: "#000000",
        secondary: "#ff0000",
        background: "#ffffff",
        surface: "#f0f0f0",
        error: "#ff0000",
        success: "#008000",
        warning: "#ff8c00",
        text: "#000000",
        text_muted: "#555555",
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: { sm: "0px", md: "0px", lg: "0px" },
      typography: {
        font_body: "'Courier New', 'Courier', monospace",
        font_heading: "'Arial Black', 'Helvetica', sans-serif",
        font_mono: "'Courier New', monospace",
      },
      effects: {
        glow: "none",
        border_style: "3px solid #000000",
        shadow: "none",
      },
    },
  },

  playful: {
    mood: "playful",
    description: "Rounded, colorful, bouncy, friendly. Makes you smile.",
    references: ["duolingo", "notion", "figma"],
    constraints: {
      dark_mode: false,
      high_contrast: false,
      animations: "bouncy",
      typography_feel: "rounded-friendly",
      color_palette: "warm-pastels",
    },
    generated_tokens: {
      colors: {
        primary: "#8b5cf6",
        secondary: "#f472b6",
        background: "#fefce8",
        surface: "#ffffff",
        error: "#f87171",
        success: "#4ade80",
        warning: "#fbbf24",
        text: "#1e1b4b",
        text_muted: "#6b7280",
      },
      spacing: { xs: "6px", sm: "10px", md: "18px", lg: "28px", xl: "40px", "2xl": "56px" },
      radius: { sm: "12px", md: "16px", lg: "24px" },
      typography: {
        font_body: "'Nunito', 'Quicksand', sans-serif",
        font_heading: "'Fredoka One', 'Nunito', sans-serif",
        font_mono: "'Fira Code', monospace",
      },
      effects: {
        glow: "none",
        border_style: "2px solid #e9d5ff",
        shadow: "0 4px 14px rgba(139, 92, 246, 0.15)",
      },
    },
  },

  corporate: {
    mood: "corporate",
    description: "Professional, blue-gray, trustworthy. Means business.",
    references: ["salesforce", "microsoft", "stripe dashboard"],
    constraints: {
      dark_mode: false,
      high_contrast: false,
      animations: "subtle-fade",
      typography_feel: "professional-serif",
      color_palette: "blue-gray",
    },
    generated_tokens: {
      colors: {
        primary: "#1e40af",
        secondary: "#3b82f6",
        background: "#f8fafc",
        surface: "#ffffff",
        error: "#dc2626",
        success: "#16a34a",
        warning: "#d97706",
        text: "#1e293b",
        text_muted: "#64748b",
      },
      spacing: { xs: "4px", sm: "8px", md: "14px", lg: "20px", xl: "28px", "2xl": "40px" },
      radius: { sm: "4px", md: "6px", lg: "8px" },
      typography: {
        font_body: "'Roboto', 'Segoe UI', sans-serif",
        font_heading: "'Georgia', 'Times New Roman', serif",
        font_mono: "'Roboto Mono', monospace",
      },
      effects: {
        glow: "none",
        border_style: "1px solid #e2e8f0",
        shadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
      },
    },
  },

  "retro-pixel": {
    mood: "retro-pixel",
    description: "8-bit aesthetic, pixel fonts, sharp edges. Nostalgic and fun.",
    references: ["retro game UIs", "terminal green-on-black", "early web"],
    constraints: {
      dark_mode: true,
      high_contrast: true,
      animations: "none",
      typography_feel: "pixel",
      color_palette: "8-bit",
    },
    generated_tokens: {
      colors: {
        primary: "#00ff00",
        secondary: "#ffff00",
        background: "#0c0c0c",
        surface: "#1a1a1a",
        error: "#ff0000",
        success: "#00ff00",
        warning: "#ffff00",
        text: "#00ff00",
        text_muted: "#008800",
      },
      spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: { sm: "0px", md: "0px", lg: "0px" },
      typography: {
        font_body: "'Press Start 2P', 'VT323', monospace",
        font_heading: "'Press Start 2P', monospace",
        font_mono: "'VT323', 'Press Start 2P', monospace",
      },
      effects: {
        glow: "0 0 8px rgba(0, 255, 0, 0.4)",
        border_style: "2px solid #00ff00",
        shadow: "none",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function theme() {
  const args = process.argv.slice(3);
  const subcommand = args[0];

  switch (subcommand) {
    case "set":
      return themeSet(args);
    case "show":
      return themeShow();
    case "apply":
      return themeApply();
    case "presets":
      return themePresets();
    default:
      console.log("Usage: ogu theme <subcommand>");
      console.log("");
      console.log("  set <mood>    Set design theme (preset name or custom mood)");
      console.log("  show          Show current theme");
      console.log("  apply         Apply theme tokens to design.tokens.json");
      console.log("  presets       List available preset themes");
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function themeSet(args) {
  const mood = args[1];
  if (!mood) {
    console.error("  ERROR  Mood required. Usage: ogu theme set <mood>");
    console.error(`  Presets: ${Object.keys(PRESETS).join(", ")}`);
    return 1;
  }

  const root = repoRoot();
  let themeData;

  if (PRESETS[mood]) {
    themeData = { version: 1, ...PRESETS[mood] };
    console.log(`  theme    ${mood} (preset)`);
  } else {
    // Custom mood — create with empty tokens for /architect to fill
    themeData = {
      version: 1,
      mood,
      description: `Custom theme: ${mood}. Tokens should be generated by the /architect skill based on this mood.`,
      references: [],
      constraints: {},
      generated_tokens: {
        colors: {},
        spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
        radius: { sm: "6px", md: "8px", lg: "12px" },
        typography: {},
        effects: {},
      },
    };
    console.log(`  theme    ${mood} (custom — run /architect to generate tokens)`);
  }

  const themePath = join(root, ".ogu/THEME.json");
  writeFileSync(themePath, JSON.stringify(themeData, null, 2) + "\n", "utf-8");
  console.log("  saved    .ogu/THEME.json");

  // Show key tokens
  if (themeData.generated_tokens?.colors?.primary) {
    const c = themeData.generated_tokens.colors;
    console.log(`  colors   primary=${c.primary} bg=${c.background} text=${c.text}`);
  }
  if (themeData.generated_tokens?.typography?.font_body) {
    console.log(`  font     ${themeData.generated_tokens.typography.font_body.split(",")[0]}`);
  }

  return 0;
}

function themeShow() {
  const root = repoRoot();
  const themePath = join(root, ".ogu/THEME.json");
  const theme = readJsonSafe(themePath);

  if (!theme) {
    console.log("  No theme set. Run: ogu theme set <mood>");
    console.log(`  Presets: ${Object.keys(PRESETS).join(", ")}`);
    return 0;
  }

  console.log(`\n  Theme: ${theme.mood}`);
  console.log(`  ${theme.description}`);

  if (theme.references?.length > 0) {
    console.log(`  References: ${theme.references.join(", ")}`);
  }

  if (theme.constraints && Object.keys(theme.constraints).length > 0) {
    console.log("\n  Constraints:");
    for (const [k, v] of Object.entries(theme.constraints)) {
      console.log(`    ${k}: ${v}`);
    }
  }

  if (theme.generated_tokens?.colors && Object.keys(theme.generated_tokens.colors).length > 0) {
    console.log("\n  Colors:");
    for (const [k, v] of Object.entries(theme.generated_tokens.colors)) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
  }

  if (theme.generated_tokens?.typography && Object.keys(theme.generated_tokens.typography).length > 0) {
    console.log("\n  Typography:");
    for (const [k, v] of Object.entries(theme.generated_tokens.typography)) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
  }

  if (theme.generated_tokens?.radius) {
    console.log("\n  Radius:");
    for (const [k, v] of Object.entries(theme.generated_tokens.radius)) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
  }

  if (theme.generated_tokens?.effects && Object.keys(theme.generated_tokens.effects).length > 0) {
    console.log("\n  Effects:");
    for (const [k, v] of Object.entries(theme.generated_tokens.effects)) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
  }

  console.log("");
  return 0;
}

function themeApply() {
  const root = repoRoot();
  const themePath = join(root, ".ogu/THEME.json");
  const theme = readJsonSafe(themePath);

  if (!theme?.generated_tokens) {
    console.error("  ERROR  No theme set. Run: ogu theme set <mood>");
    return 1;
  }

  const hasColors = theme.generated_tokens.colors && Object.keys(theme.generated_tokens.colors).length > 0;
  if (!hasColors) {
    console.error("  ERROR  Theme has no color tokens. Run /architect to generate tokens for custom themes.");
    return 1;
  }

  const tokensPath = join(root, "docs/vault/02_Contracts/design.tokens.json");
  const existing = readJsonSafe(tokensPath) || {};

  const newVersion = bumpPatch(existing.version || "1.0.0");
  const merged = {
    version: newVersion,
    last_updated: new Date().toISOString(),
    changelog: [
      ...(existing.changelog || []),
      {
        version: newVersion,
        date: new Date().toISOString().split("T")[0],
        summary: `Applied theme: ${theme.mood}`,
      },
    ],
    colors: theme.generated_tokens.colors || {},
    spacing: theme.generated_tokens.spacing || {},
    radius: theme.generated_tokens.radius || {},
    typography: theme.generated_tokens.typography || {},
    effects: theme.generated_tokens.effects || {},
  };

  writeFileSync(tokensPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  console.log(`  applied  Theme "${theme.mood}" → design.tokens.json (v${newVersion})`);
  return 0;
}

function themePresets() {
  console.log("\n  Available theme presets:\n");
  for (const [name, preset] of Object.entries(PRESETS)) {
    const colors = preset.generated_tokens.colors;
    console.log(`  ${name.padEnd(14)} ${preset.description}`);
    console.log(`  ${" ".repeat(14)} primary=${colors.primary} bg=${colors.background}`);
    console.log("");
  }
  console.log("  Set a theme: ogu theme set <name>");
  console.log("  Custom mood: ogu theme set <any-mood-description>");
  return 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bumpPatch(version) {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}
