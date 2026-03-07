/**
 * experience-digest.mjs — Slice 439
 * Persistent per-agent experience file management.
 *
 * Storage: .ogu/marketplace/experience/{agentId}.json
 *
 * Each experience file contains:
 *   { agentId, rules: [{ text, source, addedAt, uses }], updatedAt }
 *
 * Exports:
 *   MAX_EXPERIENCE_RULES
 *   saveExperienceDigest(root, agentId, digest) → void
 *   loadExperienceDigest(root, agentId) → ExperienceDigest
 *   appendExperienceRule(root, agentId, rule) → { added, reason? }
 *   deduplicateRules(rules) → Rule[]
 *   decayRules(rules, thresholdDays) → Rule[]
 *   buildInjectionBlock(rules) → string
 *   getExperienceForPrompt(root, agentId, opts?) → string
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getMarketplaceDir } from './runtime-paths.mjs';

export const MAX_EXPERIENCE_RULES = 50;

function experienceDir(root) {
  return join(getMarketplaceDir(root), 'experience');
}

function experiencePath(root, agentId) {
  return join(experienceDir(root), `${agentId}.json`);
}

// ── Save / Load ─────────────────────────────────────────────────────────────

export function saveExperienceDigest(root, agentId, digest) {
  const dir = experienceDir(root);
  mkdirSync(dir, { recursive: true });
  const data = {
    agentId,
    rules: digest.rules || [],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(experiencePath(root, agentId), JSON.stringify(data, null, 2), 'utf-8');
}

export function loadExperienceDigest(root, agentId) {
  const path = experiencePath(root, agentId);
  if (!existsSync(path)) {
    return { agentId, rules: [], updatedAt: null };
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return { agentId, rules: data.rules || [], updatedAt: data.updatedAt || null };
  } catch {
    return { agentId, rules: [], updatedAt: null };
  }
}

// ── Append rule ─────────────────────────────────────────────────────────────

export function appendExperienceRule(root, agentId, rule) {
  const digest = loadExperienceDigest(root, agentId);
  const text = (rule.text || '').trim();
  if (!text) return { added: false, reason: 'empty' };

  // Check for exact duplicate
  const existing = digest.rules.find(r => r.text === text);
  if (existing) {
    existing.uses = (existing.uses || 0) + 1;
    saveExperienceDigest(root, agentId, digest);
    return { added: false, reason: 'duplicate' };
  }

  const newRule = {
    text,
    source: rule.source || 'unknown',
    addedAt: new Date().toISOString().slice(0, 10),
    uses: 0,
  };

  // If at cap, evict the least-used rule
  if (digest.rules.length >= MAX_EXPERIENCE_RULES) {
    const sorted = [...digest.rules].sort((a, b) => (a.uses || 0) - (b.uses || 0));
    const evictText = sorted[0].text;
    digest.rules = digest.rules.filter(r => r.text !== evictText);
  }

  digest.rules.push(newRule);
  saveExperienceDigest(root, agentId, digest);
  return { added: true };
}

// ── Deduplication ───────────────────────────────────────────────────────────

export function deduplicateRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  const map = new Map();
  for (const rule of rules) {
    const key = rule.text;
    const existing = map.get(key);
    if (!existing || (rule.uses || 0) > (existing.uses || 0)) {
      map.set(key, { ...rule });
    }
  }
  return [...map.values()];
}

// ── Decay ───────────────────────────────────────────────────────────────────

export function decayRules(rules, thresholdDays = 30) {
  if (!Array.isArray(rules)) return [];
  const cutoff = Date.now() - thresholdDays * 86400000;
  return rules.filter(rule => {
    if ((rule.uses || 0) > 0) return true;
    const addedMs = rule.addedAt ? new Date(rule.addedAt).getTime() : Date.now();
    return addedMs >= cutoff;
  });
}

// ── Injection block ─────────────────────────────────────────────────────────

export function buildInjectionBlock(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return '';
  const sorted = [...rules].sort((a, b) => (b.uses || 0) - (a.uses || 0));
  const lines = ['## Agent Experience'];
  for (const rule of sorted) {
    lines.push(`- ${rule.text}`);
  }
  return lines.join('\n');
}

// ── Prompt helper ───────────────────────────────────────────────────────────

export function getExperienceForPrompt(root, agentId, opts = {}) {
  const digest = loadExperienceDigest(root, agentId);
  if (digest.rules.length === 0) return '';

  let rules = digest.rules;
  if (opts.maxRules && rules.length > opts.maxRules) {
    rules = [...rules].sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, opts.maxRules);
  }

  return buildInjectionBlock(rules);
}
