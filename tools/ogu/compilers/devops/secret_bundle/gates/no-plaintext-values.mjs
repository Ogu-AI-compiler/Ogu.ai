/**
 * Gate: no-plaintext-values (SB004)
 * Scans YAML files in the directory for Kubernetes Secrets that use the stringData
 * field with literal values. Plaintext Kubernetes Secrets are only base64-encoded,
 * not encrypted — anyone with kubectl get secret can read them. SealedSecrets or
 * ExternalSecrets must be used instead.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function getYamlFiles(dir) {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => join(dir, f));
  } catch { return []; }
}

export async function run({ dir }) {
  const yamlFiles = getYamlFiles(dir);
  if (yamlFiles.length === 0) {
    return { pass: true, code: 'SB004', message: 'No YAML files to scan — skipped', skipped: true };
  }

  const violations = [];

  for (const file of yamlFiles) {
    const content = readFileSync(file, 'utf8');
    if (!content.includes('kind: Secret') || !content.includes('stringData:')) continue;

    const lines        = content.split('\n');
    let inStringData   = false;

    lines.forEach((line, i) => {
      if (line.trim() === 'stringData:') { inStringData = true; return; }
      if (inStringData && /^  \w/.test(line)) {
        const val = line.split(':').slice(1).join(':').trim().replace(/["']/g, '');
        // Skip variable references — they're fine
        if (val.length > 8 && !/^\$[\{(]/.test(val)) {
          violations.push({
            file:    file.replace(dir + '/', ''),
            line:    i + 1,
            content: line.trim().slice(0, 80),
          });
        }
        return;
      }
      if (inStringData && line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) {
        inStringData = false;
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SB004',
      message: `${violations.length} potential plaintext secret(s) found in YAML files`,
      detail: {
        violations,
        hint: 'Replace plaintext Kubernetes Secrets with SealedSecrets (kubeseal) or ExternalSecrets (ESO). Never commit literal credential values.',
      },
    };
  }

  return { pass: true, code: 'SB004', message: `No plaintext secret values in ${yamlFiles.length} YAML file(s)` };
}
