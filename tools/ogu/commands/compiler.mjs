/**
 * ogu compiler <id> <slug> [component]
 *
 * Run a domain compiler against a feature or component directory.
 *
 * Usage:
 *   ogu compiler react-component my-feature Button
 *   ogu compiler react-component my-feature Button --skip-tests
 *   ogu compiler react-component my-feature Button --skip-typecheck
 *   ogu compiler react-component my-feature Button --phase 2
 *   ogu compiler react-component my-feature Button --gates spec-valid,export-valid
 *   ogu compiler list
 *   ogu compiler info react-component
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dir = join(fileURLToPath(import.meta.url), "../../compilers");

const COLORS = {
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", gray: "\x1b[90m", bold: "\x1b[1m", reset: "\x1b[0m",
};
const c = (col, str) => `${COLORS[col]}${str}${COLORS.reset}`;

function usage() {
  console.log(`
${c("bold", "ogu compiler")} — Domain compiler runner

${c("cyan", "Usage:")}
  ogu compiler list                              List available compilers
  ogu compiler info <id>                         Show compiler definition
  ogu compiler <id> <slug> [component] [flags]   Run compiler

${c("cyan", "Flags:")}
  --skip-tests        Skip render/a11y/coverage gates
  --skip-typecheck    Skip TypeScript gate
  --phase <N>         Start from phase N (resume)
  --gates <a,b,c>     Run only these gates
  --dir <path>        Override component directory
  --verbose           Show gate detail output

${c("cyan", "Examples:")}
  ogu compiler react-component my-feature Button
  ogu compiler react-component my-feature Button --skip-tests
  ogu compiler react-component my-feature Button --phase 2
  ogu compiler list
`);
}


function resolveComponentDir(root, slug, component) {
  if (component) {
    // Try feature dir first
    const featureDir = join(root, ".ogu", "features", slug, "components", component);
    if (existsSync(featureDir)) return featureDir;
    // Try src/components
    const srcDir = join(root, "src", "components", component);
    if (existsSync(srcDir)) return srcDir;
    // Fall back to feature root
    const featureRoot = join(root, ".ogu", "features", slug);
    if (existsSync(featureRoot)) return featureRoot;
  }
  return join(root, ".ogu", "features", slug);
}

function printGateResult(gate) {
  const icon = gate.skipped ? c("gray", "○") : gate.pass ? c("green", "✓") : c("red", "✗");
  const status = gate.skipped ? c("gray", "skip") : gate.pass ? c("green", "pass") : c("red", "FAIL");
  const msg = gate.message ? ` — ${gate.skipped ? c("gray", gate.message || "") : gate.pass ? c("gray", gate.message || "") : c("red", gate.message)}` : "";
  console.log(`  ${icon} ${gate.id.padEnd(20)} ${status}${msg}`);
}

export async function run(args) {
  // Support both: called with explicit args array, or via CLI (reads process.argv)
  const argv = args ?? process.argv.slice(3);
  const [sub, ...rest] = argv;

  if (!sub || sub === "--help" || sub === "-h") { usage(); return; }

  if (sub === "list") {
    const ids = existsSync(__dir)
      ? readdirSync(__dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
      : [];
    if (!ids.length) { console.log(c("gray", "No compilers registered.")); return; }
    console.log(c("bold", "\nRegistered Domain Compilers:\n"));
    for (const id of ids) {
      const defPath = join(__dir, id, "compiler.json");
      if (existsSync(defPath)) {
        const def = JSON.parse(readFileSync(defPath, "utf8"));
        console.log(`  ${c("cyan", id.padEnd(24))} ${def.title}`);
      } else {
        console.log(`  ${c("gray", id.padEnd(24))} (no compiler.json)`);
      }
    }
    console.log();
    return;
  }

  if (sub === "info") {
    const id = rest[0];
    if (!id) { console.error(c("red", "Usage: ogu compiler info <id>")); process.exit(1); }
    const defPath = join(__dir, id, "compiler.json");
    if (!existsSync(defPath)) { console.error(c("red", `Compiler not found: ${id}`)); process.exit(1); }
    const def = JSON.parse(readFileSync(defPath, "utf8"));
    console.log(`\n${c("bold", def.title)} (${def.id} v${def.version})`);
    console.log(c("gray", def.description));
    console.log(`\n${c("cyan", "Phases:")}`);
    for (const phase of def.pipeline) {
      const gates = phase.gates.length ? `[${phase.gates.join(", ")}]` : "(no gates)";
      console.log(`  ${phase.phase}: ${phase.title.padEnd(16)} ${c("gray", gates)}`);
    }
    console.log(`\n${c("cyan", "Gates:")}`);
    for (const gate of def.gates) {
      const req = gate.required ? c("red", "required") : c("gray", "optional");
      console.log(`  ${gate.id.padEnd(20)} phase ${gate.phase}  ${req}`);
      console.log(`    ${c("gray", gate.description)}`);
    }
    console.log(`\n${c("cyan", "Error Codes:")}`);
    for (const [code, msg] of Object.entries(def.error_codes || {})) {
      console.log(`  ${c("yellow", code)}  ${msg}`);
    }
    console.log();
    return;
  }

  // sub = compiler id
  const compilerId = sub;
  const slug = rest[0];
  const component = rest[1];

  if (!slug) {
    console.error(c("red", `Usage: ogu compiler ${compilerId} <slug> [component]`));
    process.exit(1);
  }

  const compilerPath = join(__dir, compilerId, "runner.mjs");
  if (!existsSync(compilerPath)) {
    console.error(c("red", `Unknown compiler: ${compilerId}`));
    process.exit(1);
  }

  // Parse flags
  const flags = rest.slice(component ? 2 : 1);
  const skipTests = flags.includes("--skip-tests");
  const skipTypecheck = flags.includes("--skip-typecheck");
  const verbose = flags.includes("--verbose");

  const phaseIdx = flags.indexOf("--phase");
  const startPhase = phaseIdx >= 0 ? parseInt(flags[phaseIdx + 1], 10) : undefined;

  const gatesIdx = flags.indexOf("--gates");
  const onlyGates = gatesIdx >= 0 ? flags[gatesIdx + 1]?.split(",") : null;

  const dirIdx = flags.indexOf("--dir");
  const overrideDir = dirIdx >= 0 ? resolve(flags[dirIdx + 1]) : null;

  const root = process.env.OGU_ROOT || process.cwd();
  const dir = overrideDir || resolveComponentDir(root, slug, component);
  const name = component || slug;

  const compilerDef = JSON.parse(readFileSync(join(__dir, compilerId, "compiler.json"), "utf8"));
  console.log(`\n${c("bold", compilerDef.title)}`);
  console.log(`${c("gray", "compiler:")} ${compilerId}  ${c("gray", "target:")} ${name}  ${c("gray", "dir:")} ${dir}`);
  if (startPhase) console.log(`${c("yellow", `Resuming from phase ${startPhase}`)}`);
  console.log();

  const { runCompiler, runGates, getCompilerDef } = await import(compilerPath);

  let result;

  if (onlyGates) {
    console.log(`${c("cyan", "Running gates:")} ${onlyGates.join(", ")}\n`);
    const gateResults = await runGates(onlyGates, { dir, name, projectRoot: root });
    for (const g of gateResults) printGateResult(g);
    console.log();
    const failed = gateResults.filter(g => !g.pass && !g.skipped);
    if (failed.length) {
      console.log(c("red", `\n${failed.length} gate(s) failed`));
      process.exit(1);
    }
    console.log(c("green", "All gates passed."));
    return;
  }

  result = await runCompiler({
    dir,
    name,
    projectRoot: root,
    options: { skipTests, skipTypecheck, startPhase },
    onProgress(gate) {
      printGateResult(gate);
      if (verbose && gate.detail) {
        console.log(c("gray", "    " + JSON.stringify(gate.detail).slice(0, 120)));
      }
    },
  });

  console.log();
  console.log("─".repeat(50));

  if (result.success) {
    console.log(c("green", `\n✓ Compilation successful — ${result.name}`));
    console.log(`  Gates: ${c("green", result.gates.passed + " passed")}  ${result.gates.skipped ? c("gray", result.gates.skipped + " skipped  ") : ""}${c("gray", `${result.elapsed_ms}ms`)}`);
    if (result.artifact) {
      console.log(`  Artifact: ${c("cyan", dir + "/" + (compilerDef.ir?.output_artifact || "artifact.json"))}`);
      console.log(`  Hash: ${c("gray", result.artifact.attestation_hash)}`);
    }
  } else {
    console.log(c("red", `\n✗ Compilation failed — ${result.name}`));
    console.log(`  Gates passed: ${result.gates.passed}  Failed: ${c("red", String(result.gates.failed))}`);
    for (const f of result.failures) {
      console.log(`  ${c("red", f.code || "RC000")} ${f.id}: ${f.message}`);
      if (verbose && f.detail) {
        console.log(c("gray", "    " + JSON.stringify(f.detail).slice(0, 200)));
      }
    }
    process.exit(1);
  }
}
