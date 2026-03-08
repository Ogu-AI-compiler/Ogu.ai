import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC005 — intended-use-documented
 * Model cards must explicitly document intended use cases AND out-of-scope uses.
 *
 * Why:
 * - Documenting only what a model CAN do is insufficient. The most important
 *   documentation is what it SHOULD NOT do — the use cases that look plausible
 *   but where the model will fail or cause harm.
 * - Out-of-scope documentation prevents misuse: a model trained for
 *   recommendation is not suitable for medical decisions, even if it produces
 *   numbers that look like probabilities.
 * - Without explicit out-of-scope documentation, users will make their own
 *   judgment about applicability — often incorrectly.
 * - The target audience section tells deployers who the model was designed for,
 *   enabling them to assess whether their context matches the model's design.
 *
 * Escape hatch: none — intended use documentation is non-negotiable for any
 * model that will be used by others or deployed to production.
 */

export async function run({ dir }) {
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const cardPath = candidates.map(c => join(dir, c)).find(p => existsSync(p));

  if (!cardPath) return { pass: false, code: 'MC005', message: 'MODEL_CARD.md not found' };

  const content = readFileSync(cardPath, 'utf8');
  const violations = [];

  // Must document intended use
  const hasIntendedUse = /intended\s+use|primary\s+use|designed\s+for|use\s+cases?/i.test(content);
  if (!hasIntendedUse) {
    violations.push('Intended use not documented');
  }

  // Must document out-of-scope use (anti-patterns for use)
  const hasOutOfScope = /out.of.scope|not\s+intended|should\s+not\s+be\s+used|avoid|do\s+not\s+use|misuse|limitations\s+of\s+use/i.test(content);
  if (!hasOutOfScope) {
    violations.push('Out-of-scope uses not documented — model cards must warn against misuse');
  }

  // Should mention target users/audience
  const hasAudience = /intended\s+(for|audience|users?)|primary\s+(users?|audience)|target\s+(users?|audience|group)/i.test(content);
  if (!hasAudience) {
    violations.push('Target audience/users not identified');
  }

  if (violations.length) {
    return {
      pass: false, code: 'MC005',
      message: `Intended use documentation incomplete`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'MC005', message: 'Intended use, out-of-scope uses, and audience documented' };
}
