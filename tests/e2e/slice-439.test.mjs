/**
 * Slice 439 — Experience Digest Per Agent
 * Tests persistent experience files, digest loading, decay, dedup, and injection.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  saveExperienceDigest,
  loadExperienceDigest,
  appendExperienceRule,
  deduplicateRules,
  decayRules,
  buildInjectionBlock,
  getExperienceForPrompt,
  MAX_EXPERIENCE_RULES,
} from '../../tools/ogu/commands/lib/experience-digest.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 439: Experience Digest Per Agent ===\n');

const TMP = join(process.cwd(), '.tmp-test-439');
function setup() { rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); }
function cleanup() { rmSync(TMP, { recursive: true, force: true }); }

// ── saveExperienceDigest / loadExperienceDigest ─────────────────────────────

test('save and load experience digest round-trip', () => {
  setup();
  const digest = {
    agentId: 'agent_0001',
    rules: [
      { text: 'Always validate input before DB write', source: 'gate_failure', addedAt: '2026-03-01', uses: 3 },
      { text: 'Prefer named exports over default', source: 'review', addedAt: '2026-03-02', uses: 1 },
    ],
  };
  saveExperienceDigest(TMP, 'agent_0001', digest);
  const loaded = loadExperienceDigest(TMP, 'agent_0001');
  assert.equal(loaded.agentId, 'agent_0001');
  assert.equal(loaded.rules.length, 2);
  assert.equal(loaded.rules[0].text, 'Always validate input before DB write');
  cleanup();
});

test('loadExperienceDigest returns empty for missing agent', () => {
  setup();
  const loaded = loadExperienceDigest(TMP, 'nonexistent');
  assert.equal(loaded.agentId, 'nonexistent');
  assert.equal(loaded.rules.length, 0);
  cleanup();
});

test('saveExperienceDigest creates directory if needed', () => {
  setup();
  saveExperienceDigest(TMP, 'agent_0005', { agentId: 'agent_0005', rules: [] });
  assert.ok(existsSync(join(TMP, '.ogu', 'marketplace', 'experience')));
  cleanup();
});

// ── appendExperienceRule ────────────────────────────────────────────────────

test('appendExperienceRule adds a new rule', () => {
  setup();
  saveExperienceDigest(TMP, 'agent_0001', { agentId: 'agent_0001', rules: [] });
  const result = appendExperienceRule(TMP, 'agent_0001', {
    text: 'Check for null before accessing nested props',
    source: 'gate_failure',
  });
  assert.ok(result.added);
  const loaded = loadExperienceDigest(TMP, 'agent_0001');
  assert.equal(loaded.rules.length, 1);
  assert.equal(loaded.rules[0].text, 'Check for null before accessing nested props');
  assert.ok(loaded.rules[0].addedAt);
  assert.equal(loaded.rules[0].uses, 0);
  cleanup();
});

test('appendExperienceRule deduplicates exact text', () => {
  setup();
  saveExperienceDigest(TMP, 'agent_0001', {
    agentId: 'agent_0001',
    rules: [{ text: 'Always validate input', source: 'review', addedAt: '2026-03-01', uses: 2 }],
  });
  const result = appendExperienceRule(TMP, 'agent_0001', {
    text: 'Always validate input',
    source: 'gate_failure',
  });
  assert.equal(result.added, false);
  assert.equal(result.reason, 'duplicate');
  const loaded = loadExperienceDigest(TMP, 'agent_0001');
  assert.equal(loaded.rules.length, 1);
  assert.equal(loaded.rules[0].uses, 3); // incremented
  cleanup();
});

test('appendExperienceRule caps at MAX_EXPERIENCE_RULES', () => {
  setup();
  const rules = Array.from({ length: MAX_EXPERIENCE_RULES }, (_, i) => ({
    text: `Rule ${i}`, source: 'test', addedAt: '2026-03-01', uses: 0,
  }));
  saveExperienceDigest(TMP, 'agent_0001', { agentId: 'agent_0001', rules });

  const result = appendExperienceRule(TMP, 'agent_0001', {
    text: 'New rule beyond cap',
    source: 'test',
  });
  assert.ok(result.added);
  const loaded = loadExperienceDigest(TMP, 'agent_0001');
  // Should have removed the least-used rule and added the new one
  assert.equal(loaded.rules.length, MAX_EXPERIENCE_RULES);
  assert.ok(loaded.rules.some(r => r.text === 'New rule beyond cap'));
  cleanup();
});

// ── deduplicateRules ────────────────────────────────────────────────────────

test('deduplicateRules removes exact duplicates, keeps highest uses', () => {
  const rules = [
    { text: 'Rule A', uses: 3, addedAt: '2026-03-01' },
    { text: 'Rule B', uses: 1, addedAt: '2026-03-01' },
    { text: 'Rule A', uses: 5, addedAt: '2026-03-02' },
  ];
  const deduped = deduplicateRules(rules);
  assert.equal(deduped.length, 2);
  const ruleA = deduped.find(r => r.text === 'Rule A');
  assert.equal(ruleA.uses, 5);
});

test('deduplicateRules returns empty for empty input', () => {
  assert.deepEqual(deduplicateRules([]), []);
});

// ── decayRules ──────────────────────────────────────────────────────────────

test('decayRules removes rules with uses=0 older than threshold', () => {
  const rules = [
    { text: 'Old unused', uses: 0, addedAt: '2025-01-01' },
    { text: 'Old used', uses: 5, addedAt: '2025-01-01' },
    { text: 'Recent unused', uses: 0, addedAt: new Date().toISOString().slice(0, 10) },
  ];
  const decayed = decayRules(rules, 30); // 30 day threshold
  assert.equal(decayed.length, 2);
  assert.ok(decayed.some(r => r.text === 'Old used'));
  assert.ok(decayed.some(r => r.text === 'Recent unused'));
});

test('decayRules keeps all rules within threshold', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rules = [
    { text: 'A', uses: 0, addedAt: today },
    { text: 'B', uses: 0, addedAt: today },
  ];
  const decayed = decayRules(rules, 30);
  assert.equal(decayed.length, 2);
});

// ── buildInjectionBlock ─────────────────────────────────────────────────────

test('buildInjectionBlock formats rules as markdown checklist', () => {
  const rules = [
    { text: 'Validate input before DB write', uses: 5 },
    { text: 'Prefer named exports', uses: 2 },
  ];
  const block = buildInjectionBlock(rules);
  assert.ok(block.includes('## Agent Experience'));
  assert.ok(block.includes('- Validate input before DB write'));
  assert.ok(block.includes('- Prefer named exports'));
});

test('buildInjectionBlock returns empty string for no rules', () => {
  assert.equal(buildInjectionBlock([]), '');
});

test('buildInjectionBlock sorts by uses desc', () => {
  const rules = [
    { text: 'Low use', uses: 1 },
    { text: 'High use', uses: 10 },
    { text: 'Mid use', uses: 5 },
  ];
  const block = buildInjectionBlock(rules);
  const lines = block.split('\n').filter(l => l.startsWith('- '));
  assert.ok(lines[0].includes('High use'));
  assert.ok(lines[1].includes('Mid use'));
  assert.ok(lines[2].includes('Low use'));
});

// ── getExperienceForPrompt ──────────────────────────────────────────────────

test('getExperienceForPrompt loads and formats for injection', () => {
  setup();
  saveExperienceDigest(TMP, 'agent_0001', {
    agentId: 'agent_0001',
    rules: [
      { text: 'Always check types', source: 'gate_failure', addedAt: '2026-03-01', uses: 3 },
      { text: 'Use async/await not .then', source: 'review', addedAt: '2026-03-01', uses: 1 },
    ],
  });

  const block = getExperienceForPrompt(TMP, 'agent_0001');
  assert.ok(block.includes('## Agent Experience'));
  assert.ok(block.includes('Always check types'));
  assert.ok(block.includes('Use async/await'));
  cleanup();
});

test('getExperienceForPrompt returns empty for agent without experience', () => {
  setup();
  const block = getExperienceForPrompt(TMP, 'nonexistent');
  assert.equal(block, '');
  cleanup();
});

test('getExperienceForPrompt respects maxRules parameter', () => {
  setup();
  const rules = Array.from({ length: 20 }, (_, i) => ({
    text: `Rule ${i}`, source: 'test', addedAt: '2026-03-01', uses: 20 - i,
  }));
  saveExperienceDigest(TMP, 'agent_0001', { agentId: 'agent_0001', rules });

  const block = getExperienceForPrompt(TMP, 'agent_0001', { maxRules: 5 });
  const lines = block.split('\n').filter(l => l.startsWith('- '));
  assert.equal(lines.length, 5);
  cleanup();
});

// ── MAX_EXPERIENCE_RULES ────────────────────────────────────────────────────

test('MAX_EXPERIENCE_RULES is a reasonable number', () => {
  assert.ok(typeof MAX_EXPERIENCE_RULES === 'number');
  assert.ok(MAX_EXPERIENCE_RULES >= 20);
  assert.ok(MAX_EXPERIENCE_RULES <= 100);
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
cleanup();
process.exit(failed > 0 ? 1 : 0);
