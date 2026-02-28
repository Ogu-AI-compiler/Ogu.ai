import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `kadima-adapter-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/audit'), { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

// Dynamic import — kadima-adapter uses repoRoot() + emitAudit (needs .ogu/audit dir)
// We override OGU_ROOT so emitAudit writes to our tmp dir
const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = TMP;

const {
  PROVIDER_DEFAULTS,
  formatTaskForProvider,
  parseProviderResponse,
  createNotificationPayload,
  dispatch,
  respond,
  BOUNDARY_RULES,
} = await import('../commands/lib/kadima-adapter.mjs');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    setup();
    await fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    teardown();
  }
}

console.log('\n  kadima-adapter.mjs\n');

// ── PROVIDER_DEFAULTS ──

await test('PROVIDER_DEFAULTS has anthropic, openai, local', async () => {
  assert.ok(PROVIDER_DEFAULTS.anthropic);
  assert.ok(PROVIDER_DEFAULTS.openai);
  assert.ok(PROVIDER_DEFAULTS.local);
  assert.equal(PROVIDER_DEFAULTS.anthropic.format, 'anthropic');
  assert.equal(PROVIDER_DEFAULTS.openai.format, 'openai');
});

// ── formatTaskForProvider ──

await test('formatTaskForProvider with anthropic defaults', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-1',
    title: 'Write auth module',
    role: 'backend-dev',
    provider: 'anthropic',
    context: { featureSlug: 'auth' },
  });
  assert.equal(result.taskId, 'task-1');
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.model, PROVIDER_DEFAULTS.anthropic.model);
  assert.equal(result.maxTokens, 4096);
  assert.ok(result.system.includes('backend-dev'));
  assert.ok(result.messages[0].content.includes('Write auth module'));
});

await test('formatTaskForProvider with openai', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-2',
    title: 'Review code',
    role: 'reviewer',
    provider: 'openai',
    context: {},
  });
  assert.equal(result.provider, 'openai');
  assert.equal(result.model, 'gpt-4o');
});

await test('formatTaskForProvider with custom model overrides', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-3',
    title: 'Test',
    role: 'qa',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    maxTokens: 8192,
    context: {},
  });
  assert.equal(result.model, 'claude-opus-4-20250514');
  assert.equal(result.maxTokens, 8192);
});

await test('formatTaskForProvider with unknown provider uses anthropic defaults', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-4',
    title: 'Test',
    role: 'dev',
    provider: 'unknown',
    context: {},
  });
  assert.equal(result.model, PROVIDER_DEFAULTS.anthropic.model);
});

await test('formatTaskForProvider includes feature slug in system prompt', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-5',
    title: 'Build',
    role: 'dev',
    provider: 'anthropic',
    context: { featureSlug: 'payments', spec: 'Build payment system' },
  });
  assert.ok(result.system.includes('payments'));
  assert.ok(result.system.includes('Build payment system'));
});

await test('formatTaskForProvider includes files in user message', async () => {
  const result = formatTaskForProvider({
    taskId: 'task-6',
    title: 'Fix bug',
    role: 'dev',
    provider: 'anthropic',
    context: { files: ['src/auth.ts', 'src/db.ts'] },
  });
  assert.ok(result.messages[0].content.includes('src/auth.ts'));
});

// ── parseProviderResponse ──

await test('parseProviderResponse handles anthropic format', async () => {
  const result = parseProviderResponse({
    provider: 'anthropic',
    raw: {
      content: [{ type: 'text', text: 'Hello world' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn',
    },
  });
  assert.equal(result.text, 'Hello world');
  assert.equal(result.tokens.input, 100);
  assert.equal(result.tokens.output, 50);
  assert.equal(result.finishReason, 'end_turn');
});

await test('parseProviderResponse handles openai format', async () => {
  const result = parseProviderResponse({
    provider: 'openai',
    raw: {
      choices: [{ message: { content: 'GPT response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 200, completion_tokens: 80 },
    },
  });
  assert.equal(result.text, 'GPT response');
  assert.equal(result.tokens.input, 200);
  assert.equal(result.tokens.output, 80);
  assert.equal(result.finishReason, 'stop');
});

await test('parseProviderResponse handles unknown provider', async () => {
  const result = parseProviderResponse({
    provider: 'custom',
    raw: 'raw string response',
  });
  assert.equal(result.text, 'raw string response');
  assert.equal(result.tokens.input, 0);
  assert.equal(result.finishReason, 'unknown');
});

await test('parseProviderResponse handles null/missing fields gracefully', async () => {
  const result = parseProviderResponse({ provider: 'anthropic', raw: {} });
  assert.equal(result.text, '');
  assert.equal(result.tokens.input, 0);
  assert.equal(result.finishReason, 'unknown');
});

// ── createNotificationPayload ──

await test('createNotificationPayload creates proper structure', async () => {
  const result = createNotificationPayload({
    event: 'task.completed',
    taskId: 'task-1',
    featureSlug: 'auth',
    result: { files: 3 },
  });
  assert.equal(result.event, 'task.completed');
  assert.equal(result.taskId, 'task-1');
  assert.equal(result.featureSlug, 'auth');
  assert.ok(result.timestamp);
  assert.deepEqual(result.payload, { files: 3 });
});

// ── dispatch ──

await test('dispatch rejects null envelope', async () => {
  const result = await dispatch(TMP, null);
  assert.equal(result.accepted, false);
  assert.equal(result.error.code, 'OGU4001');
});

await test('dispatch rejects envelope without taskId', async () => {
  const result = await dispatch(TMP, { featureSlug: 'auth' });
  assert.equal(result.accepted, false);
  assert.equal(result.error.code, 'OGU4001');
  assert.ok(result.error.message.includes('taskId'));
});

await test('dispatch rejects envelope without featureSlug or type', async () => {
  const result = await dispatch(TMP, { taskId: 'task-1' });
  assert.equal(result.accepted, false);
  assert.equal(result.error.code, 'OGU4001');
});

await test('dispatch accepts valid envelope', async () => {
  const result = await dispatch(TMP, { taskId: 'task-1', featureSlug: 'auth' });
  assert.equal(result.accepted, true);
  assert.ok(result.dispatchedAt);
  assert.equal(result.envelope.taskId, 'task-1');
});

await test('dispatch accepts envelope with type instead of featureSlug', async () => {
  const result = await dispatch(TMP, { taskId: 'task-1', type: 'health_check' });
  assert.equal(result.accepted, true);
});

await test('dispatch writes audit event', async () => {
  await dispatch(TMP, { taskId: 'task-audit', featureSlug: 'test' });
  const auditFile = join(TMP, '.ogu/audit/current.jsonl');
  assert.ok(existsSync(auditFile));
  const content = readFileSync(auditFile, 'utf8');
  assert.ok(content.includes('kadima.dispatch'));
});

// ── respond ──

await test('respond rejects null output envelope', async () => {
  const result = await respond(TMP, null);
  assert.equal(result.accepted, false);
  assert.equal(result.error.code, 'OGU4006');
});

await test('respond rejects envelope without taskId or type', async () => {
  const result = await respond(TMP, { status: 'ok' });
  assert.equal(result.accepted, false);
});

await test('respond accepts valid output envelope', async () => {
  const result = await respond(TMP, { taskId: 'task-1', status: 'completed' });
  assert.equal(result.accepted, true);
  assert.equal(result.envelope.taskId, 'task-1');
});

await test('respond accepts output envelope with type', async () => {
  const result = await respond(TMP, { type: 'health_response' });
  assert.equal(result.accepted, true);
});

// ── BOUNDARY_RULES ──

await test('BOUNDARY_RULES defines kadima→ogu and ogu→kadima rules', async () => {
  assert.equal(BOUNDARY_RULES.length, 2);
  assert.equal(BOUNDARY_RULES[0].check, 'kadima_imports_ogu');
  assert.equal(BOUNDARY_RULES[1].check, 'ogu_imports_kadima');
  assert.ok(BOUNDARY_RULES[0].allowed.includes('kadima-adapter.mjs'));
  assert.deepEqual(BOUNDARY_RULES[1].allowed, []);
});

// Cleanup
if (origRoot === undefined) delete process.env.OGU_ROOT;
else process.env.OGU_ROOT = origRoot;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
