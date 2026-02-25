import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot, readJsonSafe } from "../util.mjs";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

export async function vision() {
  const args = process.argv.slice(3);

  // Handle baseline subcommand
  if (args[0] === "baseline") {
    return handleBaseline(args.slice(1));
  }

  const slug = args[0];
  if (!slug) {
    console.error("Usage: ogu vision <slug>");
    console.error("       ogu vision baseline record <slug>");
    console.error("       ogu vision baseline update <slug> --screen <name>");
    console.error("       ogu vision baseline list <slug>");
    return 1;
  }

  const root = repoRoot();

  // Check Playwright availability
  if (!checkPlaywright()) {
    console.error("  ERROR  Playwright not found.");
    console.error("  Install: npm init playwright@latest");
    return 1;
  }

  // Read and parse visual spec from Spec.md
  const specPath = join(root, `docs/vault/04_Features/${slug}/Spec.md`);
  if (!existsSync(specPath)) {
    console.error(`  ERROR  Spec.md not found: docs/vault/04_Features/${slug}/Spec.md`);
    return 1;
  }

  const specContent = readFileSync(specPath, "utf-8");
  const screens = parseVisualSpec(specContent);

  if (screens.length === 0) {
    console.log("  No visual spec blocks found in Spec.md.");
    console.log("  Add screen definitions under ## UI Components with the visual spec format.");
    return 0;
  }

  // Save extracted spec as machine-readable JSON
  const visionDir = join(root, `.ogu/vision/${slug}`);
  mkdirSync(join(visionDir, "current"), { recursive: true });
  mkdirSync(join(visionDir, "baselines"), { recursive: true });
  mkdirSync(join(visionDir, "diffs"), { recursive: true });

  const visionSpec = { feature: slug, screens };
  writeFileSync(join(visionDir, "VISION_SPEC.json"), JSON.stringify(visionSpec, null, 2) + "\n", "utf-8");
  console.log(`  spec     ${screens.length} screens extracted`);

  // Tier 1: DOM assertions
  const tier1Results = await runDOMAssertions(root, slug, screens);

  // Tier 2: Screenshot capture + diff
  const tier2Results = await captureScreenshots(root, slug, screens);

  // Tier 3: Vision model comparison (done by /vision skill, not CLI)
  // CLI prepares the data, skill does the visual analysis

  // Generate report
  const report = buildVisionReport(slug, screens, tier1Results, tier2Results);
  const reportPath = join(visionDir, "VISION_REPORT.md");
  writeFileSync(reportPath, report, "utf-8");

  // Summary
  const tier1Pass = tier1Results.filter((r) => r.passed).length;
  const tier2Pass = tier2Results.filter((r) => r.status === "captured" || r.status === "matched").length;

  console.log("");
  console.log(`  Vision: ${slug}`);
  console.log(`  Tier 1 (DOM):        ${tier1Pass}/${tier1Results.length} passed`);
  console.log(`  Tier 2 (Screenshot): ${tier2Pass}/${tier2Results.length} captured`);
  console.log(`  Tier 3 (AI Vision):  Pending — run /vision skill to complete`);
  console.log(`  report   .ogu/vision/${slug}/VISION_REPORT.md`);

  return tier1Pass === tier1Results.length ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Baseline management
// ---------------------------------------------------------------------------

async function handleBaseline(args) {
  const subcommand = args[0];
  const slug = args[1];

  if (!subcommand || !slug) {
    console.error("Usage: ogu vision baseline <record|update|list> <slug>");
    return 1;
  }

  const root = repoRoot();
  const visionDir = join(root, `.ogu/vision/${slug}`);

  switch (subcommand) {
    case "record": {
      // Capture fresh screenshots and save as baselines
      if (!checkPlaywright()) {
        console.error("  ERROR  Playwright not found.");
        return 1;
      }

      const specPath = join(root, `docs/vault/04_Features/${slug}/Spec.md`);
      if (!existsSync(specPath)) {
        console.error(`  ERROR  Spec.md not found for ${slug}`);
        return 1;
      }

      const screens = parseVisualSpec(readFileSync(specPath, "utf-8"));
      if (screens.length === 0) {
        console.log("  No visual spec blocks found.");
        return 0;
      }

      mkdirSync(join(visionDir, "baselines"), { recursive: true });
      mkdirSync(join(visionDir, "current"), { recursive: true });

      const results = await captureScreenshots(root, slug, screens);
      let recorded = 0;
      for (const r of results) {
        if (r.status === "captured" && r.screenshotPath) {
          const baselineName = r.screenshotPath.split("/").pop();
          const baselinePath = join(visionDir, "baselines", baselineName);
          copyFileSync(r.screenshotPath, baselinePath);
          console.log(`  baseline ${baselineName}`);
          recorded++;
        }
      }
      console.log(`\n  ${recorded} baselines recorded for "${slug}"`);
      return 0;
    }

    case "update": {
      const screenFlag = args.indexOf("--screen");
      const screenName = screenFlag !== -1 ? args[screenFlag + 1] : null;

      const currentDir = join(visionDir, "current");
      const baselineDir = join(visionDir, "baselines");

      if (!existsSync(currentDir)) {
        console.error("  ERROR  No current screenshots. Run `ogu vision <slug>` first.");
        return 1;
      }

      mkdirSync(baselineDir, { recursive: true });
      let updated = 0;

      const files = readdirSync(currentDir).filter((f) => f.endsWith(".png"));
      for (const file of files) {
        if (screenName && !file.includes(screenName)) continue;
        copyFileSync(join(currentDir, file), join(baselineDir, file));
        console.log(`  updated  ${file}`);
        updated++;
      }
      console.log(`\n  ${updated} baselines updated`);
      return 0;
    }

    case "list": {
      const baselineDir = join(visionDir, "baselines");
      if (!existsSync(baselineDir)) {
        console.log("  No baselines recorded yet.");
        return 0;
      }

      const files = readdirSync(baselineDir).filter((f) => f.endsWith(".png"));
      if (files.length === 0) {
        console.log("  No baselines recorded yet.");
        return 0;
      }

      console.log(`  Baselines for "${slug}":`);
      for (const file of files) {
        console.log(`    ${file}`);
      }
      console.log(`\n  ${files.length} baselines total`);
      return 0;
    }

    default:
      console.error(`  ERROR  Unknown baseline subcommand: ${subcommand}`);
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Visual spec parsing
// ---------------------------------------------------------------------------

function parseVisualSpec(specContent) {
  const screens = [];
  const lines = specContent.split("\n");
  let current = null;
  let section = null;

  for (const line of lines) {
    // Detect screen definition: ### Screen: <name>
    const screenMatch = line.match(/^###\s+Screen:\s*(.+)/i);
    if (screenMatch) {
      if (current) screens.push(current);
      current = {
        name: screenMatch[1].trim(),
        route: null,
        states: [],
        critical_selectors: [],
        critical_text: [],
        layout_assertions: [],
      };
      section = null;
      continue;
    }

    if (!current) continue;

    // Parse key-value lines
    const routeMatch = line.match(/^-\s*route:\s*(.+)/i);
    if (routeMatch) {
      current.route = routeMatch[1].trim();
      continue;
    }

    const statesMatch = line.match(/^-\s*states:\s*\[(.+)\]/i);
    if (statesMatch) {
      current.states = statesMatch[1].split(",").map((s) => s.trim());
      continue;
    }

    // Detect section headers
    if (line.match(/^-\s*critical_selectors:/i)) {
      section = "selectors";
      continue;
    }
    if (line.match(/^-\s*critical_text:\s*\[(.+)\]/i)) {
      const textMatch = line.match(/\[(.+)\]/);
      if (textMatch) {
        current.critical_text = textMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }
      section = null;
      continue;
    }
    if (line.match(/^-\s*layout_assertions:/i)) {
      section = "layout";
      continue;
    }

    // Parse list items under current section
    const listMatch = line.match(/^\s+-\s+(.+)/);
    if (listMatch && section) {
      const value = listMatch[1].trim();
      if (section === "selectors") {
        const selectorMatch = value.match(/\[([^\]]+)\]\s*[—–-]\s*(.+)/);
        if (selectorMatch) {
          current.critical_selectors.push({
            selector: `[${selectorMatch[1]}]`,
            assertion: selectorMatch[2].trim(),
          });
        }
      } else if (section === "layout") {
        current.layout_assertions.push(value);
      }
    }

    // Detect next top-level section (stops current screen)
    if (line.match(/^##\s/) && current) {
      screens.push(current);
      current = null;
      section = null;
    }
  }

  if (current) screens.push(current);
  return screens;
}

// ---------------------------------------------------------------------------
// Tier 1: DOM assertions
// ---------------------------------------------------------------------------

async function runDOMAssertions(root, slug, screens) {
  const results = [];

  for (const screen of screens) {
    if (!screen.route) {
      results.push({ screen: screen.name, passed: false, errors: ["No route defined"] });
      continue;
    }

    const assertions = [];

    // Build assertion checks
    for (const sel of screen.critical_selectors) {
      assertions.push({
        type: "selector",
        selector: sel.selector,
        assertion: sel.assertion,
      });
    }

    for (const text of screen.critical_text) {
      assertions.push({
        type: "text",
        text,
      });
    }

    // Generate Playwright test script for DOM assertions
    const port = 3000; // Default preview port
    const url = `http://localhost:${port}${screen.route}`;
    const script = generateDOMTestScript(url, assertions);

    try {
      const output = execSync(`node -e ${JSON.stringify(script)}`, {
        cwd: root,
        encoding: "utf-8",
        timeout: 30000,
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
      });

      const result = JSON.parse(output.trim());
      results.push({
        screen: screen.name,
        route: screen.route,
        passed: result.errors.length === 0,
        assertions_passed: result.passed,
        assertions_total: result.total,
        errors: result.errors,
      });
    } catch (err) {
      results.push({
        screen: screen.name,
        route: screen.route,
        passed: false,
        errors: [`DOM test failed: ${err.message?.split("\n")[0] || "Unknown error"}`],
      });
    }
  }

  return results;
}

function generateDOMTestScript(url, assertions) {
  const checks = assertions.map((a) => {
    if (a.type === "selector") {
      return `
        try {
          const el = await page.locator('${a.selector.replace(/'/g, "\\'")}');
          const count = await el.count();
          if (count === 0) errors.push('Missing: ${a.selector}');
          else passed++;
          total++;
        } catch(e) { errors.push('Error checking ${a.selector}: ' + e.message); total++; }`;
    }
    if (a.type === "text") {
      return `
        try {
          const found = await page.locator('text="${a.text.replace(/"/g, '\\"')}"').count();
          if (found === 0) errors.push('Missing text: "${a.text}"');
          else passed++;
          total++;
        } catch(e) { errors.push('Error checking text "${a.text}": ' + e.message); total++; }`;
    }
    return "";
  }).join("\n");

  return `
const { chromium } = require('playwright');
(async () => {
  const errors = [];
  let passed = 0;
  let total = 0;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: ${DESKTOP_VIEWPORT.width}, height: ${DESKTOP_VIEWPORT.height} } });
    await page.goto('${url}', { waitUntil: 'networkidle', timeout: 15000 });
    ${checks}
  } catch(e) {
    errors.push('Navigation failed: ' + e.message);
  } finally {
    if (browser) await browser.close();
  }
  console.log(JSON.stringify({ passed, total, errors }));
})();
  `.trim();
}

// ---------------------------------------------------------------------------
// Tier 2: Screenshot capture + diff
// ---------------------------------------------------------------------------

async function captureScreenshots(root, slug, screens) {
  const results = [];
  const visionDir = join(root, `.ogu/vision/${slug}`);
  const currentDir = join(visionDir, "current");
  mkdirSync(currentDir, { recursive: true });

  for (const screen of screens) {
    if (!screen.route) {
      results.push({ screen: screen.name, status: "skipped", reason: "No route" });
      continue;
    }

    const port = 3000;
    const url = `http://localhost:${port}${screen.route}`;
    const screenshotName = `${sanitize(screen.name)}-loaded.png`;
    const screenshotPath = join(currentDir, screenshotName);

    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: ${DESKTOP_VIEWPORT.width}, height: ${DESKTOP_VIEWPORT.height} } });
  await page.goto('${url}', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: '${screenshotPath.replace(/'/g, "\\'")}', fullPage: true });
  await browser.close();
  console.log('OK');
})();
    `.trim();

    try {
      execSync(`node -e ${JSON.stringify(script)}`, {
        cwd: root,
        encoding: "utf-8",
        timeout: 30000,
      });

      // Check for baseline diff
      const baselinePath = join(visionDir, "baselines", screenshotName);
      let diffStatus = "captured";

      if (existsSync(baselinePath)) {
        // Baselines exist — compare (pixel diff done by /vision skill)
        diffStatus = "baseline-exists";
      }

      results.push({
        screen: screen.name,
        status: diffStatus,
        screenshotPath,
        baselineExists: existsSync(baselinePath),
      });

      console.log(`  capture  ${screenshotName}`);
    } catch (err) {
      results.push({
        screen: screen.name,
        status: "failed",
        error: err.message?.split("\n")[0] || "Screenshot capture failed",
      });
      console.log(`  FAIL     ${screenshotName}: ${err.message?.split("\n")[0]}`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildVisionReport(slug, screens, tier1Results, tier2Results) {
  const now = new Date().toISOString();
  let md = `# Vision Report: ${slug}\n\n`;
  md += `Built: ${now}\n\n`;

  // Summary
  const tier1Pass = tier1Results.filter((r) => r.passed).length;
  const tier2Captured = tier2Results.filter((r) => r.status !== "failed").length;

  md += `## Summary\n\n`;
  md += `| Tier | Result | Detail |\n|---|---|---|\n`;
  md += `| 1. DOM Assertions | ${tier1Pass}/${tier1Results.length} passed | Selectors, text, layout |\n`;
  md += `| 2. Screenshots | ${tier2Captured}/${tier2Results.length} captured | Pixel comparison |\n`;
  md += `| 3. AI Vision | Pending | Run /vision skill |\n\n`;

  // Per-screen details
  md += `## Screens\n\n`;
  for (const screen of screens) {
    md += `### ${screen.name}\n\n`;
    md += `- Route: \`${screen.route || "none"}\`\n`;
    md += `- States: ${screen.states.join(", ") || "none defined"}\n\n`;

    // Tier 1
    const t1 = tier1Results.find((r) => r.screen === screen.name);
    if (t1) {
      md += `**Tier 1 — DOM:** ${t1.passed ? "PASS" : "FAIL"}`;
      if (t1.assertions_total) md += ` (${t1.assertions_passed}/${t1.assertions_total})`;
      md += "\n";
      if (t1.errors?.length > 0) {
        for (const e of t1.errors) {
          md += `  - ${e}\n`;
        }
      }
      md += "\n";
    }

    // Tier 2
    const t2 = tier2Results.find((r) => r.screen === screen.name);
    if (t2) {
      md += `**Tier 2 — Screenshot:** ${t2.status}\n`;
      if (t2.screenshotPath) {
        md += `  - Path: ${relative(join(repoRoot(), `.ogu/vision/${slug}`), t2.screenshotPath)}\n`;
      }
      if (t2.baselineExists) {
        md += `  - Baseline: exists (diff pending)\n`;
      } else {
        md += `  - Baseline: none — run \`ogu vision baseline record ${slug}\` to set\n`;
      }
      if (t2.error) {
        md += `  - Error: ${t2.error}\n`;
      }
      md += "\n";
    }

    // Tier 3 placeholder
    md += `**Tier 3 — AI Vision:** Pending\n`;
    md += `  - Screenshot and Spec.md ready for /vision skill analysis\n\n`;
  }

  // Visual spec
  md += `## Visual Spec (extracted)\n\n`;
  md += `See VISION_SPEC.json for machine-readable format.\n\n`;
  for (const screen of screens) {
    md += `### ${screen.name}\n`;
    if (screen.critical_selectors.length > 0) {
      md += `Selectors:\n`;
      for (const s of screen.critical_selectors) {
        md += `  - \`${s.selector}\` — ${s.assertion}\n`;
      }
    }
    if (screen.critical_text.length > 0) {
      md += `Text: ${screen.critical_text.join(", ")}\n`;
    }
    if (screen.layout_assertions.length > 0) {
      md += `Layout:\n`;
      for (const a of screen.layout_assertions) {
        md += `  - ${a}\n`;
      }
    }
    md += "\n";
  }

  return md;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkPlaywright() {
  try {
    execSync("npx playwright --version", { encoding: "utf-8", timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function sanitize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
