import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { routeModel, routingStats } from './lib/model-router.mjs';

/**
 * ogu model:route --role <roleId> --phase <phase> [--failures N]
 * ogu model:providers [--json]
 * ogu model:status [--days N] [--json]
 */

export async function modelRoute() {
  const args = process.argv.slice(3);
  let roleId = null, phase = null, failures = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role' && args[i + 1]) roleId = args[++i];
    else if (args[i] === '--phase' && args[i + 1]) phase = args[++i];
    else if (args[i] === '--failures' && args[i + 1]) failures = parseInt(args[++i], 10);
  }

  if (!roleId || !phase) {
    console.error('Usage: ogu model:route --role <roleId> --phase <phase> [--failures N]');
    return 1;
  }

  try {
    const result = routeModel({ roleId, phase, taskId: 'dry-run', failureCount: failures });
    console.log(`Provider:  ${result.provider}`);
    console.log(`Model:     ${result.model}${result.reason === 'escalation' ? ` (escalated after ${failures} failures)` : ''}`);
    console.log(`Full ID:   ${result.fullModelId}`);
    console.log(`Reason:    ${result.reason}`);
    console.log(`Retry:     max ${result.retryPolicy.maxRetries}, escalate: ${result.retryPolicy.escalateOnFailure}`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

export async function modelProviders() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const root = repoRoot();

  // Read from model-config.json if available, fallback to OrgSpec
  let providers = [];
  const configPath = join(root, '.ogu/model-config.json');
  const orgPath = join(root, '.ogu/OrgSpec.json');

  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    providers = config.providers || [];
  } else if (existsSync(orgPath)) {
    const org = JSON.parse(readFileSync(orgPath, 'utf8'));
    providers = org.providers || [];
  }

  if (jsonOutput) {
    console.log(JSON.stringify(providers, null, 2));
    return 0;
  }

  if (providers.length === 0) {
    console.log('No providers configured.');
    return 0;
  }

  console.log('\n  PROVIDER    STATUS    MODELS                          API KEY');
  for (const p of providers) {
    const status = p.enabled ? 'enabled' : 'disabled';
    const models = (p.models || []).map(m => m.id || m.name || m).join(', ') || '—';
    const keyEnv = p.apiKeyEnv || '—';
    const keySet = p.apiKeyEnv && process.env[p.apiKeyEnv] ? 'set' : 'missing';
    console.log(`  ${(p.id || p.name).padEnd(12)} ${status.padEnd(9)} ${models.padEnd(30)}  ${keySet}`);
  }
  console.log('');
  return 0;
}

export async function modelStatus() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const daysFlag = args.indexOf('--days');
  const days = daysFlag >= 0 && args[daysFlag + 1] ? parseInt(args[daysFlag + 1], 10) : 7;
  const root = repoRoot();

  const stats = routingStats(root, { days });

  if (jsonOutput) {
    console.log(JSON.stringify(stats, null, 2));
    return 0;
  }

  console.log(`\n  Model Router Status (${days} days)\n`);
  console.log(`  Decisions:   ${stats.decisions}`);
  console.log(`  Escalations: ${stats.escalations}`);

  if (Object.keys(stats.byModel).length > 0) {
    console.log('');
    console.log('  MODEL USAGE:');
    const total = stats.decisions || 1;
    for (const [model, count] of Object.entries(stats.byModel).sort((a, b) => b[1] - a[1])) {
      const pct = Math.round(count / total * 100);
      const bar = '#'.repeat(Math.round(pct / 5));
      console.log(`  ${model.padEnd(10)} │ ${bar.padEnd(20)} ${pct}%  │ ${count} calls`);
    }
  }

  console.log('');
  return 0;
}
