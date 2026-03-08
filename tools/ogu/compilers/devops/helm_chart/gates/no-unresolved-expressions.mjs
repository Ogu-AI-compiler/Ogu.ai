/**
 * Gate: no-unresolved-expressions (HC005)
 * Scans all template files for broken or forgotten Go-template expressions.
 * Valid Helm expressions like {{ .Values.foo }}, {{ include "..." . }}, and
 * {{ if .Values.enabled }} are intentionally excluded. Only clearly broken
 * forms are flagged: empty {{ }}, placeholder TODOs, and bare ALL-CAPS identifiers
 * that look like unsubstituted environment variables.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Valid Helm Go-template expressions like {{ .Values.foo }}, {{ include "..." . }},
// {{ if .Values.enabled }}, etc. are intentional and must NOT be flagged.
//
// We flag only expressions that are clearly broken or forgotten:
//   {{ }}            — empty expression
//   {{ TODO }}       — placeholder not replaced
//   {{ PLACEHOLDER }} {{ YOUR_VALUE }} {{ REPLACE_ME }}
//   {{ SOME_CAPS_VAR }} — bare ALL_CAPS word with no dot/pipe, looks like a forgotten substitution
const EMPTY_EXPR       = /\{\{-?\s*-?\}\}/g;
const PLACEHOLDER_EXPR = /\{\{-?\s*(TODO|FIXME|PLACEHOLDER|YOUR_[A-Z_]+|REPLACE_ME)\s*-?\}\}/gi;
// A bare ALL-CAPS identifier (3+ chars, no dot/pipe/function before it) is suspicious
const BARE_CAPS_EXPR   = /\{\{-?\s+([A-Z][A-Z0-9_]{2,})\s+-?\}\}/g;

export async function run({ dir }) {
  const templatesDir = join(dir, 'templates');
  if (!existsSync(templatesDir)) {
    return { pass: true, code: 'HC005', message: 'No templates/ directory — skipped', skipped: true };
  }

  const files = readdirSync(templatesDir).filter(f => f.endsWith('.yaml') || f.endsWith('.tpl'));
  if (files.length === 0) {
    return { pass: true, code: 'HC005', message: 'No template files — skipped', skipped: true };
  }

  const violations = [];

  for (const f of files) {
    const raw = readFileSync(join(templatesDir, f), 'utf8');
    // Strip block comments before analysis so {{/* ... */}} is not examined
    const content = raw.replace(/\{\{\/\*[\s\S]*?\*\/\}\}/g, '');

    const empties = [...content.matchAll(EMPTY_EXPR)];
    if (empties.length) {
      violations.push({ file: f, kind: 'empty-expression', count: empties.length, reason: 'Empty {{ }} expressions will cause helm template to fail' });
    }

    const placeholders = [...content.matchAll(PLACEHOLDER_EXPR)];
    if (placeholders.length) {
      const labels = [...new Set(placeholders.map(m => m[1].toUpperCase()))];
      violations.push({ file: f, kind: 'placeholder', identifiers: labels, reason: 'Unreplaced placeholder(s) — replace with real values before deploying' });
    }

    const bareCaps = [...content.matchAll(BARE_CAPS_EXPR)];
    if (bareCaps.length) {
      const labels = [...new Set(bareCaps.map(m => m[1]))];
      violations.push({ file: f, kind: 'bare-caps-identifier', identifiers: labels, reason: 'Bare ALL-CAPS identifiers look like unsubstituted env vars' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'HC005',
      message: `${violations.length} broken/unresolved expression(s) across template files`,
      detail: { violations, hint: 'Replace placeholders with .Values references or real values, and remove empty {{ }} blocks' },
    };
  }

  return { pass: true, code: 'HC005', message: `No broken expressions found in ${files.length} template file(s)` };
}
