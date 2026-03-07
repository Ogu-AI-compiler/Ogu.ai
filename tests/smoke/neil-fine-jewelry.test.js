import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { hasTaskGateEvidence, writeTaskGateEvidence } from "../../tools/ogu/commands/lib/task-gate-evidence.mjs";

// Repo root = two levels up from tests/smoke/
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

describe("neil-fine-jewelry smoke tests", () => {
  describe("Critical files exist", () => {
    it("gates.mjs exists", () => {
      expect(existsSync(join(root, "tools/ogu/commands/gates.mjs"))).toBe(true);
    });

    it("task-gate-evidence helper exists", () => {
      expect(existsSync(join(root, "tools/ogu/commands/lib/task-gate-evidence.mjs"))).toBe(true);
    });

    it("Studio package.json exists", () => {
      expect(existsSync(join(root, "tools/studio/package.json"))).toBe(true);
    });

    it("CLI entry point exists", () => {
      expect(existsSync(join(root, "tools/ogu/cli.mjs"))).toBe(true);
    });
  });

  describe("Gate evidence semantics", () => {
    it("marks task done when runner gate passes and no explicit evidence exists", () => {
      const tmpRoot = mkdtempSync(join(tmpdir(), "ogu-smoke-"));
      const runnersDir = join(tmpRoot, ".ogu", "runners");
      mkdirSync(runnersDir, { recursive: true });
      const taskId = "task-123";
      const output = { status: "success", gateResults: [{ gate: "task-123", passed: true }] };
      writeFileSync(join(runnersDir, `${taskId}.output.json`), JSON.stringify(output, null, 2));
      expect(hasTaskGateEvidence(tmpRoot, taskId)).toBe(true);
    });

    it("explicit failed evidence overrides runner output", () => {
      const tmpRoot = mkdtempSync(join(tmpdir(), "ogu-smoke-"));
      const runnersDir = join(tmpRoot, ".ogu", "runners");
      mkdirSync(runnersDir, { recursive: true });
      const taskId = "task-456";
      const output = { status: "success", gateResults: [{ gate: "task-456", passed: true }] };
      writeFileSync(join(runnersDir, `${taskId}.output.json`), JSON.stringify(output, null, 2));
      writeTaskGateEvidence(tmpRoot, taskId, { passed: false, source: "local" });
      expect(hasTaskGateEvidence(tmpRoot, taskId)).toBe(false);
    });
  });

  describe("Lifecycle enforcement is wired", () => {
    it("dispatch blocks when team not approved", () => {
      const dispatchPath = join(root, "tools/studio/server/api/dispatch.ts");
      if (!existsSync(dispatchPath)) return;
      const content = readFileSync(dispatchPath, "utf-8");
      expect(content).toContain("Team not approved");
    });

    it("brief approval persists approved_at", () => {
      const briefPath = join(root, "tools/studio/server/api/brief.ts");
      if (!existsSync(briefPath)) return;
      const content = readFileSync(briefPath, "utf-8");
      expect(content).toContain("approved_at");
    });
  });

  describe("Studio structure", () => {
    it("Studio src directory exists", () => {
      expect(existsSync(join(root, "tools/studio/src"))).toBe(true);
    });

    it("Studio server directory exists", () => {
      expect(existsSync(join(root, "tools/studio/server"))).toBe(true);
    });
  });
});
