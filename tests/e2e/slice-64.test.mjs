/**
 * Slice 64 — Cron Scheduler + Notification Channel
 *
 * Cron scheduler: schedule recurring tasks with cron expressions.
 * Notification channel: multi-channel notifications (console, file, webhook stub).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice64-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/notifications"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 64 — Cron Scheduler + Notification Channel\x1b[0m\n");

// ── Part 1: Cron Scheduler ──────────────────────────────

console.log("\x1b[36m  Part 1: Cron Scheduler\x1b[0m");

const cronLib = join(process.cwd(), "tools/ogu/commands/lib/cron-scheduler.mjs");
assert("cron-scheduler.mjs exists", () => {
  if (!existsSync(cronLib)) throw new Error("file missing");
});

const cronMod = await import(cronLib);

assert("createScheduler returns scheduler", () => {
  if (typeof cronMod.createScheduler !== "function") throw new Error("missing");
  const s = cronMod.createScheduler();
  if (typeof s.addJob !== "function") throw new Error("missing addJob");
  if (typeof s.removeJob !== "function") throw new Error("missing removeJob");
  if (typeof s.listJobs !== "function") throw new Error("missing listJobs");
  if (typeof s.getNextRun !== "function") throw new Error("missing getNextRun");
});

assert("addJob registers a scheduled job", () => {
  const s = cronMod.createScheduler();
  s.addJob({ id: "cleanup", schedule: "0 0 * * *", task: "clean --all" });
  const jobs = s.listJobs();
  if (jobs.length !== 1) throw new Error(`expected 1, got ${jobs.length}`);
  if (jobs[0].id !== "cleanup") throw new Error("wrong id");
});

assert("removeJob removes a job", () => {
  const s = cronMod.createScheduler();
  s.addJob({ id: "j1", schedule: "0 0 * * *", task: "task1" });
  s.addJob({ id: "j2", schedule: "0 12 * * *", task: "task2" });
  s.removeJob("j1");
  const jobs = s.listJobs();
  if (jobs.length !== 1) throw new Error(`expected 1 after remove, got ${jobs.length}`);
});

assert("getNextRun returns next execution time", () => {
  const s = cronMod.createScheduler();
  s.addJob({ id: "daily", schedule: "0 0 * * *", task: "daily-task" });
  const next = s.getNextRun("daily");
  if (!next) throw new Error("should return next run time");
  if (typeof next.getTime !== "function") throw new Error("should be Date");
  if (next <= new Date()) throw new Error("should be in the future");
});

assert("parseCron handles standard expressions", () => {
  if (typeof cronMod.parseCron !== "function") throw new Error("missing");
  const parsed = cronMod.parseCron("30 14 * * 1-5");
  if (!parsed) throw new Error("should parse successfully");
  if (parsed.minute !== 30) throw new Error(`expected minute=30, got ${parsed.minute}`);
  if (parsed.hour !== 14) throw new Error(`expected hour=14, got ${parsed.hour}`);
});

// ── Part 2: Notification Channel ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Notification Channel\x1b[0m");

const notifLib = join(process.cwd(), "tools/ogu/commands/lib/notification-channel.mjs");
assert("notification-channel.mjs exists", () => {
  if (!existsSync(notifLib)) throw new Error("file missing");
});

const notifMod = await import(notifLib);

assert("createNotifier returns notifier", () => {
  if (typeof notifMod.createNotifier !== "function") throw new Error("missing");
  const n = notifMod.createNotifier({ root: tmp });
  if (typeof n.send !== "function") throw new Error("missing send");
  if (typeof n.getHistory !== "function") throw new Error("missing getHistory");
});

assert("send logs notification to file", () => {
  const n = notifMod.createNotifier({ root: tmp });
  n.send({ channel: "file", severity: "info", title: "Build done", message: "Feature auth compiled." });
  const history = n.getHistory();
  if (history.length < 1) throw new Error("should have 1 notification");
  if (history[0].title !== "Build done") throw new Error("wrong title");
});

assert("send supports multiple channels", () => {
  const n = notifMod.createNotifier({ root: tmp });
  n.send({ channel: "console", severity: "warning", title: "Budget", message: "75% used" });
  n.send({ channel: "file", severity: "error", title: "Gate", message: "Gate 5 failed" });
  const history = n.getHistory();
  const channels = [...new Set(history.map(h => h.channel))];
  if (channels.length < 2) throw new Error("should support multiple channels");
});

assert("NOTIFICATION_CHANNELS lists supported channels", () => {
  if (!notifMod.NOTIFICATION_CHANNELS) throw new Error("missing");
  if (!notifMod.NOTIFICATION_CHANNELS.includes("console")) throw new Error("missing console");
  if (!notifMod.NOTIFICATION_CHANNELS.includes("file")) throw new Error("missing file");
  if (!notifMod.NOTIFICATION_CHANNELS.includes("webhook")) throw new Error("missing webhook");
});

assert("send filters by minimum severity", () => {
  const n = notifMod.createNotifier({ root: tmp, minSeverity: "warning" });
  n.send({ channel: "file", severity: "info", title: "Low", message: "Skipped" });
  n.send({ channel: "file", severity: "warning", title: "Med", message: "Kept" });
  const history = n.getHistory();
  if (history.length !== 1) throw new Error(`expected 1, got ${history.length}`);
  if (history[0].title !== "Med") throw new Error("should only keep warning+");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
