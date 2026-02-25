/**
 * brand-scan — Scan a website URL and extract brand DNA
 * (colors, fonts, spacing, radius, effects, tone, icons)
 *
 * Usage:
 *   ogu brand-scan <url> [--deep] [--apply] [--soul]
 *   ogu brand-scan list
 *   ogu brand-scan apply <domain>
 *   ogu brand-scan compare <domain1> <domain2>
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync, rmSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot, readJsonSafe } from "../util.mjs";

/* ────────────────────── Entry ────────────────────── */

export async function brandScan() {
  const args = process.argv.slice(3);
  const sub = args[0];

  if (sub === "list") return brandList();
  if (sub === "apply") return brandApply(args[1]);
  if (sub === "compare") return brandCompare(args[1], args[2]);

  // Default: scan a URL
  return brandScanUrl(args);
}

/* ────────────────────── Scan URL ────────────────────── */

async function brandScanUrl(args) {
  const url = args.find(a => a.startsWith("http"));
  if (!url) {
    console.log("Usage: ogu brand-scan <url> [--deep] [--apply] [--soul]");
    console.log("       ogu brand-scan list");
    console.log("       ogu brand-scan apply <domain>");
    console.log("       ogu brand-scan compare <d1> <d2>");
    return 1;
  }

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {
    console.error(`  ERROR  Invalid URL: ${url}`);
    return 1;
  }

  const deep = args.includes("--deep");
  const applyFlag = args.includes("--apply");
  const soulFlag = args.includes("--soul");
  const root = repoRoot();
  const domain = parsedUrl.hostname.replace(/^www\./, "");

  console.log(`\n  Scanning  ${url}`);
  console.log(`  Mode      ${deep ? "deep (Playwright)" : "lightweight (fetch)"}\n`);

  // Step 1: Fetch HTML
  console.log("  fetch    HTML...");
  let html;
  try {
    html = await fetchPage(url);
  } catch (err) {
    console.error(`  ERROR  Could not fetch URL: ${err.message}`);
    return 1;
  }

  // Step 2: Fetch linked CSS
  const cssLinks = extractCssLinks(html, url);
  console.log(`  fetch    ${cssLinks.length} stylesheet(s)...`);
  let allCss = extractInlineStyles(html).join("\n");
  for (const link of cssLinks.slice(0, 20)) {
    try {
      const cssText = await fetchPage(link);
      allCss += "\n" + cssText;
    } catch { /* skip failed CSS fetch */ }
  }

  // Step 3: Extract everything
  // Full design system from DOM (Playwright), fallback to CSS-only
  let colors;
  let themeVars = {};
  let domDesignSystem = null;
  try {
    await import("playwright");
    console.log("  extract  design system (DOM sampling)...");
    domDesignSystem = await extractDesignSystemFromDom(url);
    colors = domPaletteToColors(domDesignSystem.palette);
    console.log(`  sampled  ${domDesignSystem.palette.clusters.length} color clusters from live DOM`);
    if (domDesignSystem.components.button.primary) console.log("  found    button component spec");
    if (domDesignSystem.components.card) console.log("  found    card component spec");
    if (domDesignSystem.shadows) console.log(`  found    ${Object.keys(domDesignSystem.shadows).length}-level shadow scale`);
    if (domDesignSystem.fontUrls.length > 0) console.log(`  found    ${domDesignSystem.fontUrls.length} font file(s)`);
    // Still extract theme vars for other uses (fonts, etc.)
    themeVars = extractThemeVariables(allCss);
    if (themeVars.framework) console.log(`  detected ${themeVars.framework} theme system`);
  } catch {
    console.log("  extract  colors (CSS frequency)...");
    themeVars = extractThemeVariables(allCss);
    if (themeVars.framework) console.log(`  detected ${themeVars.framework} theme system`);
    const colorCounts = extractAllColors(allCss);
    colors = clusterColors(colorCounts, themeVars);
  }

  console.log("  extract  fonts...");
  const typography = extractFonts(allCss, html, themeVars);

  console.log("  extract  spacing...");
  const spacing = extractSpacing(allCss);

  console.log("  extract  radius...");
  const radius = extractRadius(allCss);

  console.log("  extract  effects...");
  const effects = extractEffects(allCss);

  console.log("  extract  brand tone...");
  const brandTone = extractBrandTone(html);

  console.log("  extract  icons...");
  const icons = extractIconLibrary(html, allCss);

  console.log("  extract  dark mode...");
  const darkMode = extractDarkMode(allCss);
  if (darkMode.has_dark_mode) console.log(`  detected dark mode variant (${darkMode.method})`);

  console.log("  extract  language...");
  const language = extractLanguage(html);
  if (language.lang) console.log(`  detected ${language.lang_name} (${language.lang}), dir: ${language.dir}`);

  console.log("  extract  logos...");
  const logoRefs = extractLogos(html, url);
  console.log(`  found    ${logoRefs.length} logo(s)`);

  console.log("  download logos...");
  const logos = await downloadLogos(logoRefs, domain, root);
  console.log(`  saved    ${logos.length} logo file(s)`);

  // Download font files (from Playwright-intercepted URLs)
  let fontData = { files: [], font_face_css: "" };
  if (domDesignSystem && domDesignSystem.fontUrls.length > 0) {
    console.log("  download fonts...");
    fontData = await downloadFontFiles(domDesignSystem.fontUrls, typography.google_fonts, domain, root);
    console.log(`  saved    ${fontData.files.length} font file(s)`);
  } else if (typography.google_fonts && typography.google_fonts.length > 0) {
    // No Playwright font interception, but we have Google Fonts — generate import CSS
    const families = typography.google_fonts.map(f => f.replace(/ /g, "+")).join("&family=");
    fontData.font_face_css = `@import url('https://fonts.googleapis.com/css2?family=${families}:wght@300;400;500;600;700&display=swap');`;
  }

  // Step 4: Deep mode (optional)
  let deepData = null;
  if (deep) {
    console.log("  deep     launching Playwright...");
    deepData = await deepScan(url, domain, root);
    if (deepData) {
      console.log("  deep     screenshot captured");
      mergeDeepData(colors, typography, deepData);
    }
  }

  // Normalize dark_mode colors: resolve _dark/_light to proper palette based on current mode
  if (darkMode.has_dark_mode && (darkMode.colors._dark || darkMode.colors._light)) {
    const alt = colors.is_dark_mode ? darkMode.colors._light : darkMode.colors._dark;
    if (alt) {
      // Replace heuristic keys with proper role keys
      const normalized = {};
      if (alt.background) normalized.background = alt.background;
      if (alt.text) normalized.text = alt.text;
      if (alt.primary) normalized.primary = alt.primary;
      if (alt.secondary) normalized.secondary = alt.secondary;
      if (alt.surface) normalized.surface = alt.surface;
      darkMode.colors = normalized;
    } else {
      darkMode.colors = {};
    }
  }

  // Step 5: Build brand DNA object
  const brandDna = {
    version: 3,
    domain,
    detected_framework: themeVars.framework || null,
    color_source: colors.source || "frequency",
    url,
    scanned_at: new Date().toISOString(),
    scan_mode: deep && deepData ? "deep" : "lightweight",
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      text_muted: colors.text_muted,
      error: colors.error,
      success: colors.success,
      warning: colors.warning,
      is_dark_mode: colors.is_dark_mode,
      all_extracted: colors.all_extracted.slice(0, 30),
    },
    typography: {
      font_body: typography.font_body,
      font_heading: typography.font_heading,
      font_mono: typography.font_mono,
      google_fonts: typography.google_fonts,
      font_face: typography.font_face,
      font_files: fontData.files,
      font_face_css: fontData.font_face_css,
      type_scale: domDesignSystem?.typography || {},
      all_detected: typography.all_detected.slice(0, 15),
    },
    spacing,
    radius,
    effects,
    components: domDesignSystem?.components || {},
    shadows: domDesignSystem?.shadows || null,
    transitions: domDesignSystem?.transitions || null,
    language,
    dark_mode: darkMode,
    brand_tone: brandTone,
    icons,
    logos,
    deep_scan: deepData ? {
      screenshot: `.ogu/brands/${domain}-screenshot.png`,
      computed_body_bg: deepData.bodyBg,
      computed_body_font: deepData.bodyFont,
      computed_h1_font: deepData.h1Font,
      computed_btn_radius: deepData.btnRadius,
    } : null,
  };

  // Step 6: Write output (clear previous scans — only one brand DNA at a time)
  const brandsDir = join(root, ".ogu/brands");
  mkdirSync(brandsDir, { recursive: true });
  // Remove old brand scans and their logo dirs
  for (const entry of readdirSync(brandsDir)) {
    const entryPath = join(brandsDir, entry);
    if (entry.endsWith(".json") || entry.endsWith("-screenshot.png")) {
      unlinkSync(entryPath);
    } else if (statSync(entryPath).isDirectory() && entry !== domain) {
      rmSync(entryPath, { recursive: true, force: true });
    }
  }
  const brandPath = join(brandsDir, `${domain}.json`);
  writeFileSync(brandPath, JSON.stringify(brandDna, null, 2) + "\n", "utf-8");

  // Build asset pack
  buildAssetPack(root, domain, brandDna, logos, fontData);

  // Summary
  console.log(`\n  saved    .ogu/brands/${domain}.json\n`);
  console.log(`  Brand DNA: ${domain}`);
  console.log(`  ─────────────────────────────`);
  if (themeVars.framework) console.log(`  framework  ${themeVars.framework} (theme vars used)`);
  else console.log(`  source     ${colors.source || "frequency analysis"}`);
  if (colors.primary) console.log(`  primary    ${colors.primary}`);
  if (colors.secondary) console.log(`  secondary  ${colors.secondary}`);
  if (colors.background) console.log(`  background ${colors.background}`);
  if (colors.text) console.log(`  text       ${colors.text}`);
  if (typography.font_body) console.log(`  body font  ${typography.font_body}`);
  if (typography.font_heading && typography.font_heading !== typography.font_body) {
    console.log(`  head font  ${typography.font_heading}`);
  }
  if (brandTone.tone_markers.length > 0) {
    console.log(`  tone       ${brandTone.tone_markers.join(", ")}`);
  }
  if (icons.length > 0) console.log(`  icons      ${icons.join(", ")}`);
  if (logos.length > 0) console.log(`  logos      ${logos.map(l => l.name).join(", ")}`);
  if (fontData.files.length > 0) console.log(`  fonts      ${fontData.files.length} file(s) downloaded`);
  if (brandDna.components?.button?.primary) console.log(`  button     radius=${brandDna.components.button.primary.borderRadius}`);
  if (brandDna.components?.card) console.log(`  card       radius=${brandDna.components.card.borderRadius}`);
  if (brandDna.shadows) console.log(`  shadows    ${Object.keys(brandDna.shadows).length} levels`);
  if (brandDna.transitions) console.log(`  transition ${brandDna.transitions.common}`);
  if (language.lang) console.log(`  language   ${language.lang_name} (${language.dir})`);
  console.log(`  current    ${colors.is_dark_mode ? "dark" : "light"} mode`);
  if (darkMode.has_dark_mode) {
    console.log(`  alt mode   ${colors.is_dark_mode ? "light" : "dark"} available (${darkMode.method})`);
    if (darkMode.colors.background) console.log(`  alt bg     ${darkMode.colors.background}`);
    if (darkMode.colors.text) console.log(`  alt text   ${darkMode.colors.text}`);
  }
  console.log(`  colors     ${colors.all_extracted.length} unique`);
  console.log("");

  // Step 7: Optional apply to THEME.json
  if (applyFlag) {
    applyBrandToTheme(root, brandDna);
  }

  // Step 8: Optional update SOUL.md
  if (soulFlag) {
    updateSoulWithBrand(root, brandDna);
  }

  // Step 9: Log
  try {
    const { log } = await import("./log.mjs");
    await log([`Brand scan: ${domain} (${brandDna.scan_mode})`]);
  } catch { /* skip if log fails */ }

  return 0;
}

/* ────────────────────── Subcommands ────────────────────── */

function brandList() {
  const root = repoRoot();
  const brandsDir = join(root, ".ogu/brands");
  if (!existsSync(brandsDir)) {
    console.log("\n  No brand scans yet. Run: ogu brand-scan <url>\n");
    return 0;
  }
  const files = readdirSync(brandsDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("\n  No brand scans yet.\n");
    return 0;
  }
  console.log("\n  Scanned brands:\n");
  for (const file of files) {
    const data = readJsonSafe(join(brandsDir, file));
    if (!data) continue;
    const primary = data.colors?.primary || "?";
    const font = data.typography?.font_body || "?";
    const mode = data.scan_mode || "?";
    console.log(`  ${(data.domain || file).padEnd(28)} primary=${primary}  font=${font}  (${mode})`);
  }
  console.log(`\n  ${files.length} brand(s) scanned\n`);
  return 0;
}

function brandApply(domain) {
  if (!domain) {
    console.error("Usage: ogu brand-scan apply <domain>");
    return 1;
  }
  const root = repoRoot();
  const brandPath = join(root, `.ogu/brands/${domain}.json`);
  const brandDna = readJsonSafe(brandPath);
  if (!brandDna) {
    console.error(`  ERROR  No brand scan found for "${domain}"`);
    console.error(`  Run: ogu brand-scan https://${domain}`);
    return 1;
  }
  applyBrandToTheme(root, brandDna);
  return 0;
}

function brandCompare(d1, d2) {
  if (!d1 || !d2) {
    console.error("Usage: ogu brand-scan compare <domain1> <domain2>");
    return 1;
  }
  const root = repoRoot();
  const b1 = readJsonSafe(join(root, `.ogu/brands/${d1}.json`));
  const b2 = readJsonSafe(join(root, `.ogu/brands/${d2}.json`));
  if (!b1) { console.error(`  ERROR  No brand scan for "${d1}"`); return 1; }
  if (!b2) { console.error(`  ERROR  No brand scan for "${d2}"`); return 1; }

  console.log(`\n  Brand Comparison: ${d1} vs ${d2}\n`);
  console.log(`  ${"".padEnd(15)} ${d1.padEnd(22)} ${d2}`);
  console.log(`  ${"─".repeat(60)}`);

  const rows = [
    ["primary", b1.colors?.primary, b2.colors?.primary],
    ["secondary", b1.colors?.secondary, b2.colors?.secondary],
    ["background", b1.colors?.background, b2.colors?.background],
    ["text", b1.colors?.text, b2.colors?.text],
    ["dark mode", b1.colors?.is_dark_mode ? "yes" : "no", b2.colors?.is_dark_mode ? "yes" : "no"],
    ["body font", b1.typography?.font_body, b2.typography?.font_body],
    ["head font", b1.typography?.font_heading, b2.typography?.font_heading],
    ["radius sm", b1.radius?.sm, b2.radius?.sm],
    ["radius lg", b1.radius?.lg, b2.radius?.lg],
    ["icons", b1.icons?.join(", ") || "none", b2.icons?.join(", ") || "none"],
    ["tone", b1.brand_tone?.tone_markers?.join(", ") || "none", b2.brand_tone?.tone_markers?.join(", ") || "none"],
  ];

  for (const [label, v1, v2] of rows) {
    const val1 = (v1 || "–").toString().padEnd(22);
    const val2 = (v2 || "–").toString();
    console.log(`  ${label.padEnd(15)} ${val1} ${val2}`);
  }
  console.log("");
  return 0;
}

/* ────────────────────── Fetch ────────────────────── */

export async function fetchPage(url) {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,text/css,application/xhtml+xml,*/*",
    },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

/* ────────────────────── CSS Link Extraction ────────────────────── */

export function extractCssLinks(html, baseUrl) {
  const links = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) links.push(resolveUrl(m[1], baseUrl));
  // Also match href before rel
  const re2 = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["']/gi;
  while ((m = re2.exec(html))) links.push(resolveUrl(m[1], baseUrl));
  return [...new Set(links)];
}

export function extractInlineStyles(html) {
  const styles = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) styles.push(m[1]);
  return styles;
}

/* ────────────────────── Theme Variable Detection ────────────────────── */

/**
 * Smart extraction of CSS framework theme variables.
 * Detects Elementor, Tailwind, Bootstrap, Chakra, MUI, WordPress,
 * and generic naming patterns. Returns semantic color/font mappings
 * that override frequency-based clustering.
 */
export function extractThemeVariables(css) {
  const result = {
    framework: null,
    colors: {},  // { primary, secondary, accent, background, text, surface, ... }
    fonts: {},   // { body, heading, mono }
  };

  // Collect all CSS custom properties
  const varEntries = [];
  const varRe = /--([\w-]+):\s*([^;}\n]+)/g;
  let m;
  while ((m = varRe.exec(css))) {
    varEntries.push({ name: m[1].toLowerCase(), value: m[2].trim() });
  }

  if (varEntries.length === 0) return result;

  // Helper: resolve a value to a hex color (supports hex, rgb, rgba)
  function toHex(val) {
    val = val.trim();
    // Hex
    const hexMatch = val.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
      const p = parseHex(val);
      return p && p.a >= 0.1 ? rgbToHex(p) : null;
    }
    // rgb/rgba
    const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) return rgbToHex({ r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] });
    return null;
  }

  // Helper: extract font name from value
  function toFont(val) {
    const cleaned = val.replace(/["']/g, "").split(",")[0].trim();
    return cleaned && !isGenericFamily(cleaned) ? cleaned : null;
  }

  // ── Elementor ──
  const elementorColors = varEntries.filter(v => v.name.startsWith("e-global-color-"));
  if (elementorColors.length > 0) {
    result.framework = "Elementor";
    // Elementor naming: e-global-color-primary, e-global-color-secondary, e-global-color-text, e-global-color-accent
    // Also has hash-named vars for custom colors: e-global-color-a8c39a7
    for (const v of elementorColors) {
      const hex = toHex(v.value);
      if (!hex) continue;
      const suffix = v.name.replace("e-global-color-", "");
      if (suffix === "primary") result.colors.primary = hex;
      else if (suffix === "secondary") result.colors.secondary = hex;
      else if (suffix === "text") result.colors.text = hex;
      else if (suffix === "accent") result.colors.accent = hex;
      else {
        // Hash-named custom colors — classify by luminance/saturation
        const p = parseHex(hex);
        if (!p) continue;
        const lum = luminance(p);
        const sat = saturation(p);
        if (lum > 0.9 && !result.colors.background) result.colors.background = hex;
        else if (lum > 0.8 && !result.colors.surface) result.colors.surface = hex;
        else if (lum < 0.15 && !result.colors.text) result.colors.text = hex;
        else if (sat < 0.1 && lum > 0.3 && lum < 0.7 && !result.colors.text_muted) result.colors.text_muted = hex;
      }
    }
    // Elementor fonts
    const elementorFonts = varEntries.filter(v => v.name.includes("e-global-typography") && v.name.includes("font-family"));
    for (const v of elementorFonts) {
      const font = toFont(v.value);
      if (!font) continue;
      if (v.name.includes("primary") || v.name.includes("heading")) result.fonts.heading = result.fonts.heading || font;
      else if (v.name.includes("text") || v.name.includes("body")) result.fonts.body = result.fonts.body || font;
      if (!result.fonts.body) result.fonts.body = font;  // fallback: first detected font
    }
    return result;
  }

  // ── Tailwind / generic utility patterns ──
  // --tw-*, --color-primary, --primary, --brand-*, etc.
  const patterns = [
    // Framework detection
    { test: /^tw-/, framework: "Tailwind" },
    { test: /^chakra-/, framework: "Chakra UI" },
    { test: /^bs-/, framework: "Bootstrap" },
    { test: /^mui-/, framework: "Material UI" },
    { test: /^wp--preset--color/, framework: "WordPress" },
  ];
  for (const pat of patterns) {
    if (varEntries.some(v => pat.test.test(v.name))) {
      result.framework = pat.framework;
      break;
    }
  }

  // ── WordPress block theme (--wp--preset--color--*) ──
  const wpColors = varEntries.filter(v => v.name.startsWith("wp--preset--color--"));
  if (wpColors.length > 0) {
    result.framework = result.framework || "WordPress";
    for (const v of wpColors) {
      const hex = toHex(v.value);
      if (!hex) continue;
      const slug = v.name.replace("wp--preset--color--", "");
      if (slug.includes("primary") || slug.includes("brand")) result.colors.primary = result.colors.primary || hex;
      else if (slug.includes("secondary")) result.colors.secondary = result.colors.secondary || hex;
      else if (slug.includes("accent")) result.colors.accent = result.colors.accent || hex;
      else if (slug.includes("background") || slug.includes("base")) result.colors.background = result.colors.background || hex;
      else if (slug.includes("text") || slug.includes("contrast")) result.colors.text = result.colors.text || hex;
    }
  }

  // No generic semantic matching — too unreliable.
  // If no framework was detected, return empty and let frequency analysis handle it.
  return result;
}

// Known framework default colors to filter out
/* ────────────────────── Dark Mode Detection ────────────────────── */

/**
 * Detect if the site has a dark/light mode toggle and extract alternate palette.
 * Checks: prefers-color-scheme media queries, .dark/.light class selectors,
 * data-theme attributes, Elementor dark vars, Tailwind dark: prefix.
 */
export function extractDarkMode(css) {
  const result = {
    has_dark_mode: false,
    method: null,    // "media-query" | "class-toggle" | "data-attr" | "css-vars"
    colors: {},      // alternate palette colors
  };

  // Helper to extract colors from a CSS block
  function extractColorsFromBlock(block) {
    const colors = {};
    const varRe = /--([\w-]+):\s*([^;}\n]+)/g;
    let m;
    while ((m = varRe.exec(block))) {
      const name = m[1].toLowerCase();
      const val = m[2].trim();
      const hex = toHexSafe(val);
      if (!hex) continue;
      // Map to roles by name
      if (name.includes("background") || name.includes("-bg")) colors.background = colors.background || hex;
      else if (name.includes("text") || name.includes("foreground")) colors.text = colors.text || hex;
      else if (name.includes("primary")) colors.primary = colors.primary || hex;
      else if (name.includes("secondary")) colors.secondary = colors.secondary || hex;
      else if (name.includes("surface") || name.includes("card")) colors.surface = colors.surface || hex;
      else if (name.includes("accent")) colors.accent = colors.accent || hex;
      else if (name.includes("muted")) colors.text_muted = colors.text_muted || hex;
    }
    return colors;
  }

  function toHexSafe(val) {
    const hexMatch = val.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
      const p = parseHex(val);
      return p && p.a >= 0.1 ? rgbToHex(p) : null;
    }
    const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) return rgbToHex({ r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] });
    return null;
  }

  // 1. @media (prefers-color-scheme: dark/light)
  const mediaRe = /@media\s*\([^)]*prefers-color-scheme:\s*(dark|light)\s*\)\s*\{([\s\S]*?\})\s*\}/gi;
  let m;
  while ((m = mediaRe.exec(css))) {
    result.has_dark_mode = true;
    result.method = "media-query";
    const altColors = extractColorsFromBlock(m[2]);
    Object.assign(result.colors, altColors);
  }

  // 2. Class-based: .dark, .dark-mode, .theme-dark, html.dark
  const classPatterns = [
    /(?:html|body|\:root)?\.dark(?:-mode|-theme)?\s*\{([\s\S]*?)\}/gi,
    /(?:html|body|\:root)?\.light(?:-mode|-theme)?\s*\{([\s\S]*?)\}/gi,
  ];
  for (const re of classPatterns) {
    while ((m = re.exec(css))) {
      if (!result.has_dark_mode) {
        result.has_dark_mode = true;
        result.method = "class-toggle";
      }
      const altColors = extractColorsFromBlock(m[1]);
      if (Object.keys(altColors).length > 0) Object.assign(result.colors, altColors);
    }
  }

  // 3. data-theme / data-mode attributes
  const dataRe = /\[data-(?:theme|mode|color-scheme)=["']?(dark|light)["']?\]\s*\{([\s\S]*?)\}/gi;
  while ((m = dataRe.exec(css))) {
    if (!result.has_dark_mode) {
      result.has_dark_mode = true;
      result.method = "data-attr";
    }
    const altColors = extractColorsFromBlock(m[2]);
    if (Object.keys(altColors).length > 0) Object.assign(result.colors, altColors);
  }

  // 4. Elementor dark mode vars
  const elementorDarkRe = /--e-global-color-[\w-]+dark[\w-]*:\s*([^;}\n]+)/gi;
  while ((m = elementorDarkRe.exec(css))) {
    const hex = toHexSafe(m[1].trim());
    if (hex) {
      if (!result.has_dark_mode) {
        result.has_dark_mode = true;
        result.method = "css-vars";
      }
    }
  }

  // 5. Simple heuristic: if CSS has both very dark and very light bg vars, there's likely a toggle
  if (!result.has_dark_mode) {
    const bgVars = [];
    const textVars = [];
    const bgRe = /--([\w-]*(?:bg|background)[\w-]*):\s*([^;}\n]+)/gi;
    while ((m = bgRe.exec(css))) {
      const hex = toHexSafe(m[2].trim());
      if (!hex) continue;
      const p = parseHex(hex);
      if (p) bgVars.push({ name: m[1], hex, lum: luminance(p) });
    }
    const textRe = /--([\w-]*(?:text|foreground|fg)[\w-]*):\s*([^;}\n]+)/gi;
    while ((m = textRe.exec(css))) {
      const hex = toHexSafe(m[2].trim());
      if (!hex) continue;
      const p = parseHex(hex);
      if (p) textVars.push({ name: m[1], hex, lum: luminance(p) });
    }
    const hasVeryDark = bgVars.some(v => v.lum < 0.15);
    const hasVeryLight = bgVars.some(v => v.lum > 0.85);
    if (hasVeryDark && hasVeryLight) {
      result.has_dark_mode = true;
      result.method = "css-vars";
      // Save alternate palette with proper role keys
      const darkBg = bgVars.find(v => v.lum < 0.15);
      const lightBg = bgVars.find(v => v.lum > 0.85);
      const darkText = textVars.find(v => v.lum > 0.7);
      const lightText = textVars.find(v => v.lum < 0.3);
      // Store both palettes; we'll pick the alternate in the main flow
      result.colors._dark = { background: darkBg?.hex, text: darkText?.hex };
      result.colors._light = { background: lightBg?.hex, text: lightText?.hex };
    }
  }

  return result;
}


/* ────────────────────── Color Extraction ────────────────────── */

export function extractAllColors(css) {
  const counts = new Map();

  // Hex colors
  const hexRe = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
  let m;
  while ((m = hexRe.exec(css))) {
    const parsed = parseHex(m[0]);
    if (parsed && parsed.a >= 0.1) {
      const hex = rgbToHex(parsed);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }

  // rgb/rgba
  const rgbRe = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
  while ((m = rgbRe.exec(css))) {
    const c = { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
    if (c.a >= 0.1) {
      const hex = rgbToHex(c);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }

  // hsl/hsla
  const hslRe = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*([\d.]+)\s*)?\)/g;
  while ((m = hslRe.exec(css))) {
    const c = hslToRgb(+m[1], +m[2], +m[3]);
    c.a = m[4] != null ? +m[4] : 1;
    if (c.a >= 0.1) {
      const hex = rgbToHex(c);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }

  // CSS custom properties with color values
  const varRe = /--[\w-]+:\s*(#[0-9a-fA-F]{3,8})\b/g;
  while ((m = varRe.exec(css))) {
    const parsed = parseHex(m[1]);
    if (parsed && parsed.a >= 0.1) {
      const hex = rgbToHex(parsed);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }

  return counts;
}

/* ────────────────────── Color Clustering ────────────────────── */

export function clusterColors(colorCounts, themeVars = {}) {
  if (colorCounts.size === 0 && !Object.keys(themeVars.colors || {}).length) {
    return {
      primary: null, secondary: null, background: null, surface: null,
      text: null, text_muted: null, error: null, success: null, warning: null,
      is_dark_mode: false, all_extracted: [], source: "none",
    };
  }

  const sorted = [...colorCounts.entries()]
    .map(([hex, count]) => ({ hex, count, ...parseHex(hex) }))
    .filter(c => c.r !== undefined)
    .sort((a, b) => b.count - a.count);

  // ── Theme variable overrides (highest priority) ──
  const tv = themeVars.colors || {};
  const hasThemeColors = Object.values(tv).some(Boolean);

  if (hasThemeColors) {
    // Theme variables win. Fill in gaps from frequency clustering.
    const primaryHex = tv.primary || tv.accent || null;
    const secondaryHex = tv.secondary || tv.accent || null;
    const bgHex = tv.background || null;
    const textHex = tv.text || null;
    const surfaceHex = tv.surface || null;
    const mutedHex = tv.text_muted || null;

    // Determine dark mode from theme bg or frequency
    let isDarkMode = false;
    if (bgHex) {
      const bgP = parseHex(bgHex);
      isDarkMode = bgP ? luminance(bgP) < 0.4 : false;
    } else {
      const highLumTotal = sorted.filter(c => luminance(c) > 0.85).reduce((s, c) => s + c.count, 0);
      const lowLumTotal = sorted.filter(c => luminance(c) < 0.15).reduce((s, c) => s + c.count, 0);
      isDarkMode = lowLumTotal > highLumTotal;
    }

    // Fill gaps from frequency for roles that theme didn't provide
    const fallback = clusterFromFrequency(sorted, isDarkMode);

    // Semantic colors from frequency (error/success/warning rarely in theme vars)
    const saturated = sorted.filter(c => saturation(c) > 0.3 && luminance(c) > 0.05 && luminance(c) < 0.95);
    const error = saturated.find(c => { const h = rgbToHue(c); return (h < 20 || h > 340) && saturation(c) > 0.4; });
    const success = saturated.find(c => { const h = rgbToHue(c); return h > 90 && h < 170 && saturation(c) > 0.3; });
    const warning = saturated.find(c => { const h = rgbToHue(c); return h > 25 && h < 65 && saturation(c) > 0.3; });

    const all_extracted = sorted.map(c => ({ hex: c.hex, count: c.count, role: null }));

    return {
      primary: primaryHex || fallback.primary,
      secondary: secondaryHex !== primaryHex ? secondaryHex : fallback.secondary,
      background: bgHex || fallback.background,
      surface: surfaceHex || fallback.surface,
      text: textHex || fallback.text,
      text_muted: mutedHex || fallback.text_muted,
      error: error?.hex || null,
      success: success?.hex || null,
      warning: warning?.hex || null,
      is_dark_mode: isDarkMode,
      all_extracted,
      source: themeVars.framework || "theme-vars",
    };
  }

  // ── No theme vars: use original frequency-based clustering ──
  const highLumTotal = sorted.filter(c => luminance(c) > 0.85).reduce((s, c) => s + c.count, 0);
  const lowLumTotal = sorted.filter(c => luminance(c) < 0.15).reduce((s, c) => s + c.count, 0);
  const isDarkMode = lowLumTotal > highLumTotal;
  const result = clusterFromFrequency(sorted, isDarkMode);

  const saturated = sorted.filter(c => saturation(c) > 0.3 && luminance(c) > 0.05 && luminance(c) < 0.95);
  const error = saturated.find(c => { const h = rgbToHue(c); return (h < 20 || h > 340) && saturation(c) > 0.4; });
  const success = saturated.find(c => { const h = rgbToHue(c); return h > 90 && h < 170 && saturation(c) > 0.3; });
  const warning = saturated.find(c => { const h = rgbToHue(c); return h > 25 && h < 65 && saturation(c) > 0.3; });

  const roleMap = new Map();
  if (result.primary) roleMap.set(result.primary, "primary");
  if (result.secondary) roleMap.set(result.secondary, "secondary");
  if (result.background) roleMap.set(result.background, "background");
  if (result.surface) roleMap.set(result.surface, "surface");
  if (result.text) roleMap.set(result.text, "text");
  if (result.text_muted) roleMap.set(result.text_muted, "text_muted");

  const all_extracted = sorted.map(c => ({ hex: c.hex, count: c.count, role: roleMap.get(c.hex) || null }));

  return {
    ...result,
    error: error?.hex || null,
    success: success?.hex || null,
    warning: warning?.hex || null,
    is_dark_mode: isDarkMode,
    all_extracted,
    source: "frequency",
  };
}

/** Pure frequency-based clustering (used as fallback) */
function clusterFromFrequency(sorted, isDarkMode) {
  if (sorted.length === 0) {
    return { primary: null, secondary: null, background: null, surface: null, text: null, text_muted: null };
  }

  const bgCandidates = isDarkMode
    ? sorted.filter(c => luminance(c) < 0.2)
    : sorted.filter(c => luminance(c) > 0.8);
  const background = bgCandidates[0] || sorted[0];

  const textCandidates = isDarkMode
    ? sorted.filter(c => luminance(c) > 0.7)
    : sorted.filter(c => luminance(c) < 0.3);
  const text = textCandidates[0] || sorted[sorted.length - 1];

  const saturated = sorted.filter(c =>
    saturation(c) > 0.3 && luminance(c) > 0.05 && luminance(c) < 0.95
  );
  const primary = saturated[0] || null;

  // Secondary must be far enough from primary AND have meaningful frequency (at least 1/8 of primary)
  const minSecondaryCount = primary ? Math.max(primary.count * 0.12, 5) : 5;
  const secondary = primary
    ? saturated.find(c => c !== primary && c.count >= minSecondaryCount && colorDistance(c, primary) > 80) || null
    : saturated[1] || null;

  const surface = sorted.find(c =>
    c !== background &&
    Math.abs(luminance(c) - luminance(background)) < 0.15 &&
    colorDistance(c, background) > 10
  ) || null;

  const bgLum = luminance(background);
  const textLum = luminance(text);
  const minLum = Math.min(bgLum, textLum);
  const maxLum = Math.max(bgLum, textLum);
  const used = new Set([primary, secondary, background, surface, text].filter(Boolean).map(c => c.hex || c));
  const textMuted = sorted.find(c =>
    !used.has(c.hex) &&
    saturation(c) < 0.3 &&  // must be grayish, not a saturated brand color
    luminance(c) > minLum + 0.1 && luminance(c) < maxLum - 0.1
  ) || null;

  return {
    primary: primary?.hex || null,
    secondary: secondary?.hex || null,
    background: background?.hex || null,
    surface: surface?.hex || null,
    text: text?.hex || null,
    text_muted: textMuted?.hex || null,
  };
}

/* ────────────────────── DOM-based Color Extraction (Playwright) ────────────────────── */
// Samples computed styles from the live DOM, clusters in OKLab perceptual space,
// and assigns brand roles by visual weight — not CSS text frequency.

function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function oklabDistance(c1, c2) {
  const dL = c1.L - c2.L, da = c1.a - c2.a, db = c1.b - c2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function mixWeightedRgb(a, wa, b, wb) {
  const w = wa + wb;
  if (w <= 0) return a;
  return {
    r: Math.round((a.r * wa + b.r * wb) / w),
    g: Math.round((a.g * wa + b.g * wb) / w),
    b: Math.round((a.b * wa + b.b * wb) / w),
    a: Math.max(0, Math.min(1, (a.a * wa + b.a * wb) / w)),
  };
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function saturationHsv(rgb) {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max <= 0 ? 0 : (max - min) / max;
}

/** Collect CSS custom properties (color values) from same-origin stylesheets — runs in browser */
async function collectCssVarsSameOrigin(page) {
  return page.evaluate(() => {
    const out = {};
    const origin = location.origin;
    const isSameOrigin = (ss) => {
      try { const h = ss.href; if (!h) return true; return new URL(h, origin).origin === origin; }
      catch { return false; }
    };
    const isColor = (v) => {
      const s = v.trim().toLowerCase();
      return s.startsWith("#") || s.startsWith("rgb") || s.startsWith("hsl");
    };
    const addVars = (style) => {
      for (let i = 0; i < style.length; i++) {
        const p = style[i];
        if (!p.startsWith("--")) continue;
        const v = style.getPropertyValue(p).trim();
        if (v && isColor(v)) out[p] = v;
      }
    };
    addVars(getComputedStyle(document.documentElement));
    for (const ss of Array.from(document.styleSheets)) {
      if (!isSameOrigin(ss)) continue;
      try { for (const r of Array.from(ss.cssRules)) { if ("style" in r) addVars(r.style); } }
      catch { /* CORS blocked */ }
    }
    return out;
  });
}

/** Sample computed styles from visible DOM elements — runs in browser */
async function collectComputedSamples(page, maxNodes = 3000) {
  return page.evaluate((maxN) => {
    const samples = [];
    const vw = window.innerWidth, vh = window.innerHeight;

    // Browser UA default colors to filter out
    const UA_DEFAULTS = new Set([
      "rgb(0, 0, 238)",    // unvisited link
      "rgb(85, 26, 139)",  // visited link
    ]);

    const parse = (s) => {
      s = (s || "").trim().toLowerCase();
      if (!s || s === "transparent") return null;
      const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
      if (m) {
        const r = Math.round(+m[1]), g = Math.round(+m[2]), b = Math.round(+m[3]);
        const a = m[4] == null ? 1 : +m[4];
        return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)),
                 b: Math.max(0, Math.min(255, b)), a: Math.max(0, Math.min(1, a)) };
      }
      return null;
    };

    const isVis = (el, rect) => {
      if (rect.width < 2 || rect.height < 2) return false;
      // Don't filter by viewport position — sample ALL rendered elements.
      // isAboveFold handles weighting; we want brand colors from the whole page.
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const op = parseFloat(st.opacity || "1");
      return !(Number.isFinite(op) && op <= 0.02);
    };

    const isInteractive = (el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "a" || tag === "button" || tag === "input" || tag === "select") return true;
      const role = el.getAttribute("role") || "";
      if (["button", "link", "tab", "menuitem"].includes(role)) return true;
      const ti = el.getAttribute("tabindex");
      return ti != null && ti !== "-1";
    };

    const hasText = (el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "svg") return false;
      return (el.innerText || "").trim().length > 0;
    };

    // Saturation for weight boost on vivid brand colors
    const sat = (rgba) => {
      const r = rgba.r / 255, g = rgba.g / 255, b = rgba.b / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      return max <= 0 ? 0 : (max - min) / max;
    };

    const all = Array.from(document.querySelectorAll("body *"));
    // Sample all visible elements (no stepping) — clustering handles the volume
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest("iframe")) continue;
      const rect = el.getBoundingClientRect();
      if (!isVis(el, rect)) continue;

      const st = getComputedStyle(el);
      const area = rect.width * rect.height;
      // Use sqrt(area) for backgrounds to avoid huge containers dominating everything
      const bgWeight = Math.sqrt(area) * 50;
      const aboveFold = rect.top < vh * 1.1 && rect.bottom > 0;
      const interactive = isInteractive(el);
      const tag = el.tagName.toLowerCase();

      // Background
      const bg = parse(st.backgroundColor);
      if (bg && bg.a > 0.02) {
        samples.push({ rgba: bg, kind: "bg", weight: bgWeight, isInteractive: interactive,
          isAboveFold: aboveFold, nodeTag: tag });
      }

      // Text color
      if (hasText(el)) {
        const rawColor = st.color;
        // Skip browser default link colors (not styled by the site)
        // Check el or any parent <a> — children inherit the default link color
        const isUaDefault = (tag === "a" || el.closest("a")) && UA_DEFAULTS.has(rawColor);
        const c = !isUaDefault ? parse(rawColor) : null;
        if (c && c.a > 0.02) {
          // Boost saturated text (brand colors in headlines/CTAs are usually vivid)
          const s = sat(c);
          const colorBoost = s > 0.3 ? 1 + s * 2 : 1;
          const w = Math.max(20, Math.min(area, 30000)) * colorBoost;
          samples.push({ rgba: c, kind: "text", weight: w, isInteractive: interactive,
            isAboveFold: aboveFold, nodeTag: tag });
        }
      }

      // Border (low weight)
      const bc = parse(st.borderTopColor);
      const bw = parseFloat(st.borderTopWidth || "0");
      if (bc && bc.a > 0.02 && bw > 0.5) {
        samples.push({ rgba: bc, kind: "border", weight: Math.min(bgWeight, 500) * 0.15,
          isInteractive: interactive, isAboveFold: aboveFold, nodeTag: tag });
      }

      // SVG fill/stroke
      if (tag === "svg" || el.closest("svg")) {
        const fill = parse(st.fill || "");
        if (fill && fill.a > 0.02) {
          const s = sat(fill);
          samples.push({ rgba: fill, kind: "fill", weight: Math.min(bgWeight, 800) * (0.35 + s * 0.5),
            isInteractive: interactive, isAboveFold: aboveFold, nodeTag: tag });
        }
        const stroke = parse(st.stroke || "");
        if (stroke && stroke.a > 0.02) {
          samples.push({ rgba: stroke, kind: "stroke", weight: Math.min(bgWeight, 600) * 0.25,
            isInteractive: interactive, isAboveFold: aboveFold, nodeTag: tag });
        }
      }
    }
    return samples;
  }, maxNodes);
}

/** Cluster samples in OKLab perceptual space */
function clusterSamplesOklab(samples, distanceThreshold = 0.045) {
  const clusters = [];
  let nextId = 1;

  for (const s of samples) {
    if (s.rgba.a <= 0.02) continue;
    const lab = rgbToOklab(s.rgba);
    let best = null, bestD = Infinity;
    for (const c of clusters) {
      const d = oklabDistance(lab, c.lab);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best || bestD > distanceThreshold) {
      const byKind = { bg: 0, text: 0, border: 0, fill: 0, stroke: 0 };
      byKind[s.kind] = s.weight;
      clusters.push({
        id: nextId++, lab, rgba: { ...s.rgba },
        weightTotal: s.weight, weightByKind: byKind,
        weightInteractive: s.isInteractive ? s.weight : 0,
        weightAboveFold: s.isAboveFold ? s.weight : 0,
        matchedVarNames: [],
      });
    } else {
      best.rgba = mixWeightedRgb(best.rgba, best.weightTotal, s.rgba, s.weight);
      best.lab = rgbToOklab(best.rgba);
      best.weightTotal += s.weight;
      best.weightByKind[s.kind] += s.weight;
      if (s.isInteractive) best.weightInteractive += s.weight;
      if (s.isAboveFold) best.weightAboveFold += s.weight;
    }
  }
  clusters.sort((a, b) => b.weightTotal - a.weightTotal);
  return clusters;
}

/** Boost cluster confidence if matched to CSS custom properties */
function matchClustersToVars(clusters, cssVars) {
  const parsed = [];
  for (const [name, val] of Object.entries(cssVars)) {
    const p = parseHex(val) || parseCssColor(val);
    if (!p || (p.a != null && p.a <= 0.02)) continue;
    parsed.push({ name, rgba: p });
  }
  for (const c of clusters) {
    const cLab = c.lab;
    c.matchedVarNames = parsed
      .filter(v => oklabDistance(cLab, rgbToOklab(v.rgba)) <= 0.03)
      .map(v => v.name)
      .slice(0, 8);
  }
}

function parseCssColor(val) {
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  return null;
}

function pickRole(clusters, predicate, score) {
  let best = null, bestScore = -Infinity;
  for (const c of clusters) {
    if (!predicate(c)) continue;
    const s = score(c);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best;
}

function computeConfidence(c, opts = {}) {
  const interactiveShare = c.weightInteractive / Math.max(1, c.weightTotal);
  const aboveFoldShare = c.weightAboveFold / Math.max(1, c.weightTotal);
  const varBonus = c.matchedVarNames.length > 0 ? 0.18 : 0;
  let conf = 0.45;
  conf += 0.25 * clamp01(Math.log10(1 + c.weightTotal) / 6);
  conf += 0.15 * clamp01(aboveFoldShare);
  if (opts.preferInteractive) conf += 0.20 * clamp01(interactiveShare);
  if (opts.preferVars) conf += varBonus;
  return clamp01(conf);
}

/** Assign brand roles from clusters based on visual weight and context */
function buildBrandPalette(clusters) {
  if (clusters.length === 0) return { background: null, surface: null, text: null, primary: null, secondary: null, accent: null, isDark: false, clusters };

  // Determine if dark mode from dominant background
  const dominantBg = pickRole(clusters, c => c.weightByKind.bg > 0, c => c.weightByKind.bg);
  const isDark = dominantBg ? luminance(dominantBg.rgba) < 0.35 : false;

  const background = pickRole(clusters,
    c => c.weightByKind.bg > 0,
    c => {
      const L = luminance(c.rgba);
      const target = isDark ? 0.05 : 0.95;
      return c.weightByKind.bg * (0.5 + 0.5 * (1 - Math.min(1, Math.abs(L - target) / 0.95)));
    });

  const text = pickRole(clusters,
    c => {
      if (c.weightByKind.text <= 0) return false;
      const L = luminance(c.rgba);
      // Text must be near-black (light mode) or near-white (dark mode)
      return isDark ? L > 0.5 : L < 0.25;
    },
    c => {
      const L = luminance(c.rgba);
      const target = isDark ? 0.92 : 0.05;
      const closeness = 1 - Math.min(1, Math.abs(L - target) / 0.5);
      return c.weightByKind.text * closeness * closeness; // quadratic — strongly prefer dark/light
    });

  const surface = pickRole(clusters,
    c => {
      if (c.weightByKind.bg <= 0 || !background || c.id === background.id) return false;
      // Surface must be close to background (not a vivid color)
      const d = oklabDistance(rgbToOklab(c.rgba), rgbToOklab(background.rgba));
      return d < 0.15 && saturationHsv(c.rgba) < 0.15;
    },
    c => {
      if (!background) return c.weightByKind.bg;
      const d = oklabDistance(rgbToOklab(c.rgba), rgbToOklab(background.rgba));
      return c.weightByKind.bg * (0.6 + 0.4 * clamp01(1 - Math.abs(d - 0.05) / 0.08));
    });

  const primary = pickRole(clusters,
    c => {
      const sat = saturationHsv(c.rgba), L = luminance(c.rgba);
      if (sat < 0.25 || L < 0.04 || L > 0.96) return false;
      const notBg = !background || oklabDistance(rgbToOklab(c.rgba), rgbToOklab(background.rgba)) > 0.05;
      const notText = !text || oklabDistance(rgbToOklab(c.rgba), rgbToOklab(text.rgba)) > 0.05;
      return notBg && notText;
    },
    c => {
      const sat = saturationHsv(c.rgba);
      const varBonus = c.matchedVarNames.length > 0 ? 1.18 : 1.0;
      // Brand primary = used in backgrounds (badges, buttons, nav) and interactive elements
      // Text weight is IGNORED — body text colors are not brand primaries
      const brandSignal = c.weightByKind.bg + c.weightInteractive * 2
        + c.weightByKind.fill * 1.5 + c.weightByKind.stroke;
      return brandSignal * (0.5 + sat) * varBonus;
    });

  const secondary = pickRole(clusters,
    c => {
      if (!primary) return false;
      const d = oklabDistance(rgbToOklab(c.rgba), rgbToOklab(primary.rgba));
      const sat = saturationHsv(c.rgba);
      if (d < 0.08 || sat < 0.25) return false;
      if (c.id === background?.id || c.id === text?.id || c.id === surface?.id) return false;
      // Must have meaningful brand signal (bg/interactive usage)
      const brandSignal = c.weightByKind.bg + c.weightInteractive * 2 + c.weightByKind.fill * 1.5;
      return brandSignal > 0;
    },
    c => {
      if (!primary) return -Infinity;
      const sat = saturationHsv(c.rgba);
      const varBonus = c.matchedVarNames.length > 0 ? 1.12 : 1.0;
      const brandSignal = c.weightByKind.bg + c.weightInteractive * 2 + c.weightByKind.fill * 1.5;
      return brandSignal * (0.5 + sat) * varBonus;
    });

  const accent = pickRole(clusters,
    c => {
      const sat = saturationHsv(c.rgba);
      if (sat < 0.22) return false;
      if (primary && c.id === primary.id) return false;
      if (secondary && c.id === secondary.id) return false;
      if (background && oklabDistance(rgbToOklab(c.rgba), rgbToOklab(background.rgba)) < 0.05) return false;
      if (text && oklabDistance(rgbToOklab(c.rgba), rgbToOklab(text.rgba)) < 0.05) return false;
      return true;
    },
    c => {
      const iShare = c.weightInteractive / Math.max(1, c.weightTotal);
      const afShare = c.weightAboveFold / Math.max(1, c.weightTotal);
      const sat = saturationHsv(c.rgba);
      const varBonus = c.matchedVarNames.length > 0 ? 1.1 : 1.0;
      return Math.sqrt(c.weightTotal) * (0.55 + 0.6 * clamp01(iShare + afShare)) * (0.9 + 0.8 * sat) * varBonus;
    });

  // Secondary must meet confidence threshold
  const secondaryFinal = secondary && computeConfidence(secondary, { preferInteractive: true, preferVars: true }) >= 0.55
    ? secondary : null;

  const fmt = (c, opts) => c ? { hex: rgbToHex(c.rgba), confidence: computeConfidence(c, opts), clusterId: c.id } : null;

  return {
    background: fmt(background, { preferVars: true }),
    surface: fmt(surface, { preferVars: true }),
    text: fmt(text, { preferVars: true }),
    primary: fmt(primary, { preferInteractive: true, preferVars: true }),
    secondary: fmt(secondaryFinal, { preferInteractive: true, preferVars: true }),
    accent: fmt(accent, { preferInteractive: true, preferVars: true }),
    isDark,
    clusters,
  };
}

/** Main entry: extract brand colors from live DOM via Playwright */
export async function extractColorsFromDom(url) {
  // Thin wrapper for backward compatibility (used by reference.mjs)
  const ds = await extractDesignSystemFromDom(url);
  return ds.palette;
}

/**
 * Extract full design system from live DOM via Playwright.
 * Single browser session for: colors, typography, components, shadows, transitions, fonts.
 */
export async function extractDesignSystemFromDom(url) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    // Intercept font file responses BEFORE navigation
    const fontUrls = [];
    page.on("response", (response) => {
      const resUrl = response.url();
      const ct = response.headers()["content-type"] || "";
      if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(resUrl) || ct.includes("font/")) {
        fontUrls.push({ url: resUrl, contentType: ct, status: response.status() });
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000); // let styles + images load

    // Run ALL extractions in parallel on the same loaded page
    const [vars, colorSamples, typeSamples, componentSamples, shadowSamples, transitionSamples] =
      await Promise.all([
        collectCssVarsSameOrigin(page).catch(() => ({})),
        collectComputedSamples(page, 2500),
        collectTypographySamples(page).catch(() => ({})),
        collectComponentSamples(page).catch(() => ({ buttons: [], cards: [], inputs: [] })),
        collectShadowSamples(page).catch(() => []),
        collectTransitionSamples(page).catch(() => ({ transitions: [], animations: [] })),
      ]);

    // Process colors (existing logic)
    const cleaned = colorSamples.filter(s => s.rgba.a > 0.02);
    const clusters = clusterSamplesOklab(cleaned, 0.045);
    matchClustersToVars(clusters, vars);
    const palette = buildBrandPalette(clusters);

    // Process new extractions
    const typography = processTypographySamples(typeSamples);
    const components = processComponentSamples(componentSamples, palette);
    const shadows = processShadowSamples(shadowSamples);
    const transitions = processTransitionSamples(transitionSamples);

    return { palette, typography, components, shadows, transitions, fontUrls };
  } finally {
    await browser.close();
  }
}

/* ── DOM Collection: Typography ── */
async function collectTypographySamples(page) {
  return page.evaluate(() => {
    const result = {};
    const roles = [
      { key: "h1", sel: "h1" },
      { key: "h2", sel: "h2" },
      { key: "h3", sel: "h3" },
      { key: "body", sel: "p" },
      { key: "small", sel: "small, figcaption, [class*='caption'], [class*='subtitle']" },
    ];
    for (const { key, sel } of roles) {
      // Find first VISIBLE element with non-zero font size
      const all = document.querySelectorAll(sel);
      let found = null;
      for (const el of all) {
        const st = getComputedStyle(el);
        const fs = parseFloat(st.fontSize);
        if (fs < 1 || st.display === "none" || st.visibility === "hidden" || st.opacity === "0") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        found = { st, fs };
        break;
      }
      if (!found) continue;
      const { st, fs } = found;
      const lh = st.lineHeight;
      result[key] = {
        fontSize: st.fontSize,
        fontWeight: st.fontWeight,
        lineHeight: lh === "normal" ? "1.5" : String(Math.round((parseFloat(lh) / fs) * 100) / 100),
        letterSpacing: st.letterSpacing === "normal" ? "0" : st.letterSpacing,
        fontFamily: st.fontFamily.split(",")[0].trim().replace(/['"]/g, ""),
      };
    }
    return result;
  });
}

/* ── DOM Collection: Components (buttons, cards, inputs) ── */
async function collectComponentSamples(page) {
  return page.evaluate(() => {
    const result = { buttons: [], cards: [], inputs: [] };
    const VH = window.innerHeight;

    // Helper: parse rgb to check saturation
    function parseSat(rgb) {
      const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) return 0;
      const [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      return max === 0 ? 0 : (max - min) / max;
    }

    // Buttons
    const btnSels = 'button, a[class*="btn"], a[class*="button"], [role="button"], input[type="submit"], input[type="button"]';
    const buttons = Array.from(document.querySelectorAll(btnSels)).slice(0, 20);
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 24 || rect.width > 600) continue;
      const st = getComputedStyle(btn);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") continue;
      result.buttons.push({
        backgroundColor: st.backgroundColor,
        color: st.color,
        borderRadius: st.borderRadius,
        padding: st.padding,
        fontSize: st.fontSize,
        fontWeight: st.fontWeight,
        border: st.border,
        boxShadow: st.boxShadow,
        transition: st.transition,
        textTransform: st.textTransform,
        letterSpacing: st.letterSpacing,
        area: rect.width * rect.height,
        isAboveFold: rect.top < VH,
        hasSaturatedBg: parseSat(st.backgroundColor) > 0.2,
      });
    }

    // Cards: elements with shadow/border-radius combo
    const cardSels = '[class*="card"], [class*="Card"], article, [class*="panel"], [class*="tile"], [class*="block"], [class*="item"]';
    const cards = Array.from(document.querySelectorAll(cardSels)).slice(0, 20);
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 80) continue;
      const st = getComputedStyle(card);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const hasShadow = st.boxShadow && st.boxShadow !== "none";
      const hasRadius = parseFloat(st.borderRadius) > 0;
      const hasBorder = st.border && st.border !== "none" && !st.border.startsWith("0px");
      if (!hasShadow && !hasRadius && !hasBorder) continue;
      result.cards.push({
        backgroundColor: st.backgroundColor,
        borderRadius: st.borderRadius,
        padding: st.padding,
        border: st.border,
        boxShadow: st.boxShadow,
        overflow: st.overflow,
        area: rect.width * rect.height,
      });
    }

    // Inputs
    const inputSels = 'input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="password"], input:not([type]), textarea, select';
    const inputs = Array.from(document.querySelectorAll(inputSels)).slice(0, 10);
    for (const inp of inputs) {
      const rect = inp.getBoundingClientRect();
      if (rect.width < 60) continue;
      const st = getComputedStyle(inp);
      if (st.display === "none" || st.visibility === "hidden") continue;
      result.inputs.push({
        backgroundColor: st.backgroundColor,
        color: st.color,
        borderRadius: st.borderRadius,
        padding: st.padding,
        border: st.border,
        fontSize: st.fontSize,
        boxShadow: st.boxShadow,
      });
    }

    return result;
  });
}

/* ── DOM Collection: Shadows ── */
async function collectShadowSamples(page) {
  return page.evaluate(() => {
    const shadows = new Map();
    const all = document.querySelectorAll("body *");
    const limit = Math.min(all.length, 2000);
    for (let i = 0; i < limit; i++) {
      const el = all[i];
      const st = getComputedStyle(el);
      const shadow = st.boxShadow;
      if (!shadow || shadow === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) continue;
      const existing = shadows.get(shadow) || { count: 0, totalArea: 0 };
      existing.count++;
      existing.totalArea += rect.width * rect.height;
      shadows.set(shadow, existing);
    }
    return Array.from(shadows.entries())
      .map(([value, meta]) => ({ value, ...meta }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  });
}

/* ── DOM Collection: Transitions ── */
async function collectTransitionSamples(page) {
  return page.evaluate(() => {
    const transitions = new Map();
    const durations = new Map();
    const easings = new Map();
    const animations = new Map();
    const all = document.querySelectorAll("body *");
    const limit = Math.min(all.length, 2000);
    for (let i = 0; i < limit; i++) {
      const st = getComputedStyle(all[i]);
      const t = st.transition;
      if (t && t !== "all 0s ease 0s" && t !== "none" && !t.startsWith("all 0s")) {
        transitions.set(t, (transitions.get(t) || 0) + 1);
        // Parse individual durations
        const dMatch = t.match(/([\d.]+)s/g);
        if (dMatch) for (const d of dMatch) {
          const v = parseFloat(d);
          if (v > 0 && v < 5) durations.set(v, (durations.get(v) || 0) + 1);
        }
        // Parse easings
        const eMatch = t.match(/(ease(?:-in)?(?:-out)?|linear|cubic-bezier\([^)]+\))/g);
        if (eMatch) for (const e of eMatch) easings.set(e, (easings.get(e) || 0) + 1);
      }
      if (st.animationName && st.animationName !== "none") {
        animations.set(st.animationName, (animations.get(st.animationName) || 0) + 1);
      }
    }
    return {
      transitions: Array.from(transitions.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      durations: Array.from(durations.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value - b.value),
      easings: Array.from(easings.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      animations: Array.from(animations.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  });
}

/* ── Processing: Typography samples → type_scale ── */
function processTypographySamples(raw) {
  if (!raw || Object.keys(raw).length === 0) return {};
  // Return as-is — already structured by role
  return raw;
}

/* ── Processing: Component samples → button/card/input specs ── */
function processComponentSamples(raw, palette) {
  const result = { button: {}, card: null, input: null };

  // Pick primary button: prefer above-fold with saturated background, then by area
  if (raw.buttons.length > 0) {
    const candidates = raw.buttons.filter(b => b.hasSaturatedBg && b.isAboveFold);
    const best = (candidates.length > 0 ? candidates : raw.buttons)
      .sort((a, b) => b.area - a.area)[0];
    if (best) {
      result.button.primary = {
        backgroundColor: best.backgroundColor,
        color: best.color,
        borderRadius: best.borderRadius,
        padding: best.padding,
        fontSize: best.fontSize,
        fontWeight: best.fontWeight,
        border: best.border,
        boxShadow: best.boxShadow !== "none" ? best.boxShadow : null,
        transition: best.transition !== "all 0s ease 0s" && best.transition !== "none" ? best.transition : null,
        textTransform: best.textTransform !== "none" ? best.textTransform : null,
        letterSpacing: best.letterSpacing !== "normal" ? best.letterSpacing : null,
      };
      // Derive secondary: look for a different-styled button
      const secondary = raw.buttons.find(b =>
        b !== best && b.backgroundColor !== best.backgroundColor && b.isAboveFold
      );
      if (secondary) {
        result.button.secondary = {
          backgroundColor: secondary.backgroundColor,
          color: secondary.color,
          borderRadius: secondary.borderRadius,
          padding: secondary.padding,
          fontSize: secondary.fontSize,
          fontWeight: secondary.fontWeight,
          border: secondary.border,
          boxShadow: secondary.boxShadow !== "none" ? secondary.boxShadow : null,
          transition: secondary.transition !== "all 0s ease 0s" ? secondary.transition : null,
        };
      }
    }
  }

  // Pick card: largest card with shadow or border
  if (raw.cards.length > 0) {
    const best = raw.cards.sort((a, b) => b.area - a.area)[0];
    result.card = {
      backgroundColor: best.backgroundColor,
      borderRadius: best.borderRadius,
      padding: best.padding,
      border: best.border,
      boxShadow: best.boxShadow !== "none" ? best.boxShadow : null,
      overflow: best.overflow !== "visible" ? best.overflow : null,
    };
  }

  // Pick input: first visible input
  if (raw.inputs.length > 0) {
    const inp = raw.inputs[0];
    result.input = {
      backgroundColor: inp.backgroundColor,
      color: inp.color,
      borderRadius: inp.borderRadius,
      padding: inp.padding,
      border: inp.border,
      fontSize: inp.fontSize,
      boxShadow: inp.boxShadow !== "none" ? inp.boxShadow : null,
    };
  }

  return result;
}

/* ── Processing: Shadow samples → scale ── */
function processShadowSamples(raw) {
  if (!raw || raw.length === 0) return null;

  // Parse blur radius from each shadow to sort by intensity
  const parsed = raw.map(s => {
    // box-shadow: h v blur spread color — extract blur (3rd numeric)
    const nums = s.value.match(/([-\d.]+)px/g);
    const blur = nums && nums.length >= 3 ? Math.abs(parseFloat(nums[2])) : 0;
    return { ...s, blur };
  })
    .filter(s => s.blur > 0) // skip 0-blur shadows
    .sort((a, b) => a.blur - b.blur);

  if (parsed.length === 0) return null;

  // Distribute across 5 slots
  const labels = ["xs", "sm", "md", "lg", "xl"];
  const result = {};
  if (parsed.length >= 5) {
    const step = (parsed.length - 1) / 4;
    for (let i = 0; i < 5; i++) {
      result[labels[i]] = parsed[Math.round(i * step)].value;
    }
  } else {
    // Use what we have, spread across scale
    for (let i = 0; i < 5; i++) {
      result[labels[i]] = parsed[Math.min(i, parsed.length - 1)].value;
    }
  }
  return result;
}

/* ── Processing: Transition samples → tokens ── */
function processTransitionSamples(raw) {
  if (!raw) return null;

  const sorted = raw.durations?.map(d => d.value).sort((a, b) => a - b) || [];
  const topEasing = raw.easings?.[0]?.value || "ease";

  return {
    duration: {
      fast: sorted[0] ? `${sorted[0]}s` : "0.1s",
      normal: sorted[Math.floor(sorted.length / 2)] ? `${sorted[Math.floor(sorted.length / 2)]}s` : "0.15s",
      slow: sorted[sorted.length - 1] ? `${sorted[sorted.length - 1]}s` : "0.3s",
    },
    easing: {
      default: topEasing,
      all: raw.easings?.map(e => e.value) || [topEasing],
    },
    common: raw.transitions?.find(t => t.value.includes("s"))?.value || "all 0.15s ease",
    animations: raw.animations?.map(a => a.name) || [],
  };
}

/* ── Font file downloading ── */
async function downloadFontFiles(fontUrls, googleFonts, domain, root) {
  const fontsDir = join(root, ".ogu/brands", domain, "fonts");
  mkdirSync(fontsDir, { recursive: true });

  const downloaded = [];
  const seen = new Set();

  // Download intercepted font files
  for (const font of (fontUrls || []).slice(0, 20)) {
    if (seen.has(font.url) || font.status !== 200) continue;
    seen.add(font.url);
    try {
      const resp = await fetch(font.url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 100) continue; // skip empty/tiny files
      const ext = font.url.match(/\.(woff2?|ttf|otf|eot)/i)?.[1]?.toLowerCase() || "woff2";
      const urlPath = new URL(font.url).pathname;
      let fileName = urlPath.split("/").pop() || `font-${downloaded.length}.${ext}`;
      // Sanitize filename
      fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!fileName.match(/\.(woff2?|ttf|otf|eot)$/i)) fileName += `.${ext}`;
      const filePath = join(fontsDir, fileName);
      writeFileSync(filePath, buf);
      downloaded.push({
        url: font.url,
        local_path: `.ogu/brands/${domain}/fonts/${fileName}`,
        format: ext,
        size: buf.length,
        name: fileName,
      });
    } catch { /* skip failed downloads */ }
  }

  // Build @font-face CSS / Google Fonts import
  let fontFaceCss = "";
  if (googleFonts && googleFonts.length > 0) {
    const families = googleFonts.map(f => f.replace(/ /g, "+")).join("&family=");
    fontFaceCss = `@import url('https://fonts.googleapis.com/css2?family=${families}:wght@300;400;500;600;700&display=swap');`;
  } else if (downloaded.length > 0) {
    // Generate @font-face from downloaded files
    const byFamily = new Map();
    for (const f of downloaded) {
      // Try to infer family name from filename
      const name = f.name.replace(/[-_]?\d{3}[-_]?(normal|italic)?/i, "").replace(/\.(woff2?|ttf|otf|eot)$/i, "").replace(/[-_]/g, " ").trim();
      if (!byFamily.has(name)) byFamily.set(name, []);
      byFamily.get(name).push(f);
    }
    const faces = [];
    for (const [family, files] of byFamily) {
      for (const f of files) {
        const weight = f.name.match(/(\d{3})/)?.[1] || "400";
        const style = /italic/i.test(f.name) ? "italic" : "normal";
        const format = f.format === "woff2" ? "woff2" : f.format === "woff" ? "woff" : f.format === "ttf" ? "truetype" : f.format;
        faces.push(`@font-face {\n  font-family: '${family}';\n  src: url('${f.url}') format('${format}');\n  font-weight: ${weight};\n  font-style: ${style};\n  font-display: swap;\n}`);
      }
    }
    fontFaceCss = faces.join("\n\n");
  }

  return { files: downloaded, font_face_css: fontFaceCss };
}

/** Convert DOM palette to the colors format used by brandDna */
function domPaletteToColors(palette) {
  const clusters = palette.clusters || [];

  // Find semantic colors (error/success/warning) from clusters by hue
  const hue = (c) => {
    const r = c.rgba.r / 255, g = c.rgba.g / 255, b = c.rgba.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    let h;
    if (max === r) h = (g - b) / (max - min);
    else if (max === g) h = 2 + (b - r) / (max - min);
    else h = 4 + (r - g) / (max - min);
    h *= 60; if (h < 0) h += 360;
    return h;
  };

  const sat = (c) => saturationHsv(c.rgba);
  const errorC = clusters.find(c => { const h = hue(c); return (h < 20 || h > 340) && sat(c) > 0.4; });
  const successC = clusters.find(c => { const h = hue(c); return h > 90 && h < 170 && sat(c) > 0.3; });
  const warningC = clusters.find(c => { const h = hue(c); return h > 25 && h < 65 && sat(c) > 0.3; });

  // text_muted: low saturation, luminance between text and background
  const bgLum = palette.background ? luminance({ ...palette.background, ...parseHex(palette.background.hex) }) : 1;
  const textLum = palette.text ? luminance({ ...palette.text, ...parseHex(palette.text.hex) }) : 0;
  const minLum = Math.min(bgLum, textLum), maxLum = Math.max(bgLum, textLum);
  const usedIds = new Set([palette.background, palette.surface, palette.text, palette.primary, palette.secondary, palette.accent]
    .filter(Boolean).map(c => c.clusterId));
  const textMutedC = clusters.find(c =>
    !usedIds.has(c.id) && saturationHsv(c.rgba) < 0.3 &&
    luminance(c.rgba) > minLum + 0.1 && luminance(c.rgba) < maxLum - 0.1
  );

  // Build all_extracted from clusters
  const roleMap = new Map();
  if (palette.primary) roleMap.set(palette.primary.clusterId, "primary");
  if (palette.secondary) roleMap.set(palette.secondary.clusterId, "secondary");
  if (palette.background) roleMap.set(palette.background.clusterId, "background");
  if (palette.surface) roleMap.set(palette.surface.clusterId, "surface");
  if (palette.text) roleMap.set(palette.text.clusterId, "text");
  if (textMutedC) roleMap.set(textMutedC.id, "text_muted");

  const all_extracted = clusters.slice(0, 30).map(c => ({
    hex: rgbToHex(c.rgba),
    count: Math.round(c.weightTotal),
    role: roleMap.get(c.id) || null,
  }));

  return {
    primary: palette.primary?.hex || null,
    secondary: palette.secondary?.hex || null,
    background: palette.background?.hex || null,
    surface: palette.surface?.hex || null,
    text: palette.text?.hex || null,
    text_muted: textMutedC ? rgbToHex(textMutedC.rgba) : null,
    error: errorC ? rgbToHex(errorC.rgba) : null,
    success: successC ? rgbToHex(successC.rgba) : null,
    warning: warningC ? rgbToHex(warningC.rgba) : null,
    is_dark_mode: palette.isDark,
    all_extracted,
    source: "dom-sampling",
  };
}

/* ────────────────────── Font Detection ────────────────────── */

export function extractFonts(css, html, themeVars = {}) {
  const google = extractGoogleFonts(html);

  // @font-face declarations
  const fontFace = [];
  const ffRe = /@font-face\s*\{[^}]*font-family:\s*["']?([^"';}\n]+)/gi;
  let m;
  while ((m = ffRe.exec(css))) fontFace.push(m[1].trim());

  // font-family declarations (frequency counting)
  const fontCounts = new Map();
  const famRe = /font-family:\s*([^;}\n]+)/gi;
  while ((m = famRe.exec(css))) {
    const families = m[1].split(",").map(f => f.trim().replace(/^["']|["']$/g, ""));
    for (const f of families) {
      if (isGenericFamily(f) || f.startsWith("var(")) continue;
      fontCounts.set(f, (fontCounts.get(f) || 0) + 1);
    }
  }

  const sorted = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]);
  const nonMono = sorted.filter(([name]) => !isMonoFont(name));
  const mono = sorted.filter(([name]) => isMonoFont(name));

  // Theme variable fonts override frequency-based detection
  const tv = themeVars.fonts || {};

  return {
    font_body: tv.body || nonMono[0]?.[0] || null,
    font_heading: tv.heading || nonMono[1]?.[0] || nonMono[0]?.[0] || null,
    font_mono: tv.mono || mono[0]?.[0] || null,
    google_fonts: [...new Set(google)],
    font_face: [...new Set(fontFace)],
    all_detected: sorted.map(([name, count]) => ({ name, count })),
  };
}

function extractGoogleFonts(html) {
  const fonts = [];
  const re = /fonts\.googleapis\.com\/css2?\?[^"'>\s]+family=([^"'>\s&]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const families = decodeURIComponent(m[1])
      .split("|")
      .map(f => f.split(":")[0].replace(/\+/g, " "));
    fonts.push(...families);
  }
  return fonts;
}

/* ────────────────────── Spacing & Radius ────────────────────── */

export function extractSpacing(css) {
  const re = /(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?:\s*([^;}\n]+)/gi;
  const values = new Map();
  let m;
  while ((m = re.exec(css))) {
    for (const part of m[1].trim().split(/\s+/)) {
      const px = parsePixelValue(part);
      if (px !== null && px > 0 && px <= 128) {
        values.set(px, (values.get(px) || 0) + 1);
      }
    }
  }

  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  sorted.sort((a, b) => a[0] - b[0]);
  const labels = ["xs", "sm", "md", "lg", "xl", "2xl"];
  const result = {};
  sorted.forEach(([px], i) => { if (i < labels.length) result[labels[i]] = `${px}px`; });
  return result;
}

export function extractRadius(css) {
  const re = /border-radius:\s*([^;}\n]+)/gi;
  const values = new Map();
  let m;
  while ((m = re.exec(css))) {
    const px = parsePixelValue(m[1].trim().split(/\s+/)[0]);
    if (px !== null && px >= 0 && px <= 50) {
      values.set(px, (values.get(px) || 0) + 1);
    }
  }
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  sorted.sort((a, b) => a[0] - b[0]);
  const labels = ["sm", "md", "lg"];
  const result = {};
  sorted.forEach(([px], i) => { if (i < labels.length) result[labels[i]] = `${px}px`; });
  return result;
}

/* ────────────────────── Effects ────────────────────── */

export function extractEffects(css) {
  const shadows = [];
  const borders = [];
  let m;

  const shadowRe = /box-shadow:\s*([^;}\n]+)/gi;
  while ((m = shadowRe.exec(css))) shadows.push(m[1].trim());

  const borderRe = /(?<![a-z-])border:\s*([^;}\n]+)/gi;
  while ((m = borderRe.exec(css))) borders.push(m[1].trim());

  return {
    glow: "none",
    border_style: mostCommon(borders) || "none",
    shadow: mostCommon(shadows) || "none",
  };
}

/* ────────────────────── Brand Tone ────────────────────── */

export function extractBrandTone(html) {
  const signals = { title: null, meta_description: null, og_title: null, headings: [], tone_markers: [] };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  signals.title = titleMatch?.[1]?.trim() || null;

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (!metaDescMatch) {
    const alt = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    signals.meta_description = alt?.[1]?.trim() || null;
  } else {
    signals.meta_description = metaDescMatch[1].trim();
  }

  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  signals.og_title = ogMatch?.[1]?.trim() || null;

  const hRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m;
  while ((m = hRe.exec(html)) && signals.headings.length < 10) {
    const text = stripTags(m[1]).trim();
    if (text && text.length < 200) signals.headings.push(text);
  }

  // Infer tone markers
  const allText = [signals.title, signals.meta_description, signals.og_title, ...signals.headings]
    .filter(Boolean).join(" ").toLowerCase();

  const markers = [
    [/\b(?:fast|speed|instant|quick|rapid|lightning)\b/, "fast"],
    [/\b(?:simple|easy|minimal|clean|effortless|intuitive)\b/, "simple"],
    [/\b(?:power|supercharge|unlock|accelerate|scale)\b/, "powerful"],
    [/\b(?:beautiful|gorgeous|stunning|elegant|sleek|polished)\b/, "aesthetic"],
    [/\b(?:team|collaborate|together|shared|workspace)\b/, "collaborative"],
    [/\b(?:secure|private|safe|trusted|compliant|protect)\b/, "trustworthy"],
    [/\b(?:fun|play|joy|delight|love|creative)\b/, "playful"],
    [/\b(?:free|open|transparent|community)\b/, "open"],
    [/\b(?:developer|api|code|build|ship|deploy|sdk)\b/, "developer-focused"],
    [/\b(?:enterprise|business|organization|professional|saas)\b/, "enterprise"],
  ];

  for (const [re, label] of markers) {
    if (re.test(allText)) signals.tone_markers.push(label);
  }

  return signals;
}

/* ────────────────────── Icon Library Detection ────────────────────── */

export function extractIconLibrary(html, css) {
  const combined = html + css;
  const signals = [];

  const libs = [
    [/lucide/i, "lucide"],
    [/heroicons|@heroicons/i, "heroicons"],
    [/react-icons/i, "react-icons"],
    [/phosphor/i, "phosphor"],
    [/tabler-icons|@tabler/i, "tabler"],
    [/font-awesome|fontawesome|fa-[a-z]/i, "font-awesome"],
    [/material-icons|material-symbols/i, "material-icons"],
    [/ionicons/i, "ionicons"],
    [/feather-icons|feather/i, "feather"],
    [/iconify/i, "iconify"],
    [/bootstrap-icons|bi-/i, "bootstrap-icons"],
  ];

  for (const [re, name] of libs) {
    if (re.test(combined)) signals.push(name);
  }

  return signals;
}

/* ────────────────────── Language Detection ────────────────────── */

/**
 * Detect the website's content language and text direction.
 * Checks: html[lang], meta tags, dir attribute, and character analysis.
 */
export function extractLanguage(html) {
  const result = {
    lang: null,       // e.g. "he", "en", "ru", "ar"
    lang_name: null,  // e.g. "Hebrew", "English", "Russian", "Arabic"
    dir: "ltr",       // "ltr" or "rtl"
    confidence: "low",
  };

  // 1. <html lang="..."> — strongest signal
  const htmlLang = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (htmlLang) {
    const code = htmlLang[1].split("-")[0].toLowerCase();
    result.lang = code;
    result.lang_name = langCodeToName(code);
    result.confidence = "high";
  }

  // 2. <meta http-equiv="content-language" content="...">
  if (!result.lang) {
    const metaLang = html.match(/<meta[^>]+http-equiv=["']content-language["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+http-equiv=["']content-language["']/i);
    if (metaLang) {
      const code = metaLang[1].split("-")[0].toLowerCase();
      result.lang = code;
      result.lang_name = langCodeToName(code);
      result.confidence = "high";
    }
  }

  // 3. <meta name="language" content="...">
  if (!result.lang) {
    const metaName = html.match(/<meta[^>]+name=["']language["'][^>]+content=["']([^"']+)["']/i);
    if (metaName) {
      const code = metaName[1].split("-")[0].toLowerCase();
      result.lang = code;
      result.lang_name = langCodeToName(code);
      result.confidence = "medium";
    }
  }

  // 4. dir attribute (detect RTL even if lang is set)
  const dirAttr = html.match(/<(?:html|body)[^>]+dir=["'](rtl|ltr)["']/i);
  if (dirAttr) {
    result.dir = dirAttr[1].toLowerCase();
  } else if (result.lang) {
    // Infer direction from known RTL languages
    const rtlLangs = new Set(["he", "ar", "fa", "ur", "yi", "ps", "sd", "ckb", "dv"]);
    if (rtlLangs.has(result.lang)) result.dir = "rtl";
  }

  // 5. Character analysis on visible text — fallback if no lang tag found
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const visibleText = bodyMatch ? stripTags(bodyMatch[1]).replace(/\s+/g, " ").slice(0, 5000) : "";

  if (visibleText.length > 50) {
    // Count character ranges
    const chars = { hebrew: 0, arabic: 0, cyrillic: 0, cjk: 0, latin: 0, thai: 0, devanagari: 0 };
    for (const ch of visibleText) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x0590 && cp <= 0x05FF) chars.hebrew++;
      else if (cp >= 0x0600 && cp <= 0x06FF) chars.arabic++;
      else if (cp >= 0x0400 && cp <= 0x04FF) chars.cyrillic++;
      else if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3040 && cp <= 0x30FF)) chars.cjk++;
      else if (cp >= 0x0E00 && cp <= 0x0E7F) chars.thai++;
      else if (cp >= 0x0900 && cp <= 0x097F) chars.devanagari++;
      else if (cp >= 0x0041 && cp <= 0x024F) chars.latin++;
    }

    const total = Object.values(chars).reduce((a, b) => a + b, 0);
    if (total > 20) {
      const dominant = Object.entries(chars).sort((a, b) => b[1] - a[1])[0];
      const ratio = dominant[1] / total;

      // Only override if strong signal and no tag was found
      const charLangMap = {
        hebrew: { code: "he", name: "Hebrew", dir: "rtl" },
        arabic: { code: "ar", name: "Arabic", dir: "rtl" },
        cyrillic: { code: "ru", name: "Russian", dir: "ltr" },
        cjk: { code: "zh", name: "Chinese", dir: "ltr" },
        thai: { code: "th", name: "Thai", dir: "ltr" },
        devanagari: { code: "hi", name: "Hindi", dir: "ltr" },
        latin: { code: "en", name: "English", dir: "ltr" },
      };

      const detected = charLangMap[dominant[0]];
      if (detected && ratio > 0.3) {
        if (!result.lang) {
          result.lang = detected.code;
          result.lang_name = detected.name;
          result.confidence = ratio > 0.6 ? "medium" : "low";
        }
        // RTL from characters if no dir attribute
        if (!dirAttr && detected.dir === "rtl") {
          result.dir = "rtl";
        }
      }
    }
  }

  return result;
}

/** Map ISO 639-1 codes to human names */
function langCodeToName(code) {
  const map = {
    en: "English", he: "Hebrew", ar: "Arabic", ru: "Russian",
    fr: "French", de: "German", es: "Spanish", pt: "Portuguese",
    it: "Italian", nl: "Dutch", pl: "Polish", uk: "Ukrainian",
    zh: "Chinese", ja: "Japanese", ko: "Korean", th: "Thai",
    hi: "Hindi", tr: "Turkish", sv: "Swedish", da: "Danish",
    no: "Norwegian", fi: "Finnish", cs: "Czech", ro: "Romanian",
    hu: "Hungarian", el: "Greek", bg: "Bulgarian", hr: "Croatian",
    sk: "Slovak", sl: "Slovenian", et: "Estonian", lv: "Latvian",
    lt: "Lithuanian", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
    fa: "Persian", ur: "Urdu", bn: "Bengali", ta: "Tamil",
  };
  return map[code] || code.toUpperCase();
}

/* ────────────────────── Logo / SVG Extraction ────────────────────── */

/**
 * Generic logo extraction — zero hardcoded platform names.
 *
 * Strategy (ordered by reliability):
 *  1. Homepage link logo — <a href="/"> or <a href="https://domain"> containing <img> or <svg>
 *     This is the most universal pattern: every site links its logo to the homepage.
 *  2. Attribute-based — any element with "logo" or "brand" in class/id/alt/aria-label
 *  3. First <img> in <header>/<nav>/<footer>
 *  4. Meta tags — favicon, apple-touch-icon, og:image
 */
export function extractLogos(html, baseUrl) {
  const found = [];
  const seen = new Set();
  const parsedBase = new URL(baseUrl);
  const baseDomain = parsedBase.hostname.replace(/^www\./, "");

  function add(src, type, source) {
    if (!src || seen.has(src)) return;
    // Skip data URI placeholders (1x1 SVG, tiny base64 images)
    if (src.startsWith("data:")) {
      if (src.includes("base64,")) {
        const b64 = src.split("base64,")[1];
        if (b64 && b64.length < 200) return; // too small to be a real image
      }
      return; // skip all data URIs as logo sources
    }
    try {
      const resolved = new URL(src, baseUrl).href;
      if (seen.has(resolved)) return;
      seen.add(resolved);
      found.push({ url: resolved, type, source });
    } catch { /* skip invalid URLs */ }
  }

  let inlineCount = 0;
  function addInline(svg, source) {
    // Skip empty/spacer SVGs: must have actual drawing content
    if (!/<(?:path|polygon|polyline|rect|circle|ellipse|line|text|image|use)\b/i.test(svg)) return;
    // Skip tiny SVGs (1x1, 0x0 spacers/tracking pixels)
    const wMatch = svg.match(/\bwidth=["'](\d+)/i);
    const hMatch = svg.match(/\bheight=["'](\d+)/i);
    if (wMatch && hMatch && parseInt(wMatch[1]) <= 2 && parseInt(hMatch[1]) <= 2) return;
    // Dedup by content hash (first 200 chars)
    const key = `svg:${svg.slice(0, 200)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const name = inlineCount === 0 ? "logo.svg" : `logo-${inlineCount}.svg`;
    inlineCount++;
    found.push({ inline: svg, type: "logo", source, name });
  }

  let m;

  // ── 1. Homepage link: <a href="/"> or <a href="https://domain/"> in header/nav/footer ──
  // This is the #1 most reliable way to find a logo on any website.
  const sectionRe = /<(?:header|nav|footer)[^>]*>([\s\S]*?)<\/(?:header|nav|footer)>/gi;
  let section;
  const sectionsFound = [];
  while ((section = sectionRe.exec(html))) sectionsFound.push(section[1]);

  // Also check the first 5000 chars of body (some sites don't use semantic tags)
  const bodyStart = html.match(/<body[^>]*>([\s\S]{0,5000})/i);
  if (bodyStart) sectionsFound.push(bodyStart[1]);

  for (const content of sectionsFound) {
    // Find links to homepage: href="/", href="./", href="https://domain", href="https://www.domain"
    const pattern = new RegExp(
      `<a[^>]*href=["'](?:\\/|\\.\\/|https?:\\/\\/(?:www\\.)?${baseDomain.replace(/\./g, "\\.")}\\/?(?:#[^"']*)?)["'][^>]*>([\\s\\S]*?)<\\/a>`,
      "gi"
    );

    let linkMatch;
    while ((linkMatch = pattern.exec(content))) {
      const linkContent = linkMatch[1];
      // Check for <img> inside the homepage link
      const imgMatch = linkContent.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        add(imgMatch[1], "logo", "homepage-link-img");
      }
      // Check for inline <svg> inside the homepage link
      const svgMatch = linkContent.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch && svgMatch[0].length > 50 && svgMatch[0].length < 50000) {
        addInline(svgMatch[0], "homepage-link-svg");
      }
    }
  }

  // ── 2. Attribute-based: any element with "logo" or "brand" in class/id/alt ──
  // Look for nearby <img> or inline <svg>
  const logoContextRe = /<[^>]*(?:class|id|alt|aria-label)=["'][^"']*\b(?:logo|brand)\b[^"']*["'][^>]*>/gi;
  while ((m = logoContextRe.exec(html))) {
    const tag = m[0];
    const pos = m.index;

    // Direct img src on this tag
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (srcMatch) { add(srcMatch[1], "logo", "attr-match"); continue; }

    // Look nearby (within 500 chars after) for img or svg
    const nearby = html.slice(pos, pos + 800);
    const nearbyImg = nearby.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (nearbyImg) { add(nearbyImg[1], "logo", "attr-match-child"); continue; }
    const nearbySvg = nearby.match(/<svg[\s\S]*?<\/svg>/i);
    if (nearbySvg && nearbySvg[0].length > 50 && !found.some(f => f.source === "homepage-link-svg")) {
      addInline(nearbySvg[0], "attr-match-svg");
    }
  }

  // Also match imgs whose src URL contains "logo" or "brand"
  const imgSrcLogoRe = /<img[^>]+src=["']([^"']*\b(?:logo|brand)\b[^"']*)["']/gi;
  while ((m = imgSrcLogoRe.exec(html))) add(m[1], "logo", "src-match");

  // ── 3. First <img> in header/nav (if we haven't found a logo yet) ──
  if (!found.some(f => f.type === "logo")) {
    for (const content of sectionsFound) {
      const firstImg = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (firstImg) { add(firstImg[1], "logo", "section-first-img"); break; }
    }
  }

  // ── 4. Meta / link tags ──
  const iconRe = /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/gi;
  while ((m = iconRe.exec(html))) add(m[1], "favicon", "link[rel=icon]");
  const iconRe2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/gi;
  while ((m = iconRe2.exec(html))) add(m[1], "favicon", "link[rel=icon]");

  const appleRe = /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/gi;
  while ((m = appleRe.exec(html))) add(m[1], "apple-icon", "link[apple-touch-icon]");

  const ogRe = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
  const ogMatch = html.match(ogRe);
  if (ogMatch) add(ogMatch[1], "og-image", "meta[og:image]");
  const ogRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;
  const ogMatch2 = html.match(ogRe2);
  if (ogMatch2) add(ogMatch2[1], "og-image", "meta[og:image]");

  // ── Sort: logo first, then favicon/meta ──
  const priority = { "logo": 0, "favicon": 1, "apple-icon": 2, "og-image": 3 };
  found.sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9));

  return found;
}

async function downloadLogos(logoRefs, domain, root) {
  const logosDir = join(root, ".ogu/brands", domain);
  mkdirSync(logosDir, { recursive: true });
  const results = [];

  for (const ref of logoRefs.slice(0, 10)) {
    try {
      if (ref.inline) {
        // Inline SVG — write file + embed as data URI
        const name = ref.name || `logo-${results.length}.svg`;
        const filePath = join(logosDir, name);
        writeFileSync(filePath, ref.inline, "utf-8");
        const dataUri = `data:image/svg+xml;base64,${Buffer.from(ref.inline).toString("base64")}`;
        results.push({ type: ref.type, name, path: filePath, source: ref.source, data_uri: dataUri });
        continue;
      }

      // Fetch URL
      const resp = await fetch(ref.url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        redirect: "follow",
      });
      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") || "";
      const urlPath = new URL(ref.url).pathname;
      const ext = contentType.includes("svg") ? ".svg"
        : contentType.includes("png") ? ".png"
        : contentType.includes("jpeg") || contentType.includes("jpg") ? ".jpg"
        : contentType.includes("gif") ? ".gif"
        : contentType.includes("webp") ? ".webp"
        : contentType.includes("x-icon") || contentType.includes("vnd.microsoft.icon") ? ".ico"
        : urlPath.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/i)?.[0] || ".bin";

      const logoCount = results.filter(r => r.type === "logo").length;
      const baseName = ref.type === "favicon" ? `favicon${ext}`
        : ref.type === "apple-icon" ? `apple-icon${ext}`
        : ref.type === "og-image" ? `og-image${ext}`
        : ref.type === "logo" ? (logoCount === 0 ? `logo${ext}` : `logo-${logoCount}${ext}`)
        : `asset-${results.length}${ext}`;

      const filePath = join(logosDir, baseName);
      const mimeMap = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon" };
      const mime = mimeMap[ext] || "application/octet-stream";

      let dataUri = null;
      if (ext === ".svg") {
        const text = await resp.text();
        writeFileSync(filePath, text, "utf-8");
        dataUri = `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`;
      } else {
        const buf = Buffer.from(await resp.arrayBuffer());
        writeFileSync(filePath, buf);
        // Embed as data URI only for small files (< 200KB)
        if (buf.length < 200000) {
          dataUri = `data:${mime};base64,${buf.toString("base64")}`;
        }
      }

      results.push({ type: ref.type, name: baseName, path: filePath, source: ref.source, data_uri: dataUri });
    } catch { /* skip failed downloads */ }
  }

  return results;
}

/* ────────────────────── Deep Scan (Playwright) ────────────────────── */

function checkPlaywright() {
  try {
    execSync("npx playwright --version", { encoding: "utf-8", timeout: 10000, stdio: "pipe" });
    return true;
  } catch { return false; }
}

async function deepScan(url, domain, root) {
  if (!checkPlaywright()) {
    console.log("  WARN     Playwright not found. Install: npm init playwright@latest");
    console.log("           Falling back to lightweight mode.");
    return null;
  }

  const brandsDir = join(root, ".ogu/brands");
  mkdirSync(brandsDir, { recursive: true });
  const screenshotPath = join(brandsDir, `${domain}-screenshot.png`);

  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: false });

  const data = await page.evaluate(() => {
    const cs = (el) => el ? window.getComputedStyle(el) : null;
    const body = cs(document.body);
    const h1 = cs(document.querySelector('h1'));
    const btn = cs(document.querySelector('button, a.btn, [class*="button"], [class*="btn"]'));

    const allColors = new Set();
    const els = [...document.querySelectorAll('*')].slice(0, 200);
    for (const el of els) {
      const s = window.getComputedStyle(el);
      allColors.add(s.color);
      allColors.add(s.backgroundColor);
    }

    return {
      bodyBg: body?.backgroundColor || null,
      bodyColor: body?.color || null,
      bodyFont: body?.fontFamily || null,
      h1Font: h1?.fontFamily || null,
      h1Color: h1?.color || null,
      btnBg: btn?.backgroundColor || null,
      btnColor: btn?.color || null,
      btnRadius: btn?.borderRadius || null,
      computedColors: [...allColors],
    };
  });

  await browser.close();
  process.stdout.write(JSON.stringify(data));
})();
`.trim();

  try {
    const output = execSync(`node -e ${JSON.stringify(script)}`, {
      cwd: root,
      encoding: "utf-8",
      timeout: 45000,
    });
    return JSON.parse(output.trim());
  } catch (err) {
    console.log(`  WARN     Deep scan failed: ${(err.message || "").split("\n")[0]}`);
    return null;
  }
}

function mergeDeepData(colors, typography, deepData) {
  // Merge computed styles from deep scan into existing results
  if (deepData.computedColors) {
    for (const raw of deepData.computedColors) {
      if (!raw || raw === "rgba(0, 0, 0, 0)") continue;
      const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) {
        const hex = rgbToHex({ r: +m[1], g: +m[2], b: +m[3] });
        // Boost count for computed styles (they represent actual rendered state)
        if (!colors.all_extracted.find(c => c.hex === hex)) {
          colors.all_extracted.push({ hex, count: 3, role: null });
        }
      }
    }
  }

  // Override font if computed style gives cleaner result
  if (deepData.bodyFont && !typography.font_body) {
    const first = deepData.bodyFont.split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (!isGenericFamily(first)) typography.font_body = first;
  }
  if (deepData.h1Font && !typography.font_heading) {
    const first = deepData.h1Font.split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (!isGenericFamily(first)) typography.font_heading = first;
  }
}

/* ────────────────────── Asset Pack ────────────────────── */

/**
 * Organize brand assets into .ogu/assets/ and write manifest.json.
 *
 * Structure:
 *   .ogu/assets/logo/   — primary logo + mark (SVG preferred)
 *   .ogu/assets/fonts/  — woff2 font files
 *   .ogu/assets/manifest.json — paths + @font-face snippet + usage notes
 */
function buildAssetPack(root, domain, brandDna, logos = [], fontData = {}) {
  const assetsDir = join(root, ".ogu", "assets");
  const logoDir = join(assetsDir, "logo");
  const fontsDir = join(assetsDir, "fonts");
  mkdirSync(logoDir, { recursive: true });
  mkdirSync(fontsDir, { recursive: true });

  const manifest = {
    domain,
    generated_at: new Date().toISOString(),
    logo: null,
    fonts: [],
    font_face_css: "",
    usage: {},
  };

  // ── Logos ──────────────────────────────────────────────────────────────
  const primaryLogo = logos.find(l => l.type === "logo") || logos[0];
  if (primaryLogo && primaryLogo.path && existsSync(primaryLogo.path)) {
    const ext = primaryLogo.name.match(/\.[^.]+$/)?.[0] || ".svg";
    const destName = `logo${ext}`;
    const destPath = join(logoDir, destName);
    try {
      copyFileSync(primaryLogo.path, destPath);
      manifest.logo = {
        file: `.ogu/assets/logo/${destName}`,
        public_path: `/logo${ext}`,
        source: primaryLogo.source,
        type: ext === ".svg" ? "svg" : "raster",
      };
    } catch { /* non-blocking */ }
  }

  // All non-favicon logos as alternatives
  manifest.logo_alternatives = logos
    .filter(l => l.type !== "favicon" && l !== primaryLogo)
    .slice(0, 3)
    .map(l => ({ name: l.name, source: l.source, path: l.path }));

  // ── Fonts ──────────────────────────────────────────────────────────────
  const fontFaceBlocks = [];

  if (fontData.files?.length > 0) {
    for (const f of fontData.files) {
      if (!f.path || !existsSync(f.path)) continue;
      const destName = f.name || f.path.split("/").pop();
      const destPath = join(fontsDir, destName);
      try {
        copyFileSync(f.path, destPath);
        manifest.fonts.push({
          file: `.ogu/assets/fonts/${destName}`,
          family: f.family || brandDna.typography?.font_body || "BrandFont",
          weight: f.weight || "400",
          style: f.style || "normal",
        });
        fontFaceBlocks.push(
          `@font-face {\n  font-family: '${f.family || brandDna.typography?.font_body}';\n  src: url('/.ogu/assets/fonts/${destName}') format('woff2');\n  font-weight: ${f.weight || "400"};\n  font-style: ${f.style || "normal"};\n  font-display: swap;\n}`
        );
      } catch { /* non-blocking */ }
    }
  }

  // Prefer local @font-face over Google Fonts import
  if (fontFaceBlocks.length > 0) {
    manifest.font_face_css = fontFaceBlocks.join("\n\n");
  } else if (fontData.font_face_css) {
    manifest.font_face_css = fontData.font_face_css;
  }

  // ── Usage notes ────────────────────────────────────────────────────────
  manifest.usage = {
    logo: manifest.logo
      ? `<img src="${manifest.logo.public_path}" alt="${domain} logo" />`
      : null,
    font_import: manifest.font_face_css
      ? "Add manifest.font_face_css to your globals.css"
      : null,
    font_family: brandDna.typography?.font_body
      ? `font-family: '${brandDna.typography.font_body}', sans-serif;`
      : null,
    note: "Import from .ogu/assets/manifest.json — never hardcode logo paths or font-family strings directly.",
  };

  writeFileSync(join(assetsDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  const assetCount = (manifest.logo ? 1 : 0) + manifest.fonts.length;
  if (assetCount > 0) console.log(`  assets   .ogu/assets/ — ${assetCount} file(s) organized`);
}

/* ────────────────────── Apply to THEME.json ────────────────────── */

export function applyBrandToTheme(root, brandDna) {
  const domain = brandDna.domain;
  const mood = detectMood(brandDna);

  const themeData = {
    version: 2,
    mood: `brand:${domain}`,
    description: `Brand DNA extracted from ${brandDna.url}`,
    references: [brandDna.url],
    constraints: {
      dark_mode: brandDna.colors.is_dark_mode || false,
      high_contrast: false,
      animations: brandDna.transitions?.common || "subtle-fade",
      typography_feel: brandDna.typography.font_body || "system",
      color_palette: `brand:${domain}`,
    },
    generated_tokens: {
      colors: {
        primary: brandDna.colors.primary || "#000000",
        secondary: brandDna.colors.secondary || brandDna.colors.primary || "#666666",
        background: brandDna.colors.background || "#ffffff",
        surface: brandDna.colors.surface || "#f8f9fa",
        error: brandDna.colors.error || "#ef4444",
        success: brandDna.colors.success || "#22c55e",
        warning: brandDna.colors.warning || "#f59e0b",
        text: brandDna.colors.text || "#111827",
        text_muted: brandDna.colors.text_muted || "#9ca3af",
      },
      spacing: Object.keys(brandDna.spacing || {}).length > 0
        ? brandDna.spacing
        : { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px" },
      radius: Object.keys(brandDna.radius || {}).length > 0
        ? brandDna.radius
        : { sm: "6px", md: "8px", lg: "12px" },
      typography: {
        font_body: buildFontStack(brandDna.typography.font_body, "sans"),
        font_heading: buildFontStack(brandDna.typography.font_heading, "sans"),
        font_mono: buildFontStack(brandDna.typography.font_mono, "mono"),
        font_face_css: brandDna.typography.font_face_css || "",
        type_scale: brandDna.typography.type_scale || {},
      },
      effects: brandDna.effects || { glow: "none", border_style: "1px solid #e5e7eb", shadow: "none" },
      shadows: brandDna.shadows || null,
      transitions: brandDna.transitions ? {
        duration: brandDna.transitions.duration,
        easing: brandDna.transitions.easing?.default || "ease",
        common: brandDna.transitions.common,
      } : null,
      components: {
        button: brandDna.components?.button || {},
        card: brandDna.components?.card || null,
        input: brandDna.components?.input || null,
      },
    },
  };

  // Copy primary logo asset to public/ and record path in theme
  const logoAsset = (brandDna.logos || []).find(l => l.type === "logo") || brandDna.logos?.[0];
  if (logoAsset && logoAsset.path && existsSync(logoAsset.path)) {
    try {
      const ext = extname(logoAsset.name || logoAsset.path);
      const destName = `logo${ext}`;
      const publicDir = join(root, "public");
      mkdirSync(publicDir, { recursive: true });
      const destPath = join(publicDir, destName);
      copyFileSync(logoAsset.path, destPath);
      themeData.brand_assets = { logo: `/${destName}`, logo_source: logoAsset.source };
      console.log(`  logo     copied → public/${destName}`);
    } catch { /* non-blocking — logo copy is best-effort */ }
  }

  const themePath = join(root, ".ogu/THEME.json");
  writeFileSync(themePath, JSON.stringify(themeData, null, 2) + "\n", "utf-8");

  console.log(`  applied  Brand "${domain}" → .ogu/THEME.json`);
  console.log(`  mood     ${mood} (auto-detected)`);
  const c = themeData.generated_tokens.colors;
  console.log(`  colors   primary=${c.primary}  bg=${c.background}  text=${c.text}`);
  const bodyFont = themeData.generated_tokens.typography.font_body.split(",")[0].trim();
  console.log(`  font     ${bodyFont}`);
}

function detectMood(brandDna) {
  const dark = brandDna.colors.is_dark_mode;
  const tone = brandDna.brand_tone?.tone_markers || [];

  if (dark && tone.includes("developer-focused")) return "cyberpunk";
  if (dark) return "cyberpunk";
  if (tone.includes("playful")) return "playful";
  if (tone.includes("enterprise") || tone.includes("trustworthy")) return "corporate";
  if (tone.includes("simple") || tone.includes("aesthetic")) return "minimal";
  if (tone.includes("powerful") || tone.includes("fast")) return "minimal";
  return "minimal";
}

export function buildFontStack(fontName, type) {
  if (!fontName) {
    return type === "mono"
      ? "'SF Mono', 'Fira Code', monospace"
      : "'Inter', -apple-system, system-ui, sans-serif";
  }
  const fallbacks = type === "mono"
    ? ", 'SF Mono', monospace"
    : ", -apple-system, system-ui, sans-serif";
  return `'${fontName}'${fallbacks}`;
}

/* ────────────────────── Update SOUL.md ────────────────────── */

function updateSoulWithBrand(root, brandDna) {
  const soulPath = join(root, ".ogu/SOUL.md");
  let content = existsSync(soulPath) ? readFileSync(soulPath, "utf-8") : "# Soul\n";

  const section = `\n## Brand Reference

Extracted from [${brandDna.domain}](${brandDna.url}) on ${brandDna.scanned_at.split("T")[0]}.

- **Primary color**: ${brandDna.colors.primary || "not detected"}
- **Background**: ${brandDna.colors.background || "not detected"}
- **Fonts**: ${brandDna.typography.font_body || "not detected"} (body), ${brandDna.typography.font_heading || "not detected"} (headings)
- **Dark mode**: ${brandDna.colors.is_dark_mode ? "yes" : "no"}
- **Tone**: ${brandDna.brand_tone?.tone_markers?.join(", ") || "not detected"}
- **Icons**: ${brandDna.icons?.join(", ") || "not detected"}
`;

  if (content.includes("## Brand Reference")) {
    content = content.replace(/\n## Brand Reference[\s\S]*?(?=\n## |$)/, section);
  } else {
    content = content.trimEnd() + "\n" + section;
  }

  writeFileSync(soulPath, content, "utf-8");
  console.log("  updated  .ogu/SOUL.md with brand reference");
}

/* ────────────────────── Helpers ────────────────────── */

function resolveUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch { return href; }
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

function parsePixelValue(val) {
  const m = val.match(/^([\d.]+)px$/);
  return m ? Math.round(+m[1]) : null;
}

export function parseHex(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
  if (hex.length !== 6 && hex.length !== 8) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a: 1 };
}

export function rgbToHex(c) {
  const r = Math.max(0, Math.min(255, Math.round(c.r)));
  const g = Math.max(0, Math.min(255, Math.round(c.g)));
  const b = Math.max(0, Math.min(255, Math.round(c.b)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function luminance(c) {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

export function saturation(c) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max === 0) return 0;
  return (max - min) / max;
}

export function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/* ── OKLab: exported API (takes RGB objects) — see DOM section for internal oklabDistance ── */

export function oklabDistanceRgb(a, b) {
  return oklabDistance(rgbToOklab(a), rgbToOklab(b));
}

function rgbToHue(c) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function isGenericFamily(name) {
  const lower = name.toLowerCase().trim();
  return ["serif", "sans-serif", "monospace", "cursive", "fantasy",
    "system-ui", "-apple-system", "blinkmacsystemfont", "inherit",
    "initial", "unset", "ui-sans-serif", "ui-serif", "ui-monospace",
    "segoe ui", "roboto", "helvetica neue", "arial", "noto sans",
    "liberation sans", "apple color emoji", "segoe ui emoji",
    "segoe ui symbol", "noto color emoji"].includes(lower);
}

function isMonoFont(name) {
  const lower = name.toLowerCase();
  return lower.includes("mono") || lower.includes("code") ||
    lower.includes("courier") || lower.includes("consolas") ||
    lower === "menlo" || lower === "monaco";
}

function mostCommon(arr) {
  if (arr.length === 0) return null;
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
