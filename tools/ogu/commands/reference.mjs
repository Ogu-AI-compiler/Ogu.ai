/**
 * reference — Composite design direction from multiple inspiration sources
 *
 * Accepts URLs, images (PNG/JPG/WEBP), and PDFs as reference inputs.
 * URLs are scanned for CSS/HTML design signals. Images and PDFs are stored
 * for analysis by the reference skill (Claude vision).
 *
 * Usage:
 *   ogu reference <url|file> <url|file> ... [--apply] [--soul]
 *   ogu reference show        — display current reference composite
 *   ogu reference clear       — remove reference data
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, extname, basename, resolve, isAbsolute } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";
import {
  fetchPage, extractCssLinks, extractInlineStyles, extractAllColors,
  clusterColors, extractFonts, extractSpacing, extractRadius,
  extractEffects, extractBrandTone, extractIconLibrary,
  applyBrandToTheme, buildFontStack,
  parseHex, rgbToHex, luminance, saturation, colorDistance,
  oklabDistanceRgb as oklabDistance,
} from "./brand-scan.mjs";

/* ────────────────────── Constants ────────────────────── */

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const PDF_EXTS = new Set([".pdf"]);
const ALL_FILE_EXTS = new Set([...IMAGE_EXTS, ...PDF_EXTS]);

/* ────────────────────── Input Classification ────────────────────── */

function isUrl(arg) {
  return arg.startsWith("http://") || arg.startsWith("https://");
}

function isFileInput(arg) {
  const ext = extname(arg).toLowerCase();
  return ALL_FILE_EXTS.has(ext);
}

function isFlag(arg) {
  return arg.startsWith("--");
}

function getFileType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (PDF_EXTS.has(ext)) return "pdf";
  return null;
}

/* ────────────────────── Entry ────────────────────── */

export async function reference() {
  const args = process.argv.slice(3);
  const sub = args[0];

  if (sub === "show") return referenceShow();
  if (sub === "clear") return referenceClear();

  return referenceComposite(args);
}

/* ────────────────────── Process File Input ────────────────────── */

function processFileInput(filePath, root) {
  const absPath = isAbsolute(filePath) ? filePath : resolve(filePath);

  if (!existsSync(absPath)) {
    console.error(`  ERROR  File not found: ${absPath}`);
    return null;
  }

  const type = getFileType(absPath);
  if (!type) {
    console.error(`  ERROR  Unsupported file type: ${extname(absPath)}`);
    return null;
  }

  // Sanitize filename
  let name = basename(absPath).toLowerCase().replace(/\s+/g, "-");
  const refsDir = join(root, ".ogu/references");
  mkdirSync(refsDir, { recursive: true });

  // Handle name collisions
  let targetPath = join(refsDir, name);
  if (existsSync(targetPath)) {
    const base = name.replace(/(\.[^.]+)$/, "");
    const ext = extname(name);
    let i = 2;
    while (existsSync(join(refsDir, `${base}-${i}${ext}`))) i++;
    name = `${base}-${i}${ext}`;
    targetPath = join(refsDir, name);
  }

  // Copy file
  copyFileSync(absPath, targetPath);

  // Get PDF page count (simple heuristic)
  let pages = null;
  if (type === "pdf") {
    try {
      const buf = readFileSync(absPath);
      const text = buf.toString("latin1");
      const matches = text.match(/\/Type\s*\/Page[^s]/g);
      pages = matches ? matches.length : null;
    } catch { /* skip */ }
  }

  const relPath = `.ogu/references/${name}`;
  console.log(`  stored   ${name} (${type}${pages ? `, ${pages} pages` : ""})`);

  return {
    type,
    name,
    path: relPath,
    original: absPath,
    added_at: new Date().toISOString(),
    ...(pages != null && { pages }),
  };
}

/* ────────────────────── Scan a single site ────────────────────── */

async function scanSite(url) {
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {
    console.error(`  ERROR  Invalid URL: ${url}`);
    return null;
  }

  const domain = parsedUrl.hostname.replace(/^www\./, "");
  const root = repoRoot();
  const brandsDir = join(root, ".ogu/brands");
  mkdirSync(brandsDir, { recursive: true });
  const brandPath = join(brandsDir, `${domain}.json`);

  // Reuse existing scan if fresh (< 24h)
  if (existsSync(brandPath)) {
    const existing = readJsonSafe(brandPath);
    if (existing?.scanned_at) {
      const age = Date.now() - new Date(existing.scanned_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        console.log(`  cached   ${domain} (scanned ${Math.round(age / 3600000)}h ago)`);
        return existing;
      }
    }
  }

  console.log(`  scan     ${domain}...`);

  let html;
  try {
    html = await fetchPage(url);
  } catch (err) {
    console.error(`  ERROR  Could not fetch ${url}: ${err.message}`);
    return null;
  }

  const cssLinks = extractCssLinks(html, url);
  let allCss = extractInlineStyles(html).join("\n");
  for (const link of cssLinks.slice(0, 20)) {
    try {
      const cssText = await fetchPage(link);
      allCss += "\n" + cssText;
    } catch { /* skip */ }
  }

  const colorCounts = extractAllColors(allCss);
  const colors = clusterColors(colorCounts);
  const typography = extractFonts(allCss, html);
  const spacing = extractSpacing(allCss);
  const radius = extractRadius(allCss);
  const effects = extractEffects(allCss);
  const brandTone = extractBrandTone(html);
  const icons = extractIconLibrary(html, allCss);

  const brandDna = {
    version: 1,
    domain,
    url,
    scanned_at: new Date().toISOString(),
    scan_mode: "lightweight",
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
      all_detected: typography.all_detected.slice(0, 15),
    },
    spacing,
    radius,
    effects,
    brand_tone: brandTone,
    icons,
  };

  writeFileSync(brandPath, JSON.stringify(brandDna, null, 2) + "\n", "utf-8");
  console.log(`  saved    .ogu/brands/${domain}.json`);
  return brandDna;
}

/* ────────────────────── Composite Algorithm ────────────────────── */

const OKLAB_SIMILAR = 0.08; // perceptual "same design family" threshold

/**
 * Group colors by perceptual similarity using OKLab distance.
 * Returns groups sorted largest-first. Each group has { rep, items }.
 */
function groupSimilarColors(candidates, threshold = OKLAB_SIMILAR) {
  const groups = [];
  for (const c of candidates) {
    let placed = false;
    for (const g of groups) {
      if (oklabDistance(g.rep, c) <= threshold) {
        g.items.push(c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({ rep: c, items: [c] });
    }
  }
  groups.sort((a, b) => b.items.length - a.items.length);
  return groups;
}

/**
 * Pick the winning color for a role using perceptual grouping.
 * For accent roles: within the largest group, prefer highest saturation.
 * For bg/text roles: within the largest group, prefer median luminance.
 */
function pickWinner(groups, role) {
  const accentRoles = new Set(["primary", "secondary"]);
  const winner = groups[0];
  if (!winner) return null;

  if (accentRoles.has(role)) {
    winner.items.sort((a, b) => saturation(b) - saturation(a));
  } else {
    winner.items.sort((a, b) => luminance(a) - luminance(b));
  }

  // For accent: highest saturation. For neutral: median luminance.
  const idx = accentRoles.has(role) ? 0 : Math.floor(winner.items.length / 2);
  return winner.items[idx];
}

/**
 * Composite colors from scans with evidence, confidence, and do-not-invent.
 *
 * Returns { [role]: token | null } where token = {
 *   value: hex string,
 *   confidence: agree/total (honest ratio),
 *   agree: number of sources in winning cluster,
 *   total: number of sources with this role,
 *   sources: [{ sourceId, sourceType, value }],
 *   method: "css_text"
 * }
 */
function compositeColors(scans) {
  const roles = ["primary", "secondary", "background", "surface", "text", "text_muted", "error", "success", "warning"];
  // Roles that must exist even with 1 source
  const mustHaveRoles = new Set(["background", "text"]);
  const result = {};

  for (const role of roles) {
    // Build candidates with source tracking
    const candidates = [];
    for (const scan of scans) {
      const hex = scan.colors?.[role];
      if (!hex) continue;
      const rgb = parseHex(hex);
      if (!rgb || rgb.r === undefined) continue;
      candidates.push({
        ...rgb,
        hex,
        sourceId: scan.domain || scan.id || "unknown",
        sourceType: scan.sourceType || "site",
      });
    }

    if (candidates.length === 0) {
      result[role] = null;
      continue;
    }

    // Do-not-invent: non-essential roles need 2+ sources
    const minSources = mustHaveRoles.has(role) ? 1 : 2;
    if (candidates.length < minSources) {
      result[role] = null;
      continue;
    }

    // Group by perceptual similarity, pick winner
    const groups = groupSimilarColors(candidates);
    const winner = pickWinner(groups, role);
    if (!winner) {
      result[role] = null;
      continue;
    }

    const agree = groups[0].items.length;
    const total = candidates.length;

    result[role] = {
      value: winner.hex,
      confidence: total > 0 ? agree / total : 0,
      agree,
      total,
      sources: candidates.map(c => ({
        sourceId: c.sourceId,
        sourceType: c.sourceType,
        value: c.hex,
      })),
      method: "css_text",
    };
  }

  return result;
}

/* ────────────────────── BASE / EXTENDED split ────────────────────── */

const ROLE_CONFIDENCE_THRESHOLDS = {
  background: 0.5,
  surface:    0.5,
  text:       0.5,
  text_muted: 0.5,
  primary:    0.5,
  secondary:  0.67,  // needs stronger agreement
  error:      0.5,
  success:    0.5,
  warning:    0.5,
};

function splitBaseExtended(colors) {
  const base = {};
  const extended = {};

  for (const [role, token] of Object.entries(colors)) {
    extended[role] = token;
    const thr = ROLE_CONFIDENCE_THRESHOLDS[role] ?? 0.5;
    base[role] = (token && token.confidence >= thr) ? token : null;
  }

  return { base, extended };
}

/** Extract plain hex values from a layered color set (for backward compat) */
function flattenColorValues(layered) {
  const flat = {};
  for (const [role, token] of Object.entries(layered)) {
    flat[role] = token ? token.value : null;
  }
  return flat;
}

function compositeFonts(scans) {
  const fontCounts = new Map();
  const monoFontCounts = new Map();
  const googleFontsSet = new Set();

  for (const scan of scans) {
    const typo = scan.typography;
    if (!typo) continue;

    for (const { name, count } of (typo.all_detected || [])) {
      const lower = name.toLowerCase();
      const isMono = lower.includes("mono") || lower.includes("code") ||
        lower.includes("courier") || lower.includes("consolas") ||
        lower === "menlo" || lower === "monaco";

      if (isMono) {
        monoFontCounts.set(name, (monoFontCounts.get(name) || 0) + count);
      } else {
        fontCounts.set(name, (fontCounts.get(name) || 0) + count);
      }
    }

    for (const gf of (typo.google_fonts || [])) {
      googleFontsSet.add(gf);
    }
  }

  const sortedFonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedMono = [...monoFontCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    font_body: sortedFonts[0]?.[0] || null,
    font_heading: sortedFonts[1]?.[0] || sortedFonts[0]?.[0] || null,
    font_mono: sortedMono[0]?.[0] || null,
    google_fonts: [...googleFontsSet],
  };
}

function compositeSpacing(scans) {
  const labels = ["xs", "sm", "md", "lg", "xl", "2xl"];
  const result = {};

  for (const label of labels) {
    const values = scans
      .map(s => s.spacing?.[label])
      .filter(Boolean)
      .map(v => parseInt(v, 10))
      .filter(v => !isNaN(v));

    if (values.length === 0) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const snapped = Math.round(avg / 4) * 4;
    result[label] = `${Math.max(4, snapped)}px`;
  }

  return result;
}

function compositeRadius(scans) {
  const labels = ["sm", "md", "lg"];
  const result = {};

  for (const label of labels) {
    const values = scans
      .map(s => s.radius?.[label])
      .filter(Boolean)
      .map(v => parseInt(v, 10))
      .filter(v => !isNaN(v));

    if (values.length === 0) continue;
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    result[label] = `${median}px`;
  }

  return result;
}

function compositeEffects(scans) {
  const shadows = [];
  const borders = [];

  for (const scan of scans) {
    if (scan.effects?.shadow && scan.effects.shadow !== "none") shadows.push(scan.effects.shadow);
    if (scan.effects?.border_style && scan.effects.border_style !== "none") borders.push(scan.effects.border_style);
  }

  return {
    glow: "none",
    border_style: mostCommonStr(borders) || "none",
    shadow: mostCommonStr(shadows) || "none",
  };
}

function compositeTone(scans) {
  const markerCounts = new Map();
  for (const scan of scans) {
    for (const marker of (scan.brand_tone?.tone_markers || [])) {
      markerCounts.set(marker, (markerCounts.get(marker) || 0) + 1);
    }
  }
  return [...markerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

function compositeIcons(scans) {
  const iconCounts = new Map();
  for (const scan of scans) {
    for (const icon of (scan.icons || [])) {
      iconCounts.set(icon, (iconCounts.get(icon) || 0) + 1);
    }
  }
  if (iconCounts.size === 0) return null;
  return [...iconCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function compositeDarkMode(scans) {
  let dark = 0;
  let light = 0;
  for (const scan of scans) {
    if (scan.colors?.is_dark_mode) dark++;
    else light++;
  }
  return dark >= light;
}

function mostCommonStr(arr) {
  if (arr.length === 0) return null;
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ────────────────────── Main Composite Command ────────────────────── */

async function referenceComposite(args) {
  const flags = args.filter(a => isFlag(a));
  const inputs = args.filter(a => !isFlag(a));
  const applyFlag = flags.includes("--apply");
  const soulFlag = flags.includes("--soul");

  // Classify inputs
  const urls = inputs.filter(a => isUrl(a));
  const files = inputs.filter(a => isFileInput(a));
  const unknown = inputs.filter(a => !isUrl(a) && !isFileInput(a));

  if (unknown.length > 0) {
    for (const u of unknown) {
      console.error(`  WARN   Unrecognized input: ${u} (expected URL or image/PDF file)`);
    }
  }

  const totalInputs = urls.length + files.length;

  if (totalInputs < 2) {
    console.log("Usage: ogu reference <url|file> <url|file> ... [--apply] [--soul]");
    console.log("       ogu reference show      Display current design reference");
    console.log("       ogu reference clear     Remove reference data");
    console.log("\nProvide 2+ inspiration sources (URLs, images, or PDFs).");
    console.log("  Supported files: .png, .jpg, .jpeg, .webp, .pdf");
    console.log("  Example: ogu reference https://linear.app ./mockup.png ./design.pdf");
    return 1;
  }

  if (totalInputs > 7) {
    console.error("  ERROR  Maximum 7 reference inputs allowed.");
    return 1;
  }

  const root = repoRoot();
  const urlLabel = urls.length > 0 ? `${urls.length} site${urls.length > 1 ? "s" : ""}` : "";
  const fileLabel = files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "";
  const parts = [urlLabel, fileLabel].filter(Boolean).join(" + ");

  console.log(`\n  Reference  Compositing design from ${parts}\n`);

  // Process URL inputs — scan sites
  const scans = [];
  for (const url of urls) {
    const scan = await scanSite(url);
    if (scan) scans.push(scan);
  }

  // Process file inputs — copy to .ogu/references/
  const fileSources = [];
  for (const file of files) {
    const result = processFileInput(file, root);
    if (result) fileSources.push(result);
  }

  const totalProcessed = scans.length + fileSources.length;
  if (totalProcessed < 1) {
    console.error("\n  ERROR  No inputs were successfully processed.");
    return 1;
  }

  // Composite URL-based scans (if any)
  let colors = {};
  let typography = { font_body: null, font_heading: null, font_mono: null, google_fonts: [] };
  let spacing = {};
  let radius = {};
  let effects = { glow: "none", border_style: "none", shadow: "none" };
  let toneMarkers = [];
  let icons = null;
  let isDarkMode = false;

  if (scans.length > 0) {
    console.log(`\n  merge    Compositing ${scans.length} site scan${scans.length > 1 ? "s" : ""}...`);
    colors = compositeColors(scans);
    typography = compositeFonts(scans);
    spacing = compositeSpacing(scans);
    radius = compositeRadius(scans);
    effects = compositeEffects(scans);
    toneMarkers = compositeTone(scans);
    icons = compositeIcons(scans);
    isDarkMode = compositeDarkMode(scans);
  }

  // Build per-site data
  const perSite = {};
  for (const scan of scans) {
    perSite[scan.domain] = {
      colors: {
        primary: scan.colors?.primary,
        secondary: scan.colors?.secondary,
        background: scan.colors?.background,
        text: scan.colors?.text,
        is_dark_mode: scan.colors?.is_dark_mode,
      },
      typography: {
        font_body: scan.typography?.font_body,
        font_heading: scan.typography?.font_heading,
      },
      spacing: scan.spacing,
      radius: scan.radius,
      tone: scan.brand_tone?.tone_markers || [],
      icons: scan.icons || [],
    };
  }

  // Build sources list
  const sources = [
    ...scans.map(s => ({
      type: "url",
      domain: s.domain,
      url: s.url,
      scanned_at: s.scanned_at,
    })),
    ...fileSources,
  ];

  // Split colors into BASE (high confidence) and EXTENDED (everything)
  const colorLayers = splitBaseExtended(colors);

  // Build notes
  const notesParts = [];
  const urlDomains = scans.map(s => s.domain);
  const fileNames = fileSources.map(f => f.name);

  if (scans.length > 0) notesParts.push(`Composite from ${scans.length} site${scans.length > 1 ? "s" : ""}.`);
  if (fileSources.length > 0) notesParts.push(`${fileSources.length} image/PDF reference${fileSources.length > 1 ? "s" : ""} pending Claude analysis.`);

  const primaryToken = colorLayers.base.primary || colorLayers.extended.primary;
  if (primaryToken) {
    const topSource = primaryToken.sources?.[0];
    if (topSource) notesParts.push(`Primary color from ${topSource.sourceId}.`);
  }
  if (typography.font_body) {
    const fontSource = scans.find(s => s.typography?.font_body === typography.font_body);
    if (fontSource) notesParts.push(`Body font from ${fontSource.domain}.`);
  }

  // Count how many base tokens survived thresholds
  const baseCount = Object.values(colorLayers.base).filter(Boolean).length;
  const extCount = Object.values(colorLayers.extended).filter(Boolean).length;
  if (baseCount < extCount) {
    notesParts.push(`${extCount - baseCount} color(s) below confidence threshold (extended only).`);
  }

  const referenceData = {
    version: 3,
    created_at: new Date().toISOString(),
    sources,
    composite: {
      colors: colorLayers,
      typography,
      spacing,
      radius,
      effects,
      tone_markers: toneMarkers,
      icons,
      is_dark_mode: isDarkMode,
      meta: {
        doNotInvent: true,
        confidence: "agree_over_total",
        similarThreshold: OKLAB_SIMILAR,
        roleThresholds: ROLE_CONFIDENCE_THRESHOLDS,
      },
    },
    per_site: perSite,
    image_analysis: null,
    notes: notesParts.join(" "),
  };

  // Write REFERENCE.json
  const oguDir = join(root, ".ogu");
  mkdirSync(oguDir, { recursive: true });
  const refPath = join(oguDir, "REFERENCE.json");
  writeFileSync(refPath, JSON.stringify(referenceData, null, 2) + "\n", "utf-8");
  console.log(`\n  saved    .ogu/REFERENCE.json\n`);

  // Print summary table
  printSummary(referenceData);

  // --apply: apply composite to THEME.json (only if we have URL-based data)
  // Uses BASE layer — only high-confidence tokens get applied
  if (applyFlag && scans.length > 0) {
    const baseColors = flattenColorValues(colorLayers.base);
    const fakeBrandDna = {
      domain: "reference-composite",
      url: urls[0],
      colors: { ...baseColors, is_dark_mode: isDarkMode, all_extracted: [] },
      typography: { ...typography, font_face: [], all_detected: [] },
      spacing,
      radius,
      effects,
      brand_tone: { tone_markers: toneMarkers },
      icons: icons ? [icons] : [],
    };
    applyBrandToTheme(root, fakeBrandDna);
  } else if (applyFlag && scans.length === 0) {
    console.log("  info     --apply deferred: image-only references need Claude analysis first.");
    console.log("           Run the /reference skill to analyze images and apply theme.");
  }

  // --soul: update SOUL.md
  if (soulFlag) {
    updateSoulWithReference(root, referenceData);
  }

  // Log
  const allLabels = [...urlDomains, ...fileNames];
  try {
    const { log } = await import("./log.mjs");
    await log([`Design references set: ${allLabels.join(", ")}`]);
  } catch { /* skip */ }

  // Hint about image analysis
  if (fileSources.length > 0) {
    console.log(`  next     Run /reference skill for Claude to analyze ${fileSources.length} image/PDF reference${fileSources.length > 1 ? "s" : ""}`);
  }

  return 0;
}

/* ────────────────────── Print Summary ────────────────────── */

/** Format a color token for display: "hex (conf%)" or "null" */
function fmtToken(token) {
  if (!token) return null;
  if (typeof token === "string") return token; // legacy per-site values
  const pct = Math.round((token.confidence || 0) * 100);
  return `${token.value} ${pct}%`;
}

/** Get the base value for a color role from the layered structure */
function getBaseToken(colors, role) {
  // v3: { base: {...}, extended: {...} }
  if (colors?.base) return colors.base[role] || null;
  // v2 fallback: flat hex values
  const v = colors?.[role];
  return v && typeof v === "string" ? { value: v, confidence: 1, agree: 1, total: 1, sources: [] } : v;
}

function printSummary(ref) {
  const urlSources = ref.sources.filter(s => s.type === "url");
  const fileSources = ref.sources.filter(s => s.type === "image" || s.type === "pdf");
  const domains = urlSources.map(s => s.domain);

  console.log(`  Design Reference Composite`);
  console.log(`  ${"═".repeat(60)}`);

  // URL-based data table
  if (domains.length > 0) {
    const colW = Math.max(...domains.map(d => d.length), 9) + 2;
    const compW = 18; // wider to fit "hex conf%"
    const pad = (s, n) => (s || "–").toString().padEnd(n);

    const header = `  ${"".padEnd(14)} ${domains.map(d => pad(d, colW)).join("")}${"BASE".padEnd(compW)}${"CONF".padEnd(6)}`;
    console.log(header);
    console.log(`  ${"─".repeat(14 + colW * domains.length + compW + 6)}`);

    const colorRoles = ["primary", "secondary", "background", "text"];
    for (const role of colorRoles) {
      const perSiteVals = domains.map(d => pad(ref.per_site[d]?.colors?.[role], colW)).join("");
      const token = getBaseToken(ref.composite.colors, role);
      const val = token ? pad(token.value, compW) : pad(null, compW);
      const conf = token ? `${token.agree}/${token.total}` : "–";
      console.log(`  ${role.padEnd(14)} ${perSiteVals}${val}${conf}`);
    }

    // Non-color rows
    const miscRows = [
      ["dark mode", ...domains.map(d => ref.per_site[d]?.colors?.is_dark_mode ? "yes" : "no"), ref.composite.is_dark_mode ? "yes" : "no"],
      ["body font", ...domains.map(d => ref.per_site[d]?.typography?.font_body), ref.composite.typography?.font_body],
      ["head font", ...domains.map(d => ref.per_site[d]?.typography?.font_heading), ref.composite.typography?.font_heading],
      ["tone", ...domains.map(d => (ref.per_site[d]?.tone || []).slice(0, 2).join(",")), ref.composite.tone_markers?.slice(0, 3).join(",")],
      ["icons", ...domains.map(d => (ref.per_site[d]?.icons || []).join(",")), ref.composite.icons || "–"],
    ];
    for (const [label, ...values] of miscRows) {
      const vals = values.map(v => pad(v, colW)).join("");
      console.log(`  ${label.padEnd(14)} ${vals}`);
    }

    // Show extended-only tokens (below threshold)
    const extended = ref.composite.colors?.extended;
    const base = ref.composite.colors?.base;
    if (extended && base) {
      const extOnly = Object.entries(extended).filter(([role, tok]) => tok && !base[role]);
      if (extOnly.length > 0) {
        console.log(`\n  Extended (below confidence threshold):`);
        for (const [role, tok] of extOnly) {
          console.log(`  ${role.padEnd(14)} ${tok.value} (${tok.agree}/${tok.total} sources agree)`);
        }
      }
    }
  }

  // File-based references
  if (fileSources.length > 0) {
    if (domains.length > 0) console.log("");
    console.log(`  Image/PDF References:`);
    console.log(`  ${"─".repeat(50)}`);

    const analyzed = ref.image_analysis != null;
    for (const src of fileSources) {
      const typeTag = src.type === "pdf" ? `PDF${src.pages ? ` (${src.pages}p)` : ""}` : src.type.toUpperCase();
      const status = analyzed && ref.image_analysis?.[src.name]
        ? "analyzed"
        : "pending analysis";
      console.log(`  ${src.name.padEnd(30)} ${typeTag.padEnd(12)} [${status}]`);
    }

    if (!analyzed) {
      console.log(`\n  Run /reference skill for Claude vision analysis of these files.`);
    }
  }

  console.log(`\n  ${ref.notes}\n`);
}

/* ────────────────────── Show ────────────────────── */

function referenceShow() {
  const root = repoRoot();
  const refPath = join(root, ".ogu/REFERENCE.json");

  if (!existsSync(refPath)) {
    console.log("\n  No design reference yet. Run: ogu reference <url1> <url2> ...\n");
    return 0;
  }

  const ref = readJsonSafe(refPath);
  if (!ref) {
    console.error("  ERROR  Could not read REFERENCE.json");
    return 1;
  }

  const sourceLabels = ref.sources?.map(s => s.domain || s.name).join(", ");
  console.log(`\n  Design Reference (created ${ref.created_at?.split("T")[0] || "?"})`);
  console.log(`  Sources: ${sourceLabels}\n`);

  printSummary(ref);
  return 0;
}

/* ────────────────────── Clear ────────────────────── */

function referenceClear() {
  const root = repoRoot();
  const refPath = join(root, ".ogu/REFERENCE.json");
  const refsDir = join(root, ".ogu/references");

  let cleared = false;

  if (existsSync(refPath)) {
    unlinkSync(refPath);
    cleared = true;
  }

  if (existsSync(refsDir)) {
    rmSync(refsDir, { recursive: true });
    cleared = true;
  }

  if (cleared) {
    console.log("\n  cleared  .ogu/REFERENCE.json and .ogu/references/ removed.\n");
  } else {
    console.log("\n  No design reference to clear.\n");
  }

  return 0;
}

/* ────────────────────── Update SOUL.md ────────────────────── */

function updateSoulWithReference(root, ref) {
  const soulPath = join(root, ".ogu/SOUL.md");
  let content = existsSync(soulPath) ? readFileSync(soulPath, "utf-8") : "# Soul\n";

  const urlSources = ref.sources.filter(s => s.type === "url");
  const fileSources = ref.sources.filter(s => s.type !== "url");

  const urlList = urlSources.map(s => `[${s.domain}](${s.url})`).join(", ");
  const fileList = fileSources.map(s => s.name).join(", ");
  const sourceText = [urlList, fileList].filter(Boolean).join(" + ");

  const c = ref.composite;

  const section = `\n## Design References

Composited from ${sourceText} on ${ref.created_at.split("T")[0]}.

- **Primary color**: ${c.colors?.base?.primary?.value || c.colors?.primary || "not detected"}${c.colors?.base?.primary ? ` (${c.colors.base.primary.agree}/${c.colors.base.primary.total} agree)` : ""}
- **Background**: ${c.colors?.base?.background?.value || c.colors?.background || "not detected"}
- **Fonts**: ${c.typography?.font_body || "not detected"} (body), ${c.typography?.font_heading || "not detected"} (headings)
- **Dark mode**: ${c.is_dark_mode ? "yes" : "no"}
- **Tone**: ${c.tone_markers?.join(", ") || "not detected"}
- **Icons**: ${c.icons || "not detected"}
${fileSources.length > 0 ? `- **Image references**: ${fileList}\n` : ""}`;

  if (content.includes("## Design References")) {
    content = content.replace(/\n## Design References[\s\S]*?(?=\n## |$)/, section);
  } else {
    content = content.trimEnd() + "\n" + section;
  }

  writeFileSync(soulPath, content, "utf-8");
  console.log("  updated  .ogu/SOUL.md with design references");
}
