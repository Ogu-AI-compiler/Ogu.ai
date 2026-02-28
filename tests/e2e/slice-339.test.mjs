import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 339 — Lint Rule Runner + Lint Reporter\x1b[0m\n');
console.log('\x1b[36m  Part 1: Lint Rule Runner\x1b[0m');
test('lint-rule-runner.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/lint-rule-runner.mjs')));
const { createLintRuleRunner } = await import('../../tools/ogu/commands/lib/lint-rule-runner.mjs');
test('run rules', () => { const lr = createLintRuleRunner(); lr.addRule('no-console', 'warning', code => { const m = []; code.split('\n').forEach((l, i) => { if (l.includes('console.log')) m.push({ line: i + 1, message: 'no console.log' }); }); return m; }); const issues = lr.run('x = 1\nconsole.log(x)'); assert.equal(issues.length, 1); assert.equal(issues[0].rule, 'no-console'); });
test('no issues', () => { const lr = createLintRuleRunner(); lr.addRule('r', 'error', () => []); assert.equal(lr.run('clean code').length, 0); });
test('remove rule', () => { const lr = createLintRuleRunner(); lr.addRule('r', 'error', () => [{ message: 'x' }]); lr.removeRule('r'); assert.equal(lr.run('x').length, 0); });
test('list rules', () => { const lr = createLintRuleRunner(); lr.addRule('a', 'error', () => []); lr.addRule('b', 'warning', () => []); assert.equal(lr.listRules().length, 2); });

console.log('\n\x1b[36m  Part 2: Lint Reporter\x1b[0m');
test('lint-reporter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/lint-reporter.mjs')));
const { createLintReporter } = await import('../../tools/ogu/commands/lib/lint-reporter.mjs');
const reporter = createLintReporter();
test('format text', () => { const t = reporter.formatText([{ severity: 'error', rule: 'r1', message: 'bad', line: 5 }]); assert.ok(t.includes('error')); assert.ok(t.includes('r1')); });
test('summary', () => { const s = reporter.summary([{ severity: 'error' }, { severity: 'warning' }, { severity: 'error' }]); assert.equal(s.errors, 2); assert.equal(s.warnings, 1); });
test('hasErrors', () => { assert.ok(reporter.hasErrors([{ severity: 'error' }])); assert.ok(!reporter.hasErrors([{ severity: 'warning' }])); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
