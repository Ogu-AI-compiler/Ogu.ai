import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { execSync } from 'node:child_process';
import { getRunnersDir } from './runtime-paths.mjs';

// -- Helpers --

function readSafe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function parseSafeJson(path) {
  const content = readSafe(path);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function uniq(list) {
  return [...new Set((list || []).map(s => String(s)).filter(Boolean))];
}

// -- Group normalization --

const CANONICAL_GROUPS = new Set(['setup', 'core', 'ui', 'integration', 'polish']);

const GROUP_ALIASES = {
  config: 'setup', configuration: 'setup', init: 'setup', infrastructure: 'setup',
  devops: 'setup', deploy: 'setup', install: 'setup', bootstrap: 'setup',
  environment: 'setup', 'env-setup': 'setup', ci: 'setup', cd: 'setup',
  frontend: 'ui', design: 'ui', component: 'ui', view: 'ui',
  page: 'ui', screen: 'ui', layout: 'ui', style: 'ui', styling: 'ui',
  api: 'integration', route: 'integration', endpoint: 'integration',
  service: 'integration', connector: 'integration', adapter: 'integration',
  contract: 'integration', handler: 'integration', middleware: 'integration',
  webhook: 'integration', external: 'integration',
  test: 'polish', testing: 'polish', quality: 'polish', qa: 'polish',
  lint: 'polish', review: 'polish', refactor: 'polish', cleanup: 'polish',
  documentation: 'polish', docs: 'polish', 'smoke-test': 'polish',
  data: 'core', model: 'core', logic: 'core', backend: 'core',
  business: 'core', domain: 'core', feature: 'core', auth: 'core',
  security: 'core', store: 'core', state: 'core', db: 'core',
  database: 'core', schema: 'core', migration: 'core',
};

function inferGroupFromTouches(touches) {
  if (touches.some(t => t.includes('.test.') || t.includes('.spec.'))) return 'polish';
  if (touches.some(t => /\.(tsx|jsx)$/.test(t) && !t.includes('.test.'))) return 'ui';
  if (touches.some(t => t.includes('route') || t.includes('api/') || t.includes('handler') || t.endsWith('.contract.json'))) return 'integration';
  if (touches.some(t => t.endsWith('package.json') || t.endsWith('.env') || t.includes('config.'))) return 'setup';
  return null;
}

function inferGroupFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (/\b(test|spec|qa|quality|lint|coverage)\b/.test(t)) return 'polish';
  if (/\b(component|page|screen|layout|ui|frontend|style|design|form|modal|button)\b/.test(t)) return 'ui';
  if (/\b(api|route|endpoint|handler|service|integration|contract|webhook)\b/.test(t)) return 'integration';
  if (/\b(setup|init|config|install|deploy|infrastructure|ci|cd|env)\b/.test(t)) return 'setup';
  return null;
}

export function resolveTaskGroup(task) {
  const raw = (task?.group || '').toLowerCase().trim();
  const touches = task?.touches || [];
  if (!raw) {
    return inferGroupFromTitle(task?.title || task?.name || '') || inferGroupFromTouches(touches) || 'core';
  }
  if (CANONICAL_GROUPS.has(raw)) return raw;
  if (GROUP_ALIASES[raw]) return GROUP_ALIASES[raw];
  for (const [alias, canonical] of Object.entries(GROUP_ALIASES)) {
    if (raw.includes(alias)) return canonical;
  }
  return inferGroupFromTitle(task?.title || task?.name || '') || inferGroupFromTouches(touches) || 'core';
}

// -- Preflight validation --

export function preflightTaskSpec(root, task) {
  const errors = [];
  const warnings = [];
  const base = task || {};
  let touches = uniq(base.touches);

  if (touches.length === 0 && Array.isArray(base.output?.files)) {
    touches = uniq(base.output.files.map(f => f?.path).filter(Boolean));
  }

  const invalid = touches.filter(t => isAbsolute(t) || t.includes('..') || t.includes('\0'));
  if (invalid.length > 0) {
    errors.push(`Invalid touch paths: ${invalid.join(', ')}`);
  }

  if (Array.isArray(base.dependsOn) && base.dependsOn.length > 0) {
    for (const dep of base.dependsOn) {
      const depOutput = join(getRunnersDir(root), `${dep}.output.json`);
      if (!existsSync(depOutput)) {
        errors.push(`Missing dependency output: ${dep}`);
      }
    }
  }
  if (Array.isArray(base.depends_on) && base.depends_on.length > 0) {
    for (const dep of base.depends_on) {
      const depOutput = join(getRunnersDir(root), `${dep}.output.json`);
      if (!existsSync(depOutput)) {
        errors.push(`Missing dependency output: ${dep}`);
      }
    }
  }

  if (touches.length === 0 && (base.output?.files?.length || 0) > 0) {
    warnings.push('Task has output files but no touches defined');
  }

  return { ok: errors.length === 0, errors, warnings, touches, group: resolveTaskGroup({ ...base, touches }) };
}

// -- Gate definitions --

function gateFilesExist(root, touches) {
  return touches.filter(t => !existsSync(join(root, t))).map(t => `Missing file: ${t}`);
}

function gateNoTodos(root, touches) {
  const warnings = [];
  for (const touch of touches) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    const m = content.match(/\b(TODO|FIXME|HACK)\b/);
    if (m) warnings.push(`${touch}: contains ${m[0]}`);
  }
  return warnings;
}

function gateNonEmpty(root, touches) {
  const errors = [];
  for (const touch of touches) {
    const content = readSafe(join(root, touch));
    if (content !== null && content.trim().length < 10) {
      errors.push(`${touch}: file is empty or placeholder`);
    }
  }
  return errors;
}

function gateJsonValid(root, touches) {
  const errors = [];
  for (const touch of touches.filter(t => t.endsWith('.json'))) {
    const fullPath = join(root, touch);
    if (!existsSync(fullPath)) continue;
    const data = parseSafeJson(fullPath);
    if (data === null) {
      errors.push(`${touch}: invalid JSON`);
    } else if (Array.isArray(data) ? data.length === 0 : Object.keys(data).length === 0) {
      errors.push(`${touch}: JSON file is empty object/array`);
    }
  }
  return errors;
}

function gateImports(root, touches) {
  const errors = [];
  const codeFiles = touches.filter(t => /\.(ts|tsx|js|jsx|mjs)$/.test(t) && !t.includes('.test.') && !t.includes('.spec.'));
  if (codeFiles.length === 0) return errors;

  const pkg = parseSafeJson(join(root, 'package.json')) || {};
  const allDeps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]);
  if (allDeps.size === 0) return errors;

  for (const touch of codeFiles) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    const importMatches = [
      ...content.matchAll(/(?:import\s+(?:.*?\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g),
      ...content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]/g),
    ];
    for (const m of importMatches) {
      const specifier = m[1];
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) continue;
      const pkgName = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0];
      if (!allDeps.has(pkgName)) {
        errors.push(`${touch}: imports '${pkgName}' which is not in package.json`);
      }
    }
  }
  return uniq(errors);
}

function gateSetup(root, touches) {
  const errors = [];
  if (touches.some(t => t === 'package.json' || t.endsWith('/package.json'))) {
    const pkg = parseSafeJson(join(root, 'package.json'));
    if (!pkg) {
      errors.push('package.json missing or invalid');
    } else {
      if (!pkg.name) errors.push("package.json: missing 'name' field");
      if (!pkg.scripts) errors.push("package.json: missing 'scripts' field");
    }
  }
  for (const touch of touches.filter(t => t.includes('.env'))) {
    const content = readSafe(join(root, touch));
    if (content && !content.match(/^\w+=.+/m)) {
      errors.push(`${touch}: .env file has no KEY=VALUE entries`);
    }
  }
  return errors;
}

function gateCore(root, touches) {
  const errors = [];
  const tsFiles = touches.filter(t => /\.(ts|tsx|js|jsx|mjs)$/.test(t) && !t.includes('.test.') && !t.includes('.spec.'));
  for (const touch of tsFiles) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    const hasExport = /\bexport\b/.test(content) || /\bmodule\.exports\b/.test(content) || /\bexports\.\w+/.test(content);
    if (!hasExport) {
      errors.push(`${touch}: no exports found`);
    }
    if (/throw new Error\(['"]not implemented['"]\)/i.test(content)) {
      errors.push(`${touch}: contains unimplemented stub`);
    }
  }
  return errors;
}

function gateUI(root, touches) {
  const errors = [];
  const componentFiles = touches.filter(t => /\.(tsx|jsx)$/.test(t) && !t.includes('.test.') && !t.includes('.spec.'));
  for (const touch of componentFiles) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    const hasComponentExport = /export\s+(default\s+)?(?:function|const)\s+[A-Z]\w+/.test(content);
    if (!hasComponentExport) {
      errors.push(`${touch}: no exported React component (PascalCase) found`);
    }
  }
  return errors;
}

function gateIntegration(root, touches) {
  const errors = [];
  const routeFiles = touches.filter(t => /\.(ts|js|mjs)$/.test(t) && (t.includes('route') || t.includes('api') || t.includes('handler')));
  for (const touch of routeFiles) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    if (!/\bexport\b/.test(content)) {
      errors.push(`${touch}: API route has no exports`);
    }
  }
  for (const touch of touches.filter(t => t.endsWith('.contract.json'))) {
    const data = parseSafeJson(join(root, touch));
    if (!data) {
      errors.push(`${touch}: contract file missing or invalid JSON`);
    } else if (Object.keys(data).length < 2) {
      errors.push(`${touch}: contract file incomplete (< 2 fields)`);
    }
  }
  return errors;
}

function gatePolish(root, touches) {
  const errors = [];
  const codeFiles = touches.filter(t => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(t));
  if (codeFiles.length === 0) return errors;

  const testFiles = touches.filter(t => t.includes('.test.') || t.includes('.spec.'));
  if (testFiles.length === 0) {
    errors.push('No test file found in touches - polish tasks with code files must include tests');
  }
  for (const touch of testFiles) {
    const content = readSafe(join(root, touch));
    if (!content) continue;
    const hasTestBlock = /\b(describe|it|test)\s*\(/.test(content);
    if (!hasTestBlock) {
      errors.push(`${touch}: no test blocks (describe/it/test) found`);
    }

    const needsJsdom = /\brender\s*\(|@testing-library|document\.|window\.|screen\.|fireEvent|userEvent/.test(content);
    if (needsJsdom) {
      const hasJsdomAnnotation = content.includes('@vitest-environment jsdom');
      if (!hasJsdomAnnotation) {
        const vitestConfig = ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js']
          .map(f => readSafe(join(root, f)))
          .find(Boolean) || '';
        const hasGlobalJsdom = /environment\s*:\s*['"]jsdom['"]/.test(vitestConfig);
        if (!hasGlobalJsdom) {
          errors.push(
            `${touch}: test uses DOM APIs (render/document/window) but vitest is not configured for jsdom. ` +
            `Either add "// @vitest-environment jsdom" at the top of the test file, or set environment: 'jsdom' in vitest.config.ts`
          );
        }
      }
    }
  }
  return errors;
}

function gateDod(task) {
  if (!task?.done_when) return [];
  const dod = task.done_when.toLowerCase();
  const touches = task.touches || [];
  const errors = [];

  const requiresTestFiles = /\ball tests? (pass|run|succeed|complete)\b/.test(dod)
    || /\btest suite\b/.test(dod)
    || /\btest coverage\b/.test(dod);
  if (requiresTestFiles && !touches.some(t => t.includes('.test.') || t.includes('.spec.'))) {
    errors.push('done_when requires tests but no test file in touches');
  }
  return errors;
}

// -- Execution gates --

function runNpmInstall(root) {
  try {
    const pm = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
      : existsSync(join(root, 'yarn.lock')) ? 'yarn'
      : 'npm';
    execSync(`${pm} install`, { cwd: root, stdio: 'pipe', timeout: 120_000 });
    return null;
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    return `npm install failed:\n${out.slice(-600)}`;
  }
}

function runVitest(root, testFiles) {
  try {
    const bin = existsSync(join(root, 'node_modules/.bin/vitest'))
      ? join(root, 'node_modules/.bin/vitest')
      : 'npx vitest';
    const files = testFiles.map(f => JSON.stringify(f)).join(' ');
    execSync(`${bin} run ${files} --reporter=verbose`, {
      cwd: root, stdio: 'pipe', timeout: 60_000, env: { ...process.env, CI: 'true' },
    });
    return null;
  } catch (e) {
    const out = ((e.stdout?.toString() || '') + '\n' + (e.stderr?.toString() || '')).trim();
    return out.slice(-2000) || 'Vitest failed with no output';
  }
}

// -- Main gate runner --

export async function runTaskGates(root, task, { runTests = true } = {}) {
  const errors = [];
  const warnings = [];
  const touches = uniq(task?.touches || []);
  const group = resolveTaskGroup({ ...task, touches });

  if (touches.length === 0) {
    return { passed: true, errors, warnings, group, touches };
  }

  errors.push(...gateFilesExist(root, touches));
  if (errors.length > 0) return { passed: false, errors, warnings, group, touches };

  warnings.push(...gateNoTodos(root, touches));
  errors.push(...gateNonEmpty(root, touches));
  errors.push(...gateJsonValid(root, touches));
  errors.push(...gateDod({ ...task, touches }));

  if (group === 'setup' && touches.some(t => t === 'package.json' || t.endsWith('/package.json'))) {
    errors.push(...gateSetup(root, touches));
    if (errors.length === 0) {
      const installErr = runNpmInstall(root);
      if (installErr) errors.push(installErr);
    }
    return { passed: errors.length === 0, errors, warnings, group, touches };
  }

  errors.push(...gateImports(root, touches));
  if (errors.length > 0) return { passed: false, errors, warnings, group, touches };

  switch (group) {
    case 'setup': errors.push(...gateSetup(root, touches)); break;
    case 'core': errors.push(...gateCore(root, touches)); break;
    case 'ui': errors.push(...gateUI(root, touches)); break;
    case 'integration': errors.push(...gateIntegration(root, touches)); break;
    case 'polish': errors.push(...gatePolish(root, touches)); break;
  }
  if (errors.length > 0) return { passed: false, errors, warnings, group, touches };

  if (runTests && group === 'polish') {
    const testFiles = touches.filter(t => t.includes('.test.') || t.includes('.spec.'));
    if (testFiles.length > 0) {
      if (!existsSync(join(root, 'node_modules'))) {
        const installErr = runNpmInstall(root);
        if (installErr) { errors.push(installErr); return { passed: false, errors, warnings, group, touches }; }
      }
      const vitestErr = runVitest(root, testFiles);
      if (vitestErr) errors.push(`Test execution failed:\n${vitestErr}`);
    }
  }

  return { passed: errors.length === 0, errors, warnings, group, touches };
}

function formatGateErrors(errors) {
  if (!errors || errors.length === 0) return '';
  return `Local gate failures:\n${errors.join('\n')}`;
}

export function buildTaskFixNote(task, gateResult, root) {
  const touches = task?.touches || [];
  const taskTitle = task?.title || task?.name || task?.id || 'task';
  const rawErr = gateResult?.rawError || formatGateErrors(gateResult?.errors || []);

  if (!rawErr.startsWith('Local gate failures:')) {
    return [
      `Your previous attempt to implement "${taskTitle}" failed.`,
      '',
      'Error output:',
      String(rawErr).slice(0, 3000),
      '',
      'Please analyze the error carefully and fix the root cause. Do not repeat the same approach.',
      touches.length > 0
        ? `\nYou MUST create ALL of these files at EXACTLY these paths:\n${touches.map(t => `- ${t}`).join('\n')}`
        : '',
    ].join('\n');
  }

  if (rawErr.includes('Test execution failed:')) {
    const testOutput = rawErr.replace('Local gate failures:\n', '').replace(/^Test execution failed:\n/m, '');
    return [
      `Your test file(s) for task "${taskTitle}" are failing. Here is the exact test output:`,
      '',
      testOutput.slice(0, 3000),
      '',
      'Fix the failing tests or the code they test. Common fixes:',
      "- 'Failed to resolve import X' -> add X to package.json dependencies",
      "- 'document is not defined' -> add '// @vitest-environment jsdom' as first line of test file",
      "- 'Cannot find module X' -> the module file is missing or has wrong path",
      "- Test assertion failures -> fix the implementation to match what the test expects",
      touches.length > 0
        ? `\nRequired files:\n${touches.map(t => `- ${t}`).join('\n')}`
        : '',
    ].join('\n');
  }

  const gateErrors = rawErr.replace('Local gate failures:\n', '').split('\n').filter(Boolean);
  const lines = [
    `TASK "${taskTitle}" FAILED LOCAL GATE VALIDATION.`,
    '',
    'The following checks failed. You MUST fix each one:',
  ];

  for (const err of gateErrors) {
    lines.push('');
    lines.push(`ERROR: ${err}`);

    const missingMatch = err.match(/^Missing file: (.+)$/);
    if (missingMatch) {
      const missingPath = missingMatch[1];
      const dir = dirname(missingPath);
      const fullDir = join(root, dir);
      if (existsSync(fullDir)) {
        try {
          const existing = readdirSync(fullDir);
          if (existing.length > 0) {
            lines.push(`   -> Directory "${dir}/" exists and contains: ${existing.join(', ')}`);
            lines.push('   -> You likely created the file with the wrong name. Rename or re-create it.');
          } else {
            lines.push(`   -> Directory "${dir}/" exists but is EMPTY.`);
          }
        } catch { /* ignore */ }
      } else {
        lines.push(`   -> Directory "${dir}/" does not exist - you must create it.`);
      }
      lines.push(`   -> FIX: Create the file at EXACTLY this path: ${missingPath}`);
    }

    if (err.includes('no export') || err.includes('must export')) {
      lines.push('   -> FIX: Add "export" to at least one function, class, or const in this file.');
      lines.push('   -> Example: export default function MyComponent() { ... } or export const foo = ...');
    }

    if (err.includes('No test file found')) {
      const testSuggestion = touches.find(t => /\.(ts|tsx|js|jsx)$/.test(t) && !t.includes('.test.') && !t.includes('.spec.'));
      const testName = testSuggestion
        ? testSuggestion.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1').replace(/src\//, 'src/__tests__/')
        : `src/__tests__/${task?.id || 'task'}.test.ts`;
      lines.push(`   -> FIX: Add a test file to your touches list. Suggested path: ${testName}`);
      lines.push('   -> The test file must use describe/it/test blocks with real assertions.');
    }

    if (err.includes('empty') || err.includes('only comments')) {
      lines.push('   -> FIX: The file has no real content. Add actual implementation code.');
    }

    if (err.includes('TODO') || err.includes('FIXME') || err.includes('HACK')) {
      lines.push('   -> FIX: Remove all TODO/FIXME/HACK comments and replace with real implementation.');
    }

    if (err.includes('invalid JSON') || err.includes('valid JSON')) {
      lines.push('   -> FIX: Ensure the file contains valid JSON with at least one key.');
    }

    const missingPkgMatch = err.match(/imports '([^']+)' which is not in package\.json/);
    if (missingPkgMatch) {
      lines.push(`   -> FIX: Add '${missingPkgMatch[1]}' to package.json dependencies, then re-implement using it.`);
      lines.push(`   -> In package.json, add: "${missingPkgMatch[1]}": "latest" under "dependencies".`);
    }

    if (err.includes('jsdom')) {
      lines.push('   -> FIX: Add "// @vitest-environment jsdom" as the FIRST LINE of the test file.');
      lines.push('   -> This is required for any test that uses render(), document, window, screen, or fireEvent.');
    }
  }

  lines.push('');
  lines.push('REQUIRED FILES - create ALL of these at EXACTLY these paths (no renames, no alternatives):');
  for (const t of touches) lines.push(`- ${t}`);
  lines.push('');
  lines.push('CRITICAL: The gate checks for EXACT file paths. Any file created at a different path will not count.');

  return lines.join('\n');
}

export function formatGateErrorsForFix(errors) {
  return formatGateErrors(errors);
}
