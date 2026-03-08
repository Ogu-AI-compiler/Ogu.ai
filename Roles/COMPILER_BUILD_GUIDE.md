# Compiler Build Guide — Domain Compiler Network

> Paste this prompt into a new session and append: "Build the compiler for role: **[ROLE_NAME]**."
> The session will read the research files you've attached for that role and use this guide as its standard.

---

## Mission

You are building a **sub-compiler** for the Domain Compiler Network.
A compiler is the enforcement layer between intent (spec) and verified code.
It is the hardest, most permanent thing we build — bugs here propagate silently into every artifact this system ever produces.

**Quality over speed. Always.**
Do not rush. Do not skip. Do not approximate.
A compiler written at 70% quality causes 100% of the bugs that reach production undetected.

---

## First: Read the Research Files

Before writing a single line of code, read every research file provided for this role.
These files define the artifact type, the invariants, what "correct" means, and what the common failure modes are.
Only after you fully understand the domain do you begin writing gates.

---

## What You Are Building

For each compiler you will produce exactly **four deliverables**:

```
tools/ogu/compilers/{tier}/{artifact-type}/
  gates/          ← N gate files (the enforcement logic)
  contracts/      ← 1 contract JSON (the machine-readable rules)
  runner.mjs      ← sequential gate executor + artifact writer
  prompt.md       ← agent-facing spec (what to produce and how)
```

Where `{tier}` is: `backend`, `frontend`, `qa`, `devops`, `security`, or `data`.

---

## No Agents

**You build everything yourself, line by line.**
Do not delegate gate writing to sub-agents.
Do not generate stubs and fill them in later.
Do not write a gate and say "add real logic here".

Every gate must be fully implemented, handle edge cases, and be ready to run against real code the moment you write it.
This is a compiler. Partial implementations are broken implementations.

---

## Gate Standard

### Signature (non-negotiable)

```javascript
export async function run({ dir, projectRoot, spec }) {
  // returns:
  return {
    pass: true | false,
    code: 'XX###',          // unique error code for this gate
    message: 'short summary',
    detail: 'optional multi-line explanation',  // only on failure
    skipped: true,          // only when the gate is not applicable
  };
}
```

`dir` = the artifact directory being compiled.
`projectRoot` = repo root (for cross-cutting checks). Optional — only used when needed.
`spec` = parsed spec object from the spec JSON. Optional — only use when needed.

### Error Code Namespaces

Each compiler owns a prefix. Assign codes sequentially.
Example: if your compiler prefix is `SV`, your gates are `SV001`, `SV002`, ..., `SV00N`.
No two gates in the same compiler share a code.
No two compilers in the network share a prefix.

### File Discovery — Never Hardcode Filenames

**This is the most common bug in the codebase. Do not repeat it.**

BAD:
```javascript
const content = readFileSync(join(dir, 'handler.ts'), 'utf8');
```

GOOD:
```javascript
function getSourceFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.ts$/) && !f.name.match(/\.(test|spec|d)\./)) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}
```

Pattern must match the artifact type (`.service.ts`, `.repository.ts`, `.tx.ts`, `*.test.ts`, etc.).

### Import Correctness

`execFileSync` and `spawnSync` live in `'child_process'`, not `'fs'`.
`readdirSync`, `readFileSync`, `existsSync`, `writeFileSync` live in `'fs'`.
Never mix these. A wrong import crashes the gate at runtime with a silent false-pass.

```javascript
// CORRECT
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';  // only when running tests/tsc
```

### Optional Spec Files

When a gate reads an optional spec file (e.g. `service-spec.json`), guard with `existsSync`:

```javascript
import { existsSync, readFileSync } from 'fs';

const specPath = join(dir, 'service-spec.json');
if (!existsSync(specPath)) {
  return { pass: true, code: 'SV001', message: 'No spec file found — gate skipped', skipped: true };
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
```

Never use dynamic `import('fs')` in synchronous gate logic. Always use static imports at the top of the file.

### Skipped Gates

Return `{ pass: true, skipped: true }` when the gate is not applicable to this artifact.
Examples:
- No service files found → skip the HTTP-import gate
- No idempotent use cases declared → skip the idempotency gate
- Spec has no isolated scenarios → skip the isolation gate

A skipped gate is a passing gate. It is not a failure. Runner counts it separately.

### Empty File-Set Handling

```javascript
const files = getSourceFiles(dir);
if (files.length === 0) {
  return { pass: true, code: 'SV002', message: 'No source files found — gate skipped', skipped: true };
}
```

### Escape Hatches

When a pattern is valid but the gate would flag it, support an inline escape hatch comment:

```javascript
// @raw-sql-ok: using stored proc for bulk insert performance
// @assertion-free-ok: this test only validates no throw
```

Check for the escape hatch on the flagged line before pushing a violation:

```javascript
if (PATTERN.test(line) && !line.includes('// @raw-sql-ok')) {
  violations.push(...);
}
```

### Per-Call-Site Evaluation

When checking for patterns that must be paired (e.g. cache miss → origin fallback), evaluate **per call site**, not globally across all files.
A global flag that is set by any file masks violations in other files.

```javascript
// WRONG — global flag hides violations in file B when file A is correct
let hasOriginFallback = false;
for (const file of files) {
  if (/cache\.get/.test(content)) hasCacheGet = true;
  if (/origin/.test(content)) hasOriginFallback = true;
}

// CORRECT — evaluate each call site independently
for (const file of files) {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (/cache\.get/.test(line)) {
      const window = lines.slice(i, i + 30).join('\n');
      if (!/origin|fallback|fetch/.test(window)) {
        violations.push(`${file}: cache.get at line ${i+1} has no origin fallback`);
      }
    }
  });
}
```

### Regex Safety

When interpolating dynamic values into RegExp, always escape:

```javascript
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const pattern = new RegExp(`\\b${escapeRegex(method.name)}\\s*\\(`);
```

### Code Style

- No minified code. Ever. Not even helper functions.
- One statement per line.
- Named functions, not anonymous lambdas for helpers.
- Comments on non-obvious logic.
- Violations array collected, then returned once — never multiple early returns inside a loop.

---

## How Many Gates

Design the gate set by asking: **"What are all the ways this artifact can be wrong?"**

Typical gate categories for a compiler:

| Category | What to check |
|----------|--------------|
| `spec-valid` | Required fields exist, types correct, enum values in range |
| `ts-valid` | TypeScript compilation passes (`tsc --noEmit`) |
| `no-any` | No explicit `any` types |
| `no-todos` | No TODO/FIXME/HACK in source |
| `no-{forbidden-pattern}` | Domain-specific antipattern (raw SQL, HTTP in service, env vars in domain, etc.) |
| `{concept}-declared` | Required architectural pattern is present (isolation level, idempotency key, etc.) |
| `{concept}-typed` | Return types are typed, not void or implicit |
| `tests-pass` | Test suite passes (vitest → jest fallback) |
| `coverage` | Coverage meets threshold from spec |
| `contract-{name}` | Artifact validates against the compiler's own contract JSON |

Minimum: **6 gates**. Typical: **8–12 gates**. There is no maximum.
When in doubt, add the gate. A gate that almost never fires is still valuable — it fires the one time it matters.

### `tests-pass.mjs` — Standard Pattern

```javascript
import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

function findTestFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(test|spec)\.(ts|tsx|mjs|js)$/)) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const testFiles = findTestFiles(dir);
  if (testFiles.length === 0) {
    return { pass: false, code: 'XX00N', message: 'No test files found' };
  }

  // Try vitest first, fall back to jest
  for (const runner of ['vitest', 'jest']) {
    const result = spawnSync(
      'npx', [runner, '--reporter=json', '--passWithNoTests', ...testFiles],
      { cwd: dir, encoding: 'utf8', timeout: 60000 }
    );
    if (result.status === null) continue; // not installed
    try {
      const json = JSON.parse(result.stdout);
      const numFailed = json.numFailedTests ?? 0;
      if (numFailed === 0) return { pass: true, code: 'XX00N', message: `All tests pass (${json.numPassedTests ?? 0} passed)` };
      return { pass: false, code: 'XX00N', message: `${numFailed} test(s) failed`, detail: result.stdout.slice(0, 500) };
    } catch { continue; }
  }

  return { pass: false, code: 'XX00N', message: 'Could not run tests (vitest/jest not found)' };
}
```

### `no-todos.mjs` — Standard Pattern

```javascript
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** XX00N — no-todos */
export async function run({ dir }) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(ts|mjs|js|json)$/) && !f.name.match(/\.d\./)) {
        files.push(join(d, f.name));
      }
    }
  }
  walk(dir);

  const violations = [];
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${line.trim().slice(0, 60)}`);
      }
    });
  }

  if (violations.length) {
    return { pass: false, code: 'XX00N', message: `${violations.length} TODO/FIXME/HACK`, detail: violations.slice(0, 10).join('\n') };
  }
  return { pass: true, code: 'XX00N', message: `No TODO/FIXME/HACK (${files.length} file(s))` };
}
```

---

## runner.mjs — Standard Pattern

```javascript
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const GATES_DIR = new URL('./gates/', import.meta.url).pathname;
const COMPILER  = 'your-artifact-type';      // snake_case
const ARTIFACT  = 'your-artifact.json';      // written to dir on pass

export async function run({ dir, verbose = false }) {
  const gateFiles = readdirSync(GATES_DIR).filter(f => f.endsWith('.mjs')).sort();
  const results   = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const gateFile of gateFiles) {
    const gateModule = await import(join(GATES_DIR, gateFile));
    let result;
    try {
      result = await gateModule.run({ dir });
    } catch (err) {
      result = { pass: false, code: 'RUNTIME', message: `Gate threw: ${err.message}` };
    }

    results.push({ gate: gateFile.replace('.mjs', ''), ...result });
    if (result.skipped)   skipped++;
    else if (result.pass) passed++;
    else                  failed++;

    if (verbose) {
      const icon = result.skipped ? '⏭' : result.pass ? '✓' : '✗';
      console.log(`  ${icon} [${result.code}] ${result.message}`);
      if (result.detail && !result.pass) {
        console.log('    ' + String(result.detail).split('\n').slice(0, 8).join('\n    '));
      }
    }
  }

  const overallPass = failed === 0;
  const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');

  const artifact = {
    compiler:  COMPILER,
    version:   '1.0.0',
    tier:      'backend',     // or frontend / qa / devops / security / data
    pass:      overallPass,
    gatesRun:  gateFiles.length,
    passed, failed, skipped,
    hash,
    timestamp: new Date().toISOString(),
    gates:     results,
  };

  if (overallPass) {
    writeFileSync(join(dir, ARTIFACT), JSON.stringify(artifact, null, 2));
  }

  return artifact;
}
```

**Rules for the runner:**
- Always sort gate files alphabetically (`sort()`) for deterministic order
- Catch exceptions per-gate so one broken gate doesn't abort the run
- Write the artifact JSON only on full pass — never write a partial/failed artifact
- The attestation hash is `sha256(JSON.stringify(gates_results))` — the full gate result array

---

## contracts/{name}.contract.json — Standard Pattern

```json
{
  "id": "your-artifact-type",
  "version": "1.0.0",
  "description": "One sentence: what this artifact is and what makes it valid.",
  "rules": [
    { "id": "rule-id-kebab", "description": "What must be true. Specific. Testable." },
    { "id": "rule-id-kebab", "description": "Another invariant." }
  ]
}
```

**Rules for the contract:**
- One rule per invariant. No compound "and" rules — split them.
- Every gate should map to at least one contract rule.
- Every contract rule should be enforced by at least one gate.
- Descriptions are written for a human auditor, not for the gate. They explain the *why*.
- `version` starts at `"1.0.0"`. Bump major on breaking changes.

---

## prompt.md — Standard Pattern

The prompt is the agent-facing documentation: what the compiler produces, what the spec shape is, and what the hard constraints are.

Structure:
1. **Role** — one sentence: what this compiler does
2. **Your Output** — list all files produced, with phases (phase 0 = parse intent, phase 2 = implement, phase 3 = test, phase 5 = attest)
3. **Spec Shape** — exact JSON structure with field names, types, and examples
4. **Hard Gates** — one section per non-obvious gate, with BAD/GOOD code examples
5. **Contract** — a compliant "gold standard" example that passes all gates
6. **What You Never Do** — short bullet list of forbidden patterns

---

## Self-Check Before You Commit

Run this mental checklist after writing each gate:

- [ ] No hardcoded filenames (`handler.ts`, `middleware.ts`, `index.ts`)
- [ ] `execFileSync`/`spawnSync` imported from `'child_process'`
- [ ] No dynamic `import('fs')` inside gate logic — static imports only
- [ ] Empty file-set returns `skipped: true`, not `pass: false`
- [ ] Optional spec files guarded with `existsSync`
- [ ] Dynamic regex values escaped with `escapeRegex()`
- [ ] Per-call-site evaluation for paired-pattern checks (cache, locks, transactions)
- [ ] Escape hatch comments checked per line before flagging violation
- [ ] No minified code — every function fully formatted
- [ ] Gate returns a `detail` string (not object) when `pass: false`
- [ ] Error code is unique within this compiler's namespace
- [ ] Gate handles the case where dir has 0 relevant files

---

## Quality Bar

Ask yourself this about each gate:

> "If a developer submitted a spec that violates this rule, would my gate catch it with a clear, actionable error message? And if their spec is correct, does my gate pass without false positives?"

If the answer to either question is "maybe" — rewrite the gate.
The compiler is the last line of defense before broken code reaches production.
There is no patch later. There is only getting it right now.
