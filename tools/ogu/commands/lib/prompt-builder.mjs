/**
 * Prompt Builder — assembles structured prompts for LLM calls.
 *
 * Two modes:
 * 1. Agent mode: role + taskName + files + contextFiles + entities
 * 2. Simple mode: system + task + context + constraints + examples + maxTokens
 */

export const PROMPT_TEMPLATES = {
  codeReview: {
    system: 'You are an expert code reviewer. Focus on correctness, security, and maintainability.',
    format: 'task+context+constraints',
  },
  codeGeneration: {
    system: 'You are an expert software engineer. Write clean, tested, production-ready code.',
    format: 'task+context+constraints+examples',
  },
  bugFix: {
    system: 'You are a debugging expert. Identify root causes and propose minimal fixes.',
    format: 'task+context+constraints',
  },
};

/**
 * Estimate token count from text (rough: ~4 chars per token).
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Build a prompt for an LLM call.
 *
 * Supports both agent-mode (role/taskName/files) and simple-mode (system/task/context).
 */

export function buildPrompt(params) {
  // Detect mode: simple mode if 'task' key is present (not 'taskName')
  if ('task' in params && !('taskName' in params)) {
    return buildSimplePrompt(params);
  }
  return buildAgentPrompt(params);
}

/**
 * Simple mode: system + task + context + constraints + examples.
 */
function buildSimplePrompt({ system, task, context, constraints, examples, maxTokens } = {}) {
  const parts = [];
  if (task) parts.push(`## Task\n${task}`);
  if (context) parts.push(`## Context\n${context}`);
  if (constraints?.length) parts.push(`## Constraints\n${constraints.map(c => `- ${c}`).join('\n')}`);
  if (examples?.length) parts.push(`## Examples\n${examples.map(e => `- ${e}`).join('\n')}`);

  let content = parts.join('\n\n');
  let truncated = false;

  const totalEstimate = estimateTokens(system || '') + estimateTokens(content);

  if (maxTokens && totalEstimate > maxTokens) {
    const systemTokens = estimateTokens(system || '');
    const budgetForContent = (maxTokens - systemTokens) * 4;
    if (budgetForContent > 0 && content.length > budgetForContent) {
      content = content.slice(0, budgetForContent) + '\n\n[truncated]';
      truncated = true;
    }
  }

  return {
    system: system || '',
    messages: [{ role: 'user', content }],
    estimatedTokens: estimateTokens(system || '') + estimateTokens(content),
    truncated,
  };
}

/**
 * Create a prompt builder (incremental message construction).
 */
export function createPromptBuilder() {
  const messages = [];

  function addSystem(content) { messages.push({ role: 'system', content }); }
  function addUser(content) { messages.push({ role: 'user', content }); }
  function addAssistant(content) { messages.push({ role: 'assistant', content }); }
  function addContext(content) { messages.push({ role: 'user', content: `[Context]\n${content}` }); }

  function build() { return messages.map(m => ({ ...m })); }

  function estimateTokensTotal() {
    let total = 0;
    for (const msg of messages) {
      total += 4;
      total += estimateTokens(msg.content || '');
    }
    return total;
  }

  return { addSystem, addUser, addAssistant, addContext, build, estimateTokens: estimateTokensTotal };
}

/**
 * Agent mode: role + taskName + taskDescription + files + contextFiles + entities.
 */
function buildAgentPrompt(params) {
  const {
    role,
    taskName,
    taskDescription,
    featureSlug,
    files = [],
    contextFiles = [],
    entities = [],
    constraints = [],
    systemPromptOverride = null,
  } = params;

  const systemParts = [
    `You are a ${role} agent working on the "${featureSlug}" feature.`,
    `Your task is: ${taskName}.`,
    '',
    'Rules:',
    '- Write clean, production-quality code.',
    '- Follow existing patterns and conventions in the codebase.',
    '- Do not introduce new dependencies unless explicitly required.',
    '- Ensure all exports match the specification.',
    '- Use icon libraries (lucide-react, heroicons, react-icons) for icons. NEVER use emoji characters as UI icons.',
    '- Create smoke tests at tests/smoke/<slug>.test.ts — test that key pages render, API routes respond, and components mount.',
    '- All contract files in docs/vault/02_Contracts/ must have real, complete content. No template stubs or HTML comments.',
    '- All TypeScript files MUST compile without errors. Add explicit type annotations to function parameters.',
    '- Configure path aliases in tsconfig.json (baseUrl + paths) and vite.config.ts (resolve.alias) if using @/ imports.',
    '',
    'QUALITY GATES your code must pass:',
    '- Gate 4 (no_todos): No TODO/FIXME/HACK comments in code.',
    '- Gate 5 (ui_functional): Every button, link, and form must have working handlers.',
    '- Gate 6 (design_compliance): Follow design tokens. Use icon library components (lucide-react), never emoji as icons. Add hover/focus states.',
    '- Gate 8 (smoke_test): Smoke tests must exist and pass.',
    '- Gate 10 (contracts): Contract files must have real content, no stubs.',
    '- Gate 11 (preview): Project must build (tsc + vite build) and serve without errors.',
  ];

  if (constraints.length > 0) {
    systemParts.push('', 'Constraints:');
    for (const c of constraints) {
      systemParts.push(`- ${c}`);
    }
  }

  const qualityGateRules = systemParts.filter(l => l.startsWith('- Gate ') || l.startsWith('QUALITY GATES'));
  const system = systemPromptOverride
    ? systemPromptOverride + '\n\n' + qualityGateRules.join('\n')
    : systemParts.join('\n');
  const messageParts = [];

  messageParts.push(`## Task: ${taskName}`);
  messageParts.push('');
  messageParts.push(taskDescription);

  const writeFiles = files.filter(f => f.role === 'write');
  if (writeFiles.length > 0) {
    messageParts.push('', '## Files to produce:');
    for (const f of writeFiles) {
      messageParts.push(`- \`${f.path}\``);
    }
  }

  messageParts.push('', '## Output format:',
    'For EACH file you produce, use this EXACT format:',
    '',
    'FILE: path/to/file.ts',
    '```',
    '// file contents here',
    '```',
    '',
    'Start each file with "FILE: <path>" on its own line, followed by a code fence.',
    'Include the COMPLETE file content — no truncation, no placeholders.',
    'You may also create additional files beyond the list above if needed to fix errors.',
  );

  if (contextFiles.length > 0) {
    let currentSection = '## Context:';
    messageParts.push('', currentSection);
    for (const cf of contextFiles) {
      // Emit section header if this file starts a new section
      if (cf._sectionHeader && cf._sectionHeader !== currentSection) {
        currentSection = cf._sectionHeader;
        messageParts.push('', currentSection);
      }
      messageParts.push(`### ${cf.path}`);
      messageParts.push('```');
      messageParts.push(cf.content);
      messageParts.push('```');
    }
  }

  if (entities.length > 0) {
    messageParts.push('', '## Relevant Knowledge:');
    for (const entity of entities) {
      messageParts.push(`### [${entity.type}] ${entity.title}`);
      messageParts.push(entity.content);
    }
  }

  return {
    system,
    messages: [{ role: 'user', content: messageParts.join('\n') }],
  };
}
