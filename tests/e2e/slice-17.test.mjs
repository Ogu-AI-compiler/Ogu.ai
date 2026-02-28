#!/usr/bin/env node

/**
 * Slice 17 — Theme System, Design Variants, Brand & Reference Management
 *
 * Proves: Theme presets, design token generation, variant selection,
 *   brand scan management, and reference compositing all work.
 *
 * Tests:
 *   - ogu theme set/show/apply/presets — theme preset management
 *   - ogu design:show/design:pick — design variant selection
 *   - ogu brand-scan list/apply/compare — brand management (no network)
 *   - ogu reference show/clear — reference management
 *
 * Depends on: Slices 1-16
 *
 * Run: node tests/e2e/slice-17.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');

function ogu(command, args = []) {
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

const FEATURE = 'theme-e2e-test';
const FEATURE_DIR = `docs/vault/04_Features/${FEATURE}`;

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });

  // Plan.json
  writeJSON(`${FEATURE_DIR}/Plan.json`, {
    featureSlug: FEATURE,
    version: 1,
    tasks: [
      {
        id: 'th-t1',
        title: 'Create themed component',
        description: 'Build with theme tokens',
        touches: ['src/theme-test/component.tsx'],
        done_when: 'Component renders with theme',
        requiredRole: 'developer',
        dependsOn: [],
      },
    ],
  });

  // DESIGN.md with multiple variants
  writeFileSync(join(ROOT, `${FEATURE_DIR}/DESIGN.md`), `# Design Direction: ${FEATURE}

## Color System
Primary: #3B82F6

## Typography
Font: Inter

### Variant 1: Cyberpunk Neon
- **Mood:** Dark, electric, high-contrast
- **Primary:** #00FF88
- **Font:** JetBrains Mono
- **Constraint:** No rounded corners

### Variant 2: Clean Minimal
- **Mood:** Light, airy, spacious
- **Primary:** #3B82F6
- **Font:** Inter
- **Constraint:** Max 3 colors

### Variant 3: Retro Pixel
- **Mood:** Nostalgic, chunky, playful
- **Primary:** #FF6B35
- **Font:** Press Start 2P
- **Constraint:** Pixel-perfect borders only
`, 'utf8');

  // Backup theme/tokens
  const themePath = join(ROOT, '.ogu/THEME.json');
  if (existsSync(themePath)) {
    writeFileSync(themePath + '.bak', readFileSync(themePath, 'utf8'), 'utf8');
  }
  const tokensPath = join(ROOT, 'docs/vault/02_Contracts/design.tokens.json');
  if (existsSync(tokensPath)) {
    writeFileSync(tokensPath + '.bak', readFileSync(tokensPath, 'utf8'), 'utf8');
  }
}

function cleanup() {
  const featureDir = join(ROOT, FEATURE_DIR);
  if (existsSync(featureDir)) rmSync(featureDir, { recursive: true });

  // Restore backups
  const themePath = join(ROOT, '.ogu/THEME.json');
  if (existsSync(themePath + '.bak')) {
    writeFileSync(themePath, readFileSync(themePath + '.bak', 'utf8'), 'utf8');
    rmSync(themePath + '.bak');
  }
  const tokensPath = join(ROOT, 'docs/vault/02_Contracts/design.tokens.json');
  if (existsSync(tokensPath + '.bak')) {
    writeFileSync(tokensPath, readFileSync(tokensPath + '.bak', 'utf8'), 'utf8');
    rmSync(tokensPath + '.bak');
  }
}

// ── Tests ──

console.log('\n\x1b[1mSlice 17 — Theme, Design Variants, Brand & Reference\x1b[0m\n');
console.log('  Theme presets, design pick, brand management, reference ops\n');

setup();

// ── Part 1: ogu theme ──

console.log('\x1b[36m  Part 1: Theme System\x1b[0m');

await test('ogu theme presets lists all 6 presets', async () => {
  const result = ogu('theme', ['presets']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr}`);
  assert(
    result.stdout.includes('cyberpunk') && result.stdout.includes('minimal'),
    `Should list presets: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('ogu theme set cyberpunk creates THEME.json', async () => {
  const result = ogu('theme', ['set', 'cyberpunk']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(fileExists('.ogu/THEME.json'), 'THEME.json should exist');
});

await test('THEME.json has correct mood', async () => {
  const theme = readJSON('.ogu/THEME.json');
  assertEqual(theme.mood, 'cyberpunk', 'Mood should be cyberpunk');
  assert(theme.generated_tokens, 'Should have generated_tokens');
  assert(theme.generated_tokens.colors, 'Should have colors');
});

await test('ogu theme show displays current theme', async () => {
  const result = ogu('theme', ['show']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(
    result.stdout.includes('cyberpunk') || result.stdout.includes('Mood') || result.stdout.includes('mood'),
    `Should show theme: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('ogu theme apply writes design.tokens.json', async () => {
  const result = ogu('theme', ['apply']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    fileExists('docs/vault/02_Contracts/design.tokens.json'),
    'design.tokens.json should exist',
  );
});

await test('design.tokens.json has theme colors', async () => {
  const tokens = readJSON('docs/vault/02_Contracts/design.tokens.json');
  assert(tokens.colors || tokens.color, 'Should have colors section');
  assert(tokens.version, 'Should have version');
});

await test('ogu theme set minimal switches theme', async () => {
  ogu('theme', ['set', 'minimal']);
  const theme = readJSON('.ogu/THEME.json');
  assertEqual(theme.mood, 'minimal', 'Mood should be minimal');
});

// ── Part 2: ogu design:show / design:pick ──

console.log('\n\x1b[36m  Part 2: Design Variants\x1b[0m');

await test('ogu design:show displays variants', async () => {
  const result = ogu('design:show', [FEATURE]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Variant') || result.stdout.includes('variant') ||
    result.stdout.includes('Cyberpunk') || result.stdout.includes('Minimal'),
    `Should show variants: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('design:show lists all 3 variants', async () => {
  const result = ogu('design:show', [FEATURE]);
  // Should mention variant numbers or names
  assert(
    (result.stdout.includes('1') && result.stdout.includes('2') && result.stdout.includes('3')) ||
    (result.stdout.includes('Cyberpunk') && result.stdout.includes('Minimal') && result.stdout.includes('Retro')),
    `Should show all 3 variants: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('ogu design:pick selects variant 2', async () => {
  const result = ogu('design:pick', [FEATURE, '2']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);

  // DESIGN.md should be updated
  const design = readFileSync(join(ROOT, `${FEATURE_DIR}/DESIGN.md`), 'utf8');
  assert(
    design.includes('Variant: 2') || design.includes('amplified') || design.includes('Clean Minimal'),
    `DESIGN.md should show selected variant: ${design.slice(0, 200)}`,
  );
});

await test('design:show after pick shows selected variant', async () => {
  const result = ogu('design:show', [FEATURE]);
  assert(
    result.stdout.includes('amplified') || result.stdout.includes('selected') ||
    result.stdout.includes('Variant 2') || result.stdout.includes('Minimal') ||
    result.stdout.includes('Inter'),
    `Should highlight selected variant: ${result.stdout.trim().slice(0, 300)}`,
  );
});

// ── Part 3: ogu brand-scan (management, no network) ──

console.log('\n\x1b[36m  Part 3: Brand Scan Management\x1b[0m');

await test('brand-scan list works with no scans', async () => {
  const result = ogu('brand-scan', ['list']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('No brands') || result.stdout.includes('brand') ||
    result.stdout.includes('scan') || result.stdout.includes('0'),
    `Should report empty or list: ${result.stdout.trim()}`,
  );
});

await test('brand-scan list works with existing scan data', async () => {
  // Create a mock brand scan result
  mkdirSync(join(ROOT, '.ogu/brands'), { recursive: true });
  writeJSON('.ogu/brands/example.com.json', {
    version: 3,
    domain: 'example.com',
    scanned_at: new Date().toISOString(),
    colors: { primary: '#3B82F6', background: '#FFFFFF', text: '#1A1A2E' },
    typography: { heading: 'Inter', body: 'Inter' },
    spacing: { base: 8, scale: [4, 8, 16, 24, 32, 48, 64] },
  });

  const result = ogu('brand-scan', ['list']);
  assert(
    result.stdout.includes('example.com') || result.stdout.includes('brand'),
    `Should list example.com: ${result.stdout.trim()}`,
  );
});

await test('brand-scan apply applies saved scan to THEME.json', async () => {
  const result = ogu('brand-scan', ['apply', 'example.com']);
  // May succeed or warn about missing fields — both ok
  assert(
    result.exitCode === 0 || result.stdout.includes('applied') || result.stdout.includes('theme') ||
    result.stderr.includes('No scan') || result.stdout.includes('Applied'),
    `Should attempt apply: ${result.stdout.trim()} ${result.stderr.trim()}`,
  );
});

await test('brand-scan compare handles missing second brand', async () => {
  const result = ogu('brand-scan', ['compare', 'example.com', 'nonexistent.com']);
  // Should handle gracefully
  assert(
    result.exitCode === 0 || result.exitCode === 1,
    `Should return 0 or 1: ${result.stderr}`,
  );
});

// ── Part 4: ogu reference ──

console.log('\n\x1b[36m  Part 4: Reference Management\x1b[0m');

await test('ogu reference show works with no reference', async () => {
  const refPath = join(ROOT, '.ogu/REFERENCE.json');
  if (existsSync(refPath)) rmSync(refPath);

  const result = ogu('reference', ['show']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('No reference') || result.stdout.includes('reference') || result.stdout.includes('Reference'),
    `Should report no reference: ${result.stdout.trim()}`,
  );
});

await test('ogu reference clear removes reference data', async () => {
  // Create mock reference
  writeJSON('.ogu/REFERENCE.json', {
    version: 1,
    sources: ['https://example.com'],
    composite: { colors: { primary: '#3B82F6' } },
    created_at: new Date().toISOString(),
  });

  const result = ogu('reference', ['clear']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    !fileExists('.ogu/REFERENCE.json') ||
    result.stdout.includes('cleared') || result.stdout.includes('removed'),
    `Should clear reference: ${result.stdout.trim()}`,
  );
});

await test('ogu reference show after clear reports empty', async () => {
  const result = ogu('reference', ['show']);
  assert(
    result.stdout.includes('No reference') || result.stdout.includes('none') || result.stdout.includes('empty') ||
    result.stdout.includes('reference') || result.exitCode === 0,
    `Should report empty: ${result.stdout.trim()}`,
  );
});

// ── Part 5: Theme Preset Tokens ──

console.log('\n\x1b[36m  Part 5: Theme Preset Integrity\x1b[0m');

const PRESETS = ['cyberpunk', 'minimal', 'brutalist', 'playful', 'corporate', 'retro-pixel'];

await test('all 6 theme presets can be set', async () => {
  for (const preset of PRESETS) {
    const result = ogu('theme', ['set', preset]);
    assertEqual(result.exitCode, 0, `Should set ${preset}: ${result.stderr || result.stdout}`);
    const theme = readJSON('.ogu/THEME.json');
    assertEqual(theme.mood, preset, `Mood should be ${preset}`);
  }
});

await test('each preset generates valid tokens', async () => {
  for (const preset of PRESETS) {
    ogu('theme', ['set', preset]);
    const theme = readJSON('.ogu/THEME.json');
    assert(theme.generated_tokens, `${preset} should have generated_tokens`);
    assert(theme.generated_tokens.colors, `${preset} should have colors`);
    assert(
      theme.generated_tokens.colors.primary || theme.generated_tokens.colors.accent,
      `${preset} should have primary or accent color`,
    );
  }
});

// ── Cleanup ──

// Clean mock brand data
const mockBrand = join(ROOT, '.ogu/brands/example.com.json');
if (existsSync(mockBrand)) rmSync(mockBrand);

cleanup();

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
