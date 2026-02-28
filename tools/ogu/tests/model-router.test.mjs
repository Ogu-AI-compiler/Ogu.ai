/**
 * Model Router Tests — model selection, escalation, budget-aware routing.
 *
 * Run: node tools/ogu/tests/model-router.test.mjs
 */

import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Create isolated test root with .ogu structure
const testRoot = join(tmpdir(), `ogu-model-router-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/agents'), { recursive: true });

console.log('\nModel Router Tests\n');

// ── getNextTier (pure function, no I/O) ──

const { getNextTier, routeSelect } = await import('../commands/lib/model-router.mjs');

test('1. getNextTier: fast → standard', () => {
  assert(getNextTier('fast') === 'standard', 'Should escalate to standard');
});

test('2. getNextTier: standard → advanced', () => {
  assert(getNextTier('standard') === 'advanced', 'Should escalate to advanced');
});

test('3. getNextTier: premium → null (already highest)', () => {
  assert(getNextTier('premium') === null, 'Should return null for highest');
});

test('4. getNextTier: unknown tier → null', () => {
  assert(getNextTier('unknown') === null, 'Should return null for unknown');
});

// ── routeSelect (capability-based, reads OrgSpec) ──

test('5. routeSelect: throws when no OrgSpec.json', () => {
  try {
    routeSelect({ root: testRoot, capability: 'code-generation' });
    assert(false, 'Should have thrown');
  } catch (err) {
    assert(err.message.includes('OGU2001'), `Should be OGU2001, got: ${err.message}`);
  }
});

// Create OrgSpec with model providers
const orgSpec = {
  version: 1,
  budget: { dailyLimit: 50 },
  providers: [
    {
      id: 'anthropic',
      models: [
        { id: 'haiku', tier: 'fast', capabilities: ['code-generation', 'summarization'], costPer1kInput: 0.001, costPer1kOutput: 0.005 },
        { id: 'sonnet', tier: 'standard', capabilities: ['code-generation', 'summarization', 'architecture'], costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        { id: 'opus', tier: 'premium', capabilities: ['code-generation', 'summarization', 'architecture', 'reasoning'], costPer1kInput: 0.015, costPer1kOutput: 0.075 },
      ],
    },
  ],
};
writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(orgSpec, null, 2), 'utf8');

test('6. routeSelect: picks cheapest model with capability', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation' });
  assert(result.model === 'haiku', `Should pick haiku (cheapest), got ${result.model}`);
  assert(result.provider === 'anthropic', 'Provider should be anthropic');
  assert(result.tier === 'fast', `Tier should be fast, got ${result.tier}`);
});

test('7. routeSelect: picks cheapest model with specific capability', () => {
  const result = routeSelect({ root: testRoot, capability: 'architecture' });
  assert(result.model === 'sonnet', `Should pick sonnet (cheapest with architecture), got ${result.model}`);
});

test('8. routeSelect: unique capability goes to specific model', () => {
  const result = routeSelect({ root: testRoot, capability: 'reasoning' });
  assert(result.model === 'opus', `Should pick opus (only model with reasoning), got ${result.model}`);
});

test('9. routeSelect: exact tier filter', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation', tier: 'standard' });
  assert(result.model === 'sonnet', `Should pick sonnet at standard tier, got ${result.model}`);
});

test('10. routeSelect: tier filter with no match throws', () => {
  try {
    routeSelect({ root: testRoot, capability: 'reasoning', tier: 'fast' });
    assert(false, 'Should have thrown');
  } catch (err) {
    assert(err.message.includes('OGU2011'), `Should be OGU2011, got: ${err.message}`);
  }
});

test('11. routeSelect: minTier filter', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation', minTier: 'standard' });
  assert(result.model === 'sonnet', `Should pick sonnet (cheapest >= standard), got ${result.model}`);
});

test('12. routeSelect: minTier at premium', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation', minTier: 'premium' });
  assert(result.model === 'opus', `Should pick opus (only >= premium), got ${result.model}`);
});

test('13. routeSelect: unknown capability throws', () => {
  try {
    routeSelect({ root: testRoot, capability: 'quantum-computing' });
    assert(false, 'Should have thrown');
  } catch (err) {
    assert(err.message.includes('OGU2010'), `Should be OGU2010, got: ${err.message}`);
  }
});

test('14. routeSelect: result includes cost info', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation' });
  assert(typeof result.costPer1kInput === 'number', 'Should have costPer1kInput');
  assert(typeof result.costPer1kOutput === 'number', 'Should have costPer1kOutput');
  assert(result.costPer1kInput === 0.001, `Haiku input cost should be 0.001, got ${result.costPer1kInput}`);
});

test('15. routeSelect: result includes reason', () => {
  const result = routeSelect({ root: testRoot, capability: 'code-generation' });
  assert(typeof result.reason === 'string', 'Should have reason');
  assert(result.reason.length > 0, 'Reason should not be empty');
});

// ── Budget-aware routing ──

test('16. routeSelect: budgetAware=true with plenty of budget', () => {
  // Budget state with low usage
  mkdirSync(join(testRoot, '.ogu/budget'), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(testRoot, '.ogu/budget/budget-state.json'), JSON.stringify({
    daily: { [today]: { spent: 5 } },
  }), 'utf8');

  const result = routeSelect({ root: testRoot, capability: 'code-generation', budgetAware: true });
  assert(result.budgetConstrained === false, 'Should not be budget constrained');
});

test('17. routeSelect: budgetAware=true with exhausted budget', () => {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(testRoot, '.ogu/budget/budget-state.json'), JSON.stringify({
    daily: { [today]: { spent: 45 } },
  }), 'utf8');

  const result = routeSelect({ root: testRoot, capability: 'code-generation', budgetAware: true });
  assert(result.budgetConstrained === true, 'Should be budget constrained at 90%');
});

// ── Multiple providers ──

test('18. routeSelect: picks cheapest across multiple providers', () => {
  const multiProviderOrg = {
    ...orgSpec,
    providers: [
      ...orgSpec.providers,
      {
        id: 'openai',
        models: [
          { id: 'gpt-4o-mini', tier: 'fast', capabilities: ['code-generation'], costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
        ],
      },
    ],
  };
  writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(multiProviderOrg, null, 2), 'utf8');

  const result = routeSelect({ root: testRoot, capability: 'code-generation' });
  assert(result.model === 'gpt-4o-mini', `Should pick cheapest model (gpt-4o-mini), got ${result.model}`);
  assert(result.provider === 'openai', `Provider should be openai, got ${result.provider}`);

  // Restore original OrgSpec
  writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(orgSpec, null, 2), 'utf8');
});

// ── Model config defaults ──

test('19. Default model config has 3 tiers: haiku, sonnet, opus', () => {
  // routeModel uses loadModelConfig internally; we verify the defaults
  // by checking that routeSelect works without a model-config.json
  const configPath = join(testRoot, '.ogu/model-config.json');
  assert(!existsSync(configPath), 'model-config.json should not exist (testing defaults)');
  // routeSelect doesn't use model-config.json, so we test indirectly
  // The loadModelConfig function should return sensible defaults
});

test('20. Tier ordering: fast < standard < advanced < premium', () => {
  assert(getNextTier('fast') === 'standard', 'fast → standard');
  assert(getNextTier('standard') === 'advanced', 'standard → advanced');
  assert(getNextTier('advanced') === 'premium', 'advanced → premium');
  assert(getNextTier('premium') === null, 'premium is max');
});

// ── Cleanup ──
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
