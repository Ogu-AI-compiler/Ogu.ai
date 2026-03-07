import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { Hono } from "hono";
import { broadcast } from "../ws/server.js";
import { getUploadsDir } from "../../../ogu/commands/lib/runtime-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jobs = new Map<string, { exitCode: number | null; output: string[] }>();
let jobCounter = 0;

function getCliPath() {
  // __dirname = tools/studio/server/api
  // CLI at   = tools/ogu/cli.mjs
  return join(__dirname, "..", "..", "..", "ogu", "cli.mjs");
}

function runCommand(command: string, args: string[] = []): string {
  const jobId = `job-${++jobCounter}`;
  const root = process.env.OGU_ROOT || process.cwd();
  const cli = getCliPath();

  const output: string[] = [];
  jobs.set(jobId, { exitCode: null, output });

  const child = spawn("node", [cli, command, ...args], {
    cwd: root,
    env: { ...process.env, OGU_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const line = chunk.toString();
    output.push(line);
    broadcast({ type: "command:output", jobId, stream: "stdout", data: line });
  });

  child.stderr.on("data", (chunk) => {
    const line = chunk.toString();
    output.push(line);
    broadcast({ type: "command:output", jobId, stream: "stderr", data: line });
  });

  child.on("close", (code) => {
    const job = jobs.get(jobId);
    if (job) job.exitCode = code ?? 1;
    broadcast({ type: "command:complete", jobId, exitCode: code ?? 1 });
  });

  return jobId;
}

function runSync(command: string, args: string[] = []): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    const root = process.env.OGU_ROOT || process.cwd();
    const cli = getCliPath();
    const chunks: string[] = [];

    const child = spawn("node", [cli, command, ...args], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (d) => chunks.push(d.toString()));
    child.stderr.on("data", (d) => chunks.push(d.toString()));
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout: chunks.join("") });
    });
  });
}

export function createExecRouter() {
  const exec = new Hono();

  // Async command execution
  exec.post("/command", async (c) => {
    const body = await c.req.json();
    const { command, args = [] } = body;
    if (!command) return c.json({ error: "command is required" }, 400);
    const jobId = runCommand(command, args);
    return c.json({ jobId });
  });

  // Sync command execution (blocking)
  exec.post("/command/sync", async (c) => {
    const body = await c.req.json();
    const { command, args = [] } = body;
    if (!command) return c.json({ error: "command is required" }, 400);
    const result = await runSync(command, args);
    return c.json(result);
  });

  // Gate operations
  exec.post("/gates/run", async (c) => {
    const { slug, force, gate } = await c.req.json();
    const args = ["run", slug];
    if (force) args.push("--force");
    if (gate != null) args.push("--gate", String(gate));
    const jobId = runCommand("gates", args);
    return c.json({ jobId });
  });

  exec.post("/gates/reset", async (c) => {
    const { slug } = await c.req.json();
    const jobId = runCommand("gates", ["reset", slug]);
    return c.json({ jobId });
  });

  // Feature operations
  exec.post("/features", async (c) => {
    const { slug } = await c.req.json();
    if (!slug) return c.json({ error: "slug is required" }, 400);
    const jobId = runCommand("feature:create", [slug]);
    return c.json({ jobId });
  });

  exec.post("/features/:slug/switch", (c) => {
    const slug = c.req.param("slug");
    const jobId = runCommand("switch", [slug]);
    return c.json({ jobId });
  });

  // Shell command execution (arbitrary bash)
  exec.post("/shell", async (c) => {
    const { cmd } = await c.req.json();
    if (!cmd) return c.json({ error: "cmd is required" }, 400);

    const root = process.env.OGU_ROOT || process.cwd();
    const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const child = spawn("bash", ["-c", cmd], {
        cwd: root,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (d) => stdoutChunks.push(d.toString()));
      child.stderr.on("data", (d) => stderrChunks.push(d.toString()));
      child.on("close", (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout: stdoutChunks.join(""),
          stderr: stderrChunks.join(""),
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          exitCode: 1,
          stdout: stdoutChunks.join(""),
          stderr: "Command timed out after 30 seconds",
        });
      }, 30000);
    });

    return c.json(result);
  });

  // Theme
  exec.post("/theme/set", async (c) => {
    const { mood } = await c.req.json();
    if (!mood) return c.json({ error: "mood is required" }, 400);
    const result = await runSync("theme", ["set", mood]);
    if (result.exitCode === 0) {
      await runSync("theme", ["apply"]);
    }
    return c.json(result);
  });

  // File upload
  exec.post("/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "file field is required" }, 400);
    }

    const root = process.env.OGU_ROOT || process.cwd();
    const uploadDir = getUploadsDir(root);
    mkdirSync(uploadDir, { recursive: true });

    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (file as File).name || "upload";
    const filePath = join(uploadDir, fileName);

    writeFileSync(filePath, buffer);

    const mimeType = (file as File).type || "application/octet-stream";
    const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;

    return c.json({ path: filePath, name: fileName, base64 });
  });

  return exec;
}
