import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));
  const specKeys = spec.envKeys.map(k => k.name);

  // Find the main config output file (index.ts or config/index.ts or env.ts)
  const candidates = ['src/config/index.ts', 'src/config/env.ts', 'config/index.ts', 'config.ts', 'env.ts'];
  let configFile = null;
  let configContent = '';

  for (const candidate of candidates) {
    const p = join(dir, candidate);
    if (existsSync(p)) {
      configFile = p;
      configContent = readFileSync(p, 'utf8');
      break;
    }
  }

  // Also check for any .ts files that export config
  if (!configFile) {
    const tsFiles = readdirSync(dir, { recursive: true })
      .filter(f => typeof f === 'string' && f.endsWith('.ts') && !f.includes('test') && !f.includes('spec'));
    for (const f of tsFiles) {
      const p = join(dir, f);
      const content = readFileSync(p, 'utf8');
      if (content.includes('export') && content.includes('config')) {
        configFile = p;
        configContent = content;
        break;
      }
    }
  }

  if (!configFile) {
    return {
      pass: false, code: 'CV002',
      message: 'No config output file found',
      detail: 'Expected one of: src/config/index.ts, src/config/env.ts, config/index.ts'
    };
  }

  // Check that every spec key appears in the config file (exported or referenced)
  const missing = specKeys.filter(key => !configContent.includes(key));
  if (missing.length) {
    return {
      pass: false, code: 'CV002',
      message: `Exported config missing spec keys: ${missing.join(', ')}`,
      detail: `Every key declared in config-spec.json must appear in the config module output`
    };
  }

  return {
    pass: true, code: 'CV002',
    message: `All ${specKeys.length} spec keys present in config module`
  };
}
