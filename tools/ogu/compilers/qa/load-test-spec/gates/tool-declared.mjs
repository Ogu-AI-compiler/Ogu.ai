import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA041 — tool-declared
 * The load testing tool must be explicitly declared.
 *
 * Valid tools: k6, artillery, locust, gatling, jmeter, autocannon, wrk
 *
 * Without a declared tool, the spec is ambiguous — different tools have
 * wildly different VU models, scripting APIs, and metric semantics.
 * A spec with "vus: 100" in k6 means something fundamentally different
 * than 100 users in JMeter (thread groups vs coroutines).
 */

const VALID_TOOLS = new Set(['k6', 'artillery', 'locust', 'gatling', 'jmeter', 'autocannon', 'wrk', 'vegeta']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA041', message: 'load-test-spec.json not readable' }; }

  const tool = spec.tool;

  if (!tool) {
    return {
      pass: false, code: 'QA041',
      message: 'spec.tool is not declared — load testing tool must be explicit',
      detail: `Valid tools: ${[...VALID_TOOLS].join(', ')}. VU semantics, metric units, and scripting APIs differ significantly between tools.`,
    };
  }

  if (!VALID_TOOLS.has(tool.toLowerCase())) {
    return {
      pass: false, code: 'QA041',
      message: `spec.tool "${tool}" not recognised`,
      detail: `Known tools: ${[...VALID_TOOLS].join(', ')}. If using a different tool, add it to the allowed list via ADR.`,
    };
  }

  return { pass: true, code: 'QA041', message: `tool: "${tool}" — declared and recognised` };
}
