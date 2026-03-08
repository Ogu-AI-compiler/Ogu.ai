import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM008 — llm-surfaces-addressed: if the feature uses AI/LLM, prompt injection and data exfiltration must be in the threat model */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM008', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM008', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Only applies if the feature declares LLM usage
  const hasLLM = spec.uses_llm === true || spec.uses_ai === true ||
    (typeof spec.feature === 'string' && /\b(llm|ai|gpt|claude|gemini|openai|langchain|rag|vector|embedding)\b/i.test(spec.feature));

  if (!hasLLM) {
    return { pass: true, code: 'TM008', message: 'Feature does not use LLM/AI — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return {
      pass: false,
      code: 'TM008',
      message: 'Feature uses LLM/AI but no threats are declared — prompt injection and data exfiltration must be addressed',
    };
  }

  const PROMPT_INJECTION_TERMS = ['prompt injection', 'prompt_injection', 'jailbreak', 'indirect injection'];
  const DATA_EXFIL_TERMS = ['data exfiltration', 'data_exfiltration', 'context leakage', 'cross-tenant', 'memory exfil'];

  const allThreatText = spec.threats.map(t =>
    [t.title, t.description, t.notes].filter(Boolean).join(' ').toLowerCase()
  ).join(' ');

  const violations = [];

  const hasPromptInjection = PROMPT_INJECTION_TERMS.some(term => allThreatText.includes(term));
  if (!hasPromptInjection) {
    violations.push('LLM feature is missing a prompt injection threat — add a threat with title or description containing "prompt injection"');
  }

  const hasDataExfil = DATA_EXFIL_TERMS.some(term => allThreatText.includes(term));
  if (!hasDataExfil) {
    violations.push('LLM feature is missing a data exfiltration / context leakage threat — add a threat addressing cross-user or cross-tenant data leakage through the LLM context');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM008',
      message: `LLM feature is missing ${violations.length} required AI-specific threat(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM008', message: 'LLM-specific threats (prompt injection, data exfiltration) are addressed' };
}
