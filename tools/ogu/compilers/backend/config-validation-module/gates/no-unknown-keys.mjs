import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * CV007 — no-unknown-keys
 * The unknownKeyPolicy in the spec must be implemented in code.
 * - "reject": code must use z.strict() or passthrough:false or equivalent
 * - "ignore": code must explicitly strip unknown keys
 */

const REJECT_PATTERNS = [
  /\.strict\s*\(\s*\)/,       // zod .strict()
  /additionalProperties\s*:\s*false/,
  /stripUnknown\s*:\s*false/,
  /allowUnknown\s*:\s*false/,
  /cleanEnv\s*\(/,            // envalid rejects unknown by default
  /parseEnv\s*\(/,
];

const IGNORE_PATTERNS = [
  /\.passthrough\s*\(\s*\)/,  // zod .passthrough()
  /stripUnknown\s*:\s*true/,
  /allowUnknown\s*:\s*true/,
  /strip\s*\(\s*\)/,
];

function findConfigFiles(dir) {
  const configDirs = ['src/config', 'config', 'src/env'];
  const files = [];
  for (const rel of configDirs) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    try {
      readdirSync(p, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
          files.push(join(p, e.name));
        }
      });
    } catch { /* skip */ }
  }
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));
  const policy = spec.unknownKeyPolicy;

  const configFiles = findConfigFiles(dir);
  if (configFiles.length === 0) {
    return {
      pass: false, code: 'CV007',
      message: 'Config module files not found — cannot verify unknown-key policy implementation'
    };
  }

  const allContent = configFiles.map(f => readFileSync(f, 'utf8')).join('\n');

  if (policy === 'reject') {
    const implemented = REJECT_PATTERNS.some(p => p.test(allContent));
    if (!implemented) {
      return {
        pass: false, code: 'CV007',
        message: 'unknownKeyPolicy is "reject" but no enforcement found in config module',
        detail: 'Add .strict() to your zod schema, or set allowUnknown:false in your validation library'
      };
    }
  } else if (policy === 'ignore') {
    const implemented = IGNORE_PATTERNS.some(p => p.test(allContent));
    if (!implemented) {
      return {
        pass: false, code: 'CV007',
        message: 'unknownKeyPolicy is "ignore" but no explicit strip/passthrough found in config module',
        detail: 'Add .passthrough() or stripUnknown:true to make the ignore policy explicit in code'
      };
    }
  }

  return {
    pass: true, code: 'CV007',
    message: `Unknown key policy "${policy}" is explicitly implemented in config module`
  };
}
