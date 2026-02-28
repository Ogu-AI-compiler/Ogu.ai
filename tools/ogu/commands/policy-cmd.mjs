import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import {
  compileAndSave, loadCompiledAST, loadPolicyVersion,
  verifyASTFreshness, freezePolicy, unfreezePolicy, isPolicyFrozen,
} from './lib/policy-ast.mjs';

/**
 * ogu policy:compile   — Compile rules.json → AST
 * ogu policy:list      — List compiled rules
 * ogu policy:freeze    — Freeze policy (prevent changes)
 * ogu policy:unfreeze  — Unfreeze policy
 * ogu policy:verify    — Check AST freshness
 * ogu policy:version   — Show version chain
 */

export async function policyCompile() {
  const root = repoRoot();
  const result = compileAndSave(root);
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  console.log(`  Compiled: ${result.ast.ruleCount} rules → policy.ast.json`);
  console.log(`  Version: ${result.version.version}`);
  console.log(`  AST hash: ${result.ast.astHash}`);
  console.log(`  Effect groups: ${result.ast.effectGroups.join(', ')}`);
  return 0;
}

export async function policyList() {
  const root = repoRoot();
  const ast = loadCompiledAST(root);
  if (!ast) {
    console.error('No compiled AST. Run: ogu policy:compile');
    return 1;
  }
  console.log(`\n  Policy AST — ${ast.ruleCount} rules\n`);
  for (const rule of ast.rules) {
    const effects = rule.effects.map(e => e.effect).join(', ');
    console.log(`  ${rule.id.padEnd(28)} prio=${rule.priority}  group=${rule.group}  effects=[${effects}]`);
  }
  console.log(`\n  Effect groups: ${ast.effectGroups.join(', ')}`);
  console.log(`  AST hash: ${ast.astHash}`);
  console.log(`  Compiled: ${ast.compiledAt}`);
  return 0;
}

export async function policyFreeze() {
  const root = repoRoot();
  if (isPolicyFrozen(root)) {
    console.log('  Policy is already frozen.');
    return 0;
  }
  freezePolicy(root);
  console.log('  Policy frozen. Changes blocked until unfreeze.');
  return 0;
}

export async function policyUnfreeze() {
  const root = repoRoot();
  if (!isPolicyFrozen(root)) {
    console.log('  Policy is not frozen.');
    return 0;
  }
  unfreezePolicy(root);
  console.log('  Policy unfrozen.');
  return 0;
}

export async function policyVerify() {
  const root = repoRoot();
  const result = verifyASTFreshness(root);
  if (result.fresh) {
    console.log('  AST is fresh — matches current rules.json');
    return 0;
  }
  console.error(`  ${result.error}`);
  return 1;
}

export async function policyVersion() {
  const root = repoRoot();
  const chain = loadPolicyVersion(root);
  if (!chain.current) {
    console.error('No policy version. Run: ogu policy:compile');
    return 1;
  }
  console.log(`\n  Current version: ${chain.current.version}`);
  console.log(`  Rules hash: ${chain.current.rulesHash}`);
  console.log(`  AST hash: ${chain.current.astHash}`);
  console.log(`  Compiled: ${chain.current.compiledAt}`);
  console.log(`  Frozen: ${chain.frozen ? 'yes' : 'no'}`);
  if (chain.history?.length > 0) {
    console.log(`\n  History (${chain.history.length} versions):`);
    for (const h of chain.history.slice(0, 10)) {
      console.log(`    v${h.version} — ${h.compiledAt} (${(h.changedRules || []).join(', ') || 'no changes'})`);
    }
  }
  return 0;
}
