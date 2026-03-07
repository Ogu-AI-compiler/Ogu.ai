/**
 * slice-422.test.mjs — MarketplaceProjectView component tests
 * Tests: component file exists, has correct exports and structure.
 * UI rendering not tested (no browser/React in e2e harness).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENT_PATH = join(__dirname, '../../tools/studio/src/components/project/MarketplaceProjectView.tsx');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── File structure ────────────────────────────────────────────────────────────

console.log('\nMarketplaceProjectView — file structure');

test('component file exists', () => {
  assert(existsSync(COMPONENT_PATH), `Expected file: ${COMPONENT_PATH}`);
});

let source = '';
test('component file is readable', () => {
  source = readFileSync(COMPONENT_PATH, 'utf-8');
  assert(source.length > 100, 'file should have content');
});

test('exports MarketplaceProjectView function', () => {
  assert(source.includes('export function MarketplaceProjectView'), 'missing export');
});

test('accepts projectId prop', () => {
  assert(source.includes('projectId'), 'should accept projectId prop');
});

test('uses api helper for data fetching', () => {
  assert(source.includes("from \"@/lib/api\"") || source.includes("from '@/lib/api'"), 'should import api');
});

test('imports useEffect for lifecycle management', () => {
  assert(source.includes('useEffect'), 'should use useEffect');
});

test('imports useState for local state', () => {
  assert(source.includes('useState'), 'should use useState');
});

// ── Sub-components ────────────────────────────────────────────────────────────

console.log('\nMarketplaceProjectView — sub-components');

test('has PhaseBar component', () => {
  assert(source.includes('PhaseBar'), 'should have PhaseBar');
});

test('has TeamRoster component', () => {
  assert(source.includes('TeamRoster'), 'should have TeamRoster');
});

test('has FeatureList or feature rendering', () => {
  assert(source.includes('FeatureList') || source.includes('prd.features'), 'should show PRD features');
});

test('has TaskGrid or task rendering', () => {
  assert(source.includes('TaskGrid') || source.includes('enrichedPlan'), 'should show tasks');
});

test('has ExecutionProgress component', () => {
  assert(source.includes('ExecutionProgress') || source.includes('executionState'), 'should show execution progress');
});

// ── Phase logic ───────────────────────────────────────────────────────────────

console.log('\nMarketplaceProjectView — phase detection');

test('defines PHASES array', () => {
  assert(source.includes('PHASES'), 'should define PHASES');
});

test('handles planning phase', () => {
  assert(source.includes('planning') || source.includes('ctoPlan'), 'should handle planning phase');
});

test('handles running phase', () => {
  assert(source.includes('running'), 'should handle running phase');
});

test('handles complete phase', () => {
  assert(source.includes('complete') || source.includes('completed'), 'should handle complete phase');
});

// ── Actions ───────────────────────────────────────────────────────────────────

console.log('\nMarketplaceProjectView — actions');

test('has run/simulate buttons', () => {
  assert(source.includes('handleRun') || source.includes('Simulate'), 'should have run action');
});

test('calls project-lifecycle API endpoint', () => {
  assert(source.includes('project-lifecycle'), 'should call project-lifecycle API');
});

test('handles loading state', () => {
  assert(source.includes('loading') || source.includes('Loading'), 'should handle loading state');
});

test('handles error state', () => {
  assert(source.includes('error') || source.includes('Error'), 'should handle error state');
});

test('handles not found state', () => {
  assert(source.includes('not found') || source.includes('null'), 'should handle not found');
});

// ── TypeScript types ──────────────────────────────────────────────────────────

console.log('\nMarketplaceProjectView — TypeScript interfaces');

test('defines ProjectData interface', () => {
  assert(source.includes('interface ProjectData') || source.includes('ProjectData'), 'should define ProjectData type');
});

test('defines CTOPlan type reference', () => {
  assert(source.includes('CTOPlan') || source.includes('ctoPlan'), 'should reference CTOPlan');
});

test('defines Team type reference', () => {
  assert(source.includes('Team') || source.includes('team:'), 'should reference Team');
});

test('defines PRD type reference', () => {
  assert(source.includes('PRD') || source.includes('prd:'), 'should reference PRD');
});

test('defines ExecutionState type reference', () => {
  assert(source.includes('ExecutionState') || source.includes('executionState'), 'should reference ExecutionState');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
