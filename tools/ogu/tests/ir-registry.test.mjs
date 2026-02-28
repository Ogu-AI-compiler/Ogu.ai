/**
 * IR Registry Tests — loadIR, scanPreExisting.
 *
 * Run: node tools/ogu/tests/ir-registry.test.mjs
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

const { loadIR, scanPreExisting } = await import('../commands/lib/ir-registry.mjs');

const root = join(tmpdir(), `ogu-ir-test-${randomUUID().slice(0, 8)}`);

function setup() {
  mkdirSync(join(root, '.ogu'), { recursive: true });
}

function cleanup() {
  rmSync(root, { recursive: true, force: true });
}

function makePlan(slug, plan) {
  const dir = join(root, 'docs/vault/04_Features', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'Plan.json'), JSON.stringify(plan, null, 2));
}

setup();

console.log('\nIR Registry Tests\n');

// ── loadIR basic ──

test('1. loadIR returns null for missing feature', () => {
  const result = loadIR(root, 'nonexistent');
  assert(result === null, `expected null, got ${typeof result}`);
});

test('2. loadIR returns registry for valid Plan.json with outputs', () => {
  makePlan('auth', {
    featureSlug: 'auth',
    version: 1,
    tasks: [
      {
        id: 'task-1',
        name: 'Create auth module',
        outputs: ['FILE:src/auth/index.ts', 'API:/auth/login POST'],
        inputs: [],
        dependsOn: [],
      },
    ],
  });
  const registry = loadIR(root, 'auth');
  assert(registry !== null, 'should return registry');
  assert(typeof registry.hasIR === 'function', 'should have hasIR method');
  assert(typeof registry.hasOutput === 'function', 'should have hasOutput method');
});

test('3. loadIR registry.hasIR() returns true when tasks have outputs', () => {
  const registry = loadIR(root, 'auth');
  assert(registry.hasIR() === true, 'should have IR');
});

test('4. loadIR registry.tasks contains plan tasks', () => {
  const registry = loadIR(root, 'auth');
  assert(Array.isArray(registry.tasks), 'tasks should be array');
  assert(registry.tasks.length === 1, `should have 1 task, got ${registry.tasks.length}`);
});

test('5. loadIR registry tracks outputs as array', () => {
  const registry = loadIR(root, 'auth');
  assert(Array.isArray(registry.allOutputs), 'allOutputs should be array');
  assert(registry.allOutputs.length === 2, `should have 2 outputs, got ${registry.allOutputs.length}`);
});

test('6. loadIR hasOutput finds normalized identifier', () => {
  const registry = loadIR(root, 'auth');
  assert(registry.hasOutput('FILE:src/auth/index.ts'), 'should find FILE output');
  assert(registry.hasOutput('API:/auth/login POST'), 'should find API output');
});

test('7. loadIR hasOutput returns false for missing', () => {
  const registry = loadIR(root, 'auth');
  assert(!registry.hasOutput('FILE:nonexistent.ts'), 'should not find missing');
});

test('8. loadIR outputToTask is plain object mapping', () => {
  const registry = loadIR(root, 'auth');
  assert(typeof registry.outputToTask === 'object', 'outputToTask should be object');
  assert(!(registry.outputToTask instanceof Map), 'should be plain object, not Map');
  const keys = Object.keys(registry.outputToTask);
  assert(keys.length === 2, `should have 2 mappings, got ${keys.length}`);
});

test('9. loadIR handles Plan.json without outputs field', () => {
  makePlan('no-outputs', {
    featureSlug: 'no-outputs',
    version: 1,
    tasks: [
      { id: 'task-1', name: 'Do nothing', dependsOn: [] },
    ],
  });
  const registry = loadIR(root, 'no-outputs');
  assert(registry !== null, 'should return registry (task exists, no outputs)');
  assert(registry.hasIR() === false, 'hasIR should be false');
});

test('10. loadIR handles malformed Plan.json', () => {
  const dir = join(root, 'docs/vault/04_Features', 'bad-plan');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'Plan.json'), '{ invalid json }}}');
  const registry = loadIR(root, 'bad-plan');
  assert(registry === null, 'should return null for malformed JSON');
});

test('11. loadIR returns null for empty tasks array', () => {
  makePlan('empty-tasks', { featureSlug: 'empty-tasks', version: 1, tasks: [] });
  const registry = loadIR(root, 'empty-tasks');
  // loadIR returns null when tasks.length === 0
  assert(registry === null, 'should return null for empty tasks');
});

test('12. loadIR handles multiple tasks with deps', () => {
  makePlan('multi', {
    featureSlug: 'multi',
    version: 1,
    tasks: [
      {
        id: 'task-1',
        name: 'Create model',
        outputs: ['SCHEMA:User', 'FILE:src/models/user.ts'],
        inputs: [],
        dependsOn: [],
      },
      {
        id: 'task-2',
        name: 'Create API',
        outputs: ['API:/users GET', 'API:/users POST'],
        inputs: ['SCHEMA:User'],
        dependsOn: ['task-1'],
      },
      {
        id: 'task-3',
        name: 'Create tests',
        outputs: ['TEST:users-api'],
        inputs: ['API:/users GET'],
        dependsOn: ['task-1', 'task-2'],
      },
    ],
  });
  const registry = loadIR(root, 'multi');
  assert(registry !== null, 'should load multi-task plan');
  assert(registry.tasks.length === 3, `should have 3 tasks, got ${registry.tasks.length}`);
  assert(registry.allOutputs.length === 5, `should have 5 outputs, got ${registry.allOutputs.length}`);
  assert(registry.allInputs.length === 2, `should have 2 inputs, got ${registry.allInputs.length}`);
});

test('13. loadIR tracks allSpecSections', () => {
  makePlan('spec-test', {
    featureSlug: 'spec-test',
    version: 1,
    tasks: [
      { id: 't1', name: 'A', outputs: ['FILE:a.ts'], spec_section: 'Auth' },
      { id: 't2', name: 'B', outputs: ['FILE:b.ts'], spec_section: 'Auth' },
      { id: 't3', name: 'C', outputs: ['FILE:c.ts'], spec_section: 'Database' },
    ],
  });
  const registry = loadIR(root, 'spec-test');
  assert(registry.allSpecSections.length === 2, `should have 2 unique spec sections, got ${registry.allSpecSections.length}`);
});

test('14. loadIR tracks allResources', () => {
  makePlan('resource-test', {
    featureSlug: 'resource-test',
    version: 1,
    tasks: [
      { id: 't1', name: 'A', outputs: ['FILE:a.ts'], resources: ['prisma/schema.prisma'] },
    ],
  });
  const registry = loadIR(root, 'resource-test');
  assert(registry.allResources.length === 1, `should have 1 resource, got ${registry.allResources.length}`);
});

// ── scanPreExisting ──

test('15. scanPreExisting returns Set', () => {
  const result = scanPreExisting(root);
  assert(result instanceof Set, 'should return Set');
});

test('16. scanPreExisting finds src files', () => {
  mkdirSync(join(root, 'src/components'), { recursive: true });
  writeFileSync(join(root, 'src/components/Button.tsx'), 'export function Button() {}');
  const result = scanPreExisting(root);
  let hasFile = false;
  for (const id of result) {
    if (id.includes('button') || id.includes('Button')) hasFile = true;
  }
  assert(hasFile, 'should find Button file');
});

test('17. scanPreExisting finds design tokens', () => {
  writeFileSync(join(root, 'design.tokens.json'), JSON.stringify({
    colors: { primary: '#6c5ce7', secondary: '#00d4ff' },
  }));
  const result = scanPreExisting(root);
  let hasToken = false;
  for (const id of result) {
    if (id.startsWith('TOKEN:')) hasToken = true;
  }
  assert(hasToken, 'should find tokens');
});

test('18. scanPreExisting finds contracts', () => {
  mkdirSync(join(root, 'docs/vault/02_Contracts'), { recursive: true });
  writeFileSync(join(root, 'docs/vault/02_Contracts/users.contract.json'), JSON.stringify({
    name: 'users', version: '1.0.0',
  }));
  const result = scanPreExisting(root);
  let hasContract = false;
  for (const id of result) {
    if (id.startsWith('CONTRACT:')) hasContract = true;
  }
  assert(hasContract, 'should find contracts');
});

test('19. scanPreExisting handles empty root', () => {
  const emptyRoot = join(tmpdir(), `ogu-ir-empty-${randomUUID().slice(0, 8)}`);
  mkdirSync(emptyRoot, { recursive: true });
  const result = scanPreExisting(emptyRoot);
  assert(result instanceof Set, 'should return Set for empty root');
  rmSync(emptyRoot, { recursive: true, force: true });
});

test('20. scanPreExisting finds Prisma schemas', () => {
  mkdirSync(join(root, 'prisma'), { recursive: true });
  writeFileSync(join(root, 'prisma/schema.prisma'), `
model User {
  id    Int    @id
  name  String
}

model Post {
  id    Int    @id
  title String
}
  `);
  const result = scanPreExisting(root);
  let userFound = false;
  let postFound = false;
  for (const id of result) {
    if (id.includes('SCHEMA:') && id.toLowerCase().includes('user')) userFound = true;
    if (id.includes('SCHEMA:') && id.toLowerCase().includes('post')) postFound = true;
  }
  assert(userFound, 'should find User schema');
  assert(postFound, 'should find Post schema');
});

test('21. scanPreExisting finds Next.js routes', () => {
  mkdirSync(join(root, 'app/dashboard'), { recursive: true });
  writeFileSync(join(root, 'app/dashboard/page.tsx'), 'export default function Page() {}');
  const result = scanPreExisting(root);
  let hasRoute = false;
  for (const id of result) {
    if (id.startsWith('ROUTE:') && id.includes('dashboard')) hasRoute = true;
  }
  assert(hasRoute, 'should find dashboard route');
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
