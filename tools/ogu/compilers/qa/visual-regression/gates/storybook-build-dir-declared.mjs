import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA064 — storybook-build-dir-declared
 * If stories are declared as capture targets, a Storybook build directory must be specified.
 *
 * Visual regression tools like Chromatic, Lost Pixel, and Storyshots capture
 * component screenshots from a Storybook static build. Without knowing where
 * the build output lives, the tool cannot locate the stories to render.
 *
 * If spec.stories is non-empty, then spec.storybookBuildDir must be declared.
 * If spec.storybookBuildDir is declared, it should exist on disk (or be a
 * build output path that will exist at test run time — we check if it looks
 * like a valid relative path, not whether it currently exists).
 *
 * This gate is skipped if spec.stories is not declared.
 * Tools that don't use Storybook (Percy page capture, Playwright VRT) can
 * use spec.routes instead and will not trigger this gate.
 */

// Common Storybook build output directories
const COMMON_STORYBOOK_DIRS = ['storybook-static', '.storybook-static', 'build-storybook', 'dist/storybook'];

export async function run({ dir, projectRoot }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA064', message: 'visual-regression-spec.json not readable' }; }

  if (!Array.isArray(spec.stories) || spec.stories.length === 0) {
    return { pass: true, code: 'QA064', message: 'No stories declared — storybook build dir not required', skipped: true };
  }

  if (!spec.storybookBuildDir) {
    // Check if a common Storybook build dir exists at project root
    const root = projectRoot ?? dir;
    const found = COMMON_STORYBOOK_DIRS.find(d => existsSync(join(root, d)));
    if (found) {
      return {
        pass: false, code: 'QA064',
        message: `stories declared but storybookBuildDir not set (found "${found}" at project root)`,
        detail: `Add "storybookBuildDir": "${found}" to the spec.`,
      };
    }
    return {
      pass: false, code: 'QA064',
      message: 'stories declared but storybookBuildDir not set',
      detail: 'Add "storybookBuildDir": "storybook-static" (or your build output directory).\nRun "storybook build" to produce the static output.',
    };
  }

  // Basic path sanity — should not be an absolute system path
  if (spec.storybookBuildDir.startsWith('/') || spec.storybookBuildDir.startsWith('~')) {
    return {
      pass: false, code: 'QA064',
      message: `storybookBuildDir "${spec.storybookBuildDir}" is an absolute path — use a relative path`,
    };
  }

  return {
    pass: true, code: 'QA064',
    message: `storybookBuildDir: "${spec.storybookBuildDir}" declared for ${spec.stories.length} story target(s)`,
  };
}
