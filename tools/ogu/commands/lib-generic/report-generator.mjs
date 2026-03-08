/**
 * Report Generator — produce compile reports, feature summaries, gate reports.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, readJsonSafe } from '../../util.mjs';

export const REPORT_TYPES = ['gate', 'feature', 'compile'];

/**
 * Generate gate status report for a feature.
 */
export function generateGateReport({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const gateState = readJsonSafe(join(root, '.ogu/GATE_STATE.json')) || {};
  const featureGates = gateState[featureSlug]?.gates || {};

  const lines = [`# Gate Report: ${featureSlug}`, '', `Generated: ${new Date().toISOString()}`, ''];

  const gateNames = Object.keys(featureGates).sort();
  if (gateNames.length === 0) {
    lines.push('No gates recorded.');
  } else {
    lines.push('| Gate | Status | Timestamp |');
    lines.push('|------|--------|-----------|');
    for (const name of gateNames) {
      const g = featureGates[name];
      const icon = g.status === 'pass' ? 'pass' : 'fail';
      lines.push(`| ${name} | ${icon} | ${g.ts || '-'} |`);
    }
  }

  const passed = gateNames.filter(g => featureGates[g].status === 'pass').length;
  const failed = gateNames.filter(g => featureGates[g].status !== 'pass').length;
  lines.push('', `**Summary:** ${passed} pass, ${failed} fail`);

  return lines.join('\n');
}

/**
 * Generate feature summary.
 */
export function generateFeatureSummary({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${featureSlug}`);
  const plan = readJsonSafe(join(featureDir, 'Plan.json'));

  const taskCount = plan?.tasks?.length || 0;
  const outputs = (plan?.tasks || []).flatMap(t => t.outputs || []);

  const lines = [
    `# Feature Summary: ${featureSlug}`,
    '',
    `- **Tasks:** ${taskCount} task${taskCount !== 1 ? 's' : ''}`,
    `- **Outputs:** ${outputs.length}`,
  ];

  if (taskCount > 0) {
    lines.push('', '## Tasks', '');
    for (const task of plan.tasks) {
      lines.push(`- [${task.id}] ${task.title}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate compile report combining gates and feature data.
 */
export function generateCompileReport({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const gateReport = generateGateReport({ root, featureSlug });
  const featureSummary = generateFeatureSummary({ root, featureSlug });

  return [
    `# Compile Report: ${featureSlug}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '---',
    '',
    featureSummary,
    '',
    '---',
    '',
    gateReport,
  ].join('\n');
}
