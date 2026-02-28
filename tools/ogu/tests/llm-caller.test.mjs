/**
 * LLM Caller Tests.
 *
 * 6 tests covering:
 *   Section 1: parseLLMOutput (2 tests)
 *   Section 2: computeTokenCost (4 tests)
 */

import { parseLLMOutput, computeTokenCost } from '../../runner/lib/llm-caller.mjs';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: parseLLMOutput
// ═══════════════════════════════════════════════════════════════════════

// 1. parseLLMOutput extracts text from stream-json
{
  const rawOutput = [
    '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello world"}]}}',
    '{"type":"result","result":{"usage":{"input_tokens":50,"output_tokens":10}}}',
  ].join('\n');

  const parsed = parseLLMOutput(rawOutput);
  assert(parsed.text.includes('Hello world'),
    'parseLLMOutput extracts text from stream-json');
}

// 2. parseLLMOutput extracts usage from result event
{
  const rawOutput = [
    '{"type":"assistant","message":"Some text"}',
    '{"type":"result","result":{"usage":{"input_tokens":100,"output_tokens":50}}}',
  ].join('\n');

  const parsed = parseLLMOutput(rawOutput);
  assert(parsed.usage && parsed.usage.inputTokens === 100 && parsed.usage.outputTokens === 50,
    'parseLLMOutput extracts usage from result event');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: computeTokenCost
// ═══════════════════════════════════════════════════════════════════════

// 3. computeTokenCost calculates correct prices for haiku
{
  const cost = computeTokenCost('haiku', 1000, 1000);
  // haiku: $0.001/1k input, $0.005/1k output
  assert(cost.inputCost === 0.001 && cost.outputCost === 0.005 && cost.totalCost === 0.006,
    'computeTokenCost correct for haiku (1K/1K tokens)');
}

// 4. computeTokenCost calculates correct prices for sonnet
{
  const cost = computeTokenCost('sonnet', 1000, 1000);
  // sonnet: $0.003/1k input, $0.015/1k output
  assert(cost.inputCost === 0.003 && cost.outputCost === 0.015 && cost.totalCost === 0.018,
    'computeTokenCost correct for sonnet (1K/1K tokens)');
}

// 5. computeTokenCost calculates correct prices for opus
{
  const cost = computeTokenCost('opus', 1000, 1000);
  // opus: $0.015/1k input, $0.075/1k output
  assert(cost.inputCost === 0.015 && cost.outputCost === 0.075 && cost.totalCost === 0.09,
    'computeTokenCost correct for opus (1K/1K tokens)');
}

// 6. computeTokenCost falls back to default for unknown model
{
  const cost = computeTokenCost('unknown-model-xyz', 1000, 1000);
  // Default: $0.003/1k input, $0.015/1k output (same as sonnet)
  assert(cost.totalCost > 0 && cost.model === 'unknown-model-xyz',
    'computeTokenCost falls back to default for unknown model');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nLLM Caller Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
