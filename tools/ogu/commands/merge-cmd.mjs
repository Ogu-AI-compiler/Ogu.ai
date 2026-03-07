/**
 * Merge CLI Commands — AST-level merge, conflict preview, conflict listing.
 *
 * merge:preview <file>     — Preview merge results for conflicting files
 * merge:ast <file>         — Run AST-level merge on conflicting files
 * merge:conflicts          — List all current merge conflicts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { repoRoot } from '../util.mjs';
import { mergeFileAST, detectASTConflicts, extractBlocks, computeASTDiff, detectSemanticConflicts } from './lib/ast-merge.mjs';
import { createMergeCoordinator } from './lib/merge-coordinator.mjs';

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { file: null, base: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) { result.base = args[++i]; continue; }
    if (args[i] === '--json') { result.json = true; continue; }
    if (!args[i].startsWith('--') && !result.file) { result.file = args[i]; }
  }
  return result;
}

/**
 * ogu merge:preview <file> [--base <baseFile>]
 *
 * Shows what would happen if conflicting versions were merged,
 * without actually writing anything.
 */
export async function mergePreview() {
  const root = repoRoot();
  const { file, json } = parseArgs();

  if (!file) {
    console.error('Usage: ogu merge:preview <file> [--base <baseFile>]');
    return 1;
  }

  const filePath = join(root, file);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${file}`);
    return 1;
  }

  const content = readFileSync(filePath, 'utf8');
  const ext = extname(file);
  const blocks = extractBlocks(content, ext.replace('.', '') || 'javascript');

  if (json) {
    console.log(JSON.stringify({ file, blocks: blocks.length, blockNames: blocks.map(b => b.name || b.type) }, null, 2));
    return 0;
  }

  console.log(`MERGE PREVIEW: ${file}`);
  console.log('');
  console.log(`  Blocks detected: ${blocks.length}`);
  console.log('');
  for (const block of blocks) {
    const name = block.name || block.type || 'anonymous';
    const lines = block.content ? block.content.split('\n').length : 0;
    console.log(`  [${block.type}] ${name} (${lines} lines)`);
  }

  // Check for pending merge conflicts in .ogu/merge/pending/
  const pendingDir = join(root, '.ogu/merge/pending');
  if (existsSync(pendingDir)) {
    const pendingFiles = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    const relevant = pendingFiles.filter(f => {
      try {
        const data = JSON.parse(readFileSync(join(pendingDir, f), 'utf8'));
        return data.filePath === file;
      } catch { return false; }
    });
    if (relevant.length > 0) {
      console.log('');
      console.log(`  Pending conflicts: ${relevant.length}`);
      for (const r of relevant) {
        console.log(`    - ${r}`);
      }
    }
  }

  console.log('');
  console.log('  Strategy: AST-level > line-level > manual');
  return 0;
}

/**
 * ogu merge:ast <file> [--base <baseFile>]
 *
 * Run AST-level merge on a file with detected conflicts.
 */
export async function mergeAst() {
  const root = repoRoot();
  const { file } = parseArgs();

  if (!file) {
    console.error('Usage: ogu merge:ast <file>');
    return 1;
  }

  const filePath = join(root, file);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${file}`);
    return 1;
  }

  const content = readFileSync(filePath, 'utf8');

  // Check for conflict markers in the file
  if (!content.includes('<<<<<<<') && !content.includes('>>>>>>>')) {
    console.log(`No merge conflicts found in: ${file}`);
    return 0;
  }

  // Extract the three versions from conflict markers
  const sections = content.split(/^(<{7}|={7}|>{7}).*$/m);
  const base = '';
  let ours = '';
  let theirs = '';
  let inOurs = false;
  let inTheirs = false;

  for (const section of sections) {
    if (section.startsWith('<<<<<<<')) { inOurs = true; inTheirs = false; continue; }
    if (section.startsWith('=======')) { inOurs = false; inTheirs = true; continue; }
    if (section.startsWith('>>>>>>>')) { inTheirs = false; continue; }
    if (inOurs) ours += section;
    else if (inTheirs) theirs += section;
  }

  const result = mergeFileAST(base, ours, theirs);

  // Register merge with coordinator for cross-agent conflict detection
  const coordinator = createMergeCoordinator();
  const mergeReq = coordinator.requestMerge({
    sourceBranch: 'ours',
    targetBranch: 'theirs',
    agentId: 'ast-merge',
    files: [file],
  });
  const crossConflicts = coordinator.detectConflicts(mergeReq.id);

  console.log(`AST MERGE: ${file}`);
  console.log('');
  console.log(`  Strategy used: ${result.strategy}`);
  console.log(`  Conflicts resolved: ${result.conflictsResolved || 0}`);
  console.log(`  Remaining conflicts: ${result.remainingConflicts || 0}`);

  if (crossConflicts.length > 0) {
    console.log(`  Cross-agent conflicts: ${crossConflicts.length}`);
    for (const cc of crossConflicts) {
      console.log(`    - ${cc.file} (conflicts with ${cc.conflictsWith}, agent: ${cc.agentId})`);
    }
  }

  if (result.merged) {
    console.log('');
    console.log('  Result: merged successfully');
    console.log(`  Output lines: ${result.merged.split('\n').length}`);
  }

  return result.remainingConflicts > 0 ? 1 : 0;
}

/**
 * ogu merge:conflicts
 *
 * List all current merge conflicts across the project.
 */
export async function mergeConflicts() {
  const root = repoRoot();
  const { json } = parseArgs();
  const pendingDir = join(root, '.ogu/merge/pending');
  const conflicts = [];

  // Check .ogu/merge/pending directory
  if (existsSync(pendingDir)) {
    const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(join(pendingDir, f), 'utf8'));
        conflicts.push({
          id: f.replace('.json', ''),
          filePath: data.filePath,
          agents: data.agents || [],
          createdAt: data.createdAt,
          strategy: data.strategy || 'pending',
        });
      } catch { /* skip corrupt files */ }
    }
  }

  // Also check coordinator queue for in-flight merge requests
  const coordinator = createMergeCoordinator();
  const coordinatorQueue = coordinator.getQueue();

  if (json) {
    console.log(JSON.stringify({ diskConflicts: conflicts, coordinatorQueue }, null, 2));
    return 0;
  }

  if (conflicts.length === 0 && coordinatorQueue.length === 0) {
    console.log('No merge conflicts found.');
    return 0;
  }

  if (conflicts.length > 0) {
    console.log(`\n  Merge Conflicts (${conflicts.length}):\n`);
    for (const c of conflicts) {
      console.log(`  ${c.id.slice(0, 8)}  ${c.filePath}`);
      if (c.agents.length > 0) console.log(`    Agents: ${c.agents.join(', ')}`);
      console.log(`    Strategy: ${c.strategy}`);
      if (c.createdAt) console.log(`    Since: ${c.createdAt}`);
    }
  }

  if (coordinatorQueue.length > 0) {
    console.log(`\n  Coordinator Pending Merges (${coordinatorQueue.length}):\n`);
    for (const req of coordinatorQueue) {
      console.log(`  ${req.id}  ${req.sourceBranch} → ${req.targetBranch}`);
      if (req.agentId) console.log(`    Agent: ${req.agentId}`);
      console.log(`    Files: ${req.files.join(', ') || 'none'}`);
    }
  }

  console.log('');
  return 0;
}
