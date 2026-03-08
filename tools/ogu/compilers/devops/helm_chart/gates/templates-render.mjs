/**
 * Gate: templates-render (HC004)
 * Validates that the templates/ directory exists and contains at least one
 * template file. A chart with no templates deploys no resources, which is
 * almost always a configuration error rather than intentional.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const templatesDir = join(dir, 'templates');

  if (!existsSync(templatesDir)) {
    return {
      pass: false, code: 'HC004',
      message: 'templates/ directory not found',
      detail: { searched: templatesDir, hint: 'Create a templates/ directory with at least one .yaml or .tpl file' },
    };
  }

  const templates = readdirSync(templatesDir).filter(f => f.endsWith('.yaml') || f.endsWith('.tpl'));

  if (templates.length === 0) {
    return {
      pass: false, code: 'HC004',
      message: 'No template files found in templates/',
      detail: { hint: 'Add at least one .yaml or .tpl file to templates/ — a chart with no templates deploys nothing' },
    };
  }

  return { pass: true, code: 'HC004', message: `${templates.length} template file(s) found in templates/` };
}
