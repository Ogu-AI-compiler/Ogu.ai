import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { broadcast } from "../ws/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getRoot() { return process.env.OGU_ROOT || process.cwd(); }

function getCliPath() {
  return join(__dirname, "..", "..", "..", "ogu", "cli.mjs");
}

function readJson(path: string) {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return null; }
}

let jobCounter = 0;

function runCommandAsync(command: string, args: string[] = []): string {
  const jobId = `brand-${++jobCounter}`;
  const root = getRoot();
  const cli = getCliPath();

  const child = spawn("node", [cli, command, ...args], {
    cwd: root,
    env: { ...process.env, OGU_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    broadcast({ type: "command:output", jobId, stream: "stdout", data: chunk.toString() });
  });
  child.stderr.on("data", (chunk) => {
    broadcast({ type: "command:output", jobId, stream: "stderr", data: chunk.toString() });
  });
  child.on("close", (code) => {
    broadcast({ type: "command:complete", jobId, exitCode: code ?? 1 });
  });

  return jobId;
}

export function createBrandRouter() {
  const brand = new Hono();

  // List all brand scans
  brand.get("/brand/scans", (c) => {
    const brandsDir = join(getRoot(), ".ogu/brands");
    if (!existsSync(brandsDir)) return c.json([]);

    const files = readdirSync(brandsDir).filter((f) => f.endsWith(".json"));
    const scans = files
      .map((f) => readJson(join(brandsDir, f)))
      .filter(Boolean);

    return c.json(scans);
  });

  // Get current design reference
  brand.get("/brand/reference", (c) => {
    const refPath = join(getRoot(), ".ogu/REFERENCE.json");
    const ref = readJson(refPath);
    return c.json(ref || null);
  });

  // List reference image files
  brand.get("/brand/reference/images", (c) => {
    const refsDir = join(getRoot(), ".ogu/references");
    if (!existsSync(refsDir)) return c.json([]);

    const files = readdirSync(refsDir).map((name) => {
      const fullPath = join(refsDir, name);
      const stat = statSync(fullPath);
      return { name, size: stat.size, modified: stat.mtime.toISOString() };
    });

    return c.json(files);
  });

  // Trigger brand scan
  brand.post("/brand/scan", async (c) => {
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "url is required" }, 400);
    const jobId = runCommandAsync("brand-scan", [url, "--apply"]);
    return c.json({ jobId });
  });

  // Trigger reference scan
  brand.post("/brand/reference/scan", async (c) => {
    const { urls } = await c.req.json();
    if (!urls || !Array.isArray(urls) || urls.length < 2) {
      return c.json({ error: "At least 2 URLs required" }, 400);
    }
    const jobId = runCommandAsync("reference", [...urls, "--apply", "--soul"]);
    return c.json({ jobId });
  });

  // Clear reference
  brand.post("/brand/reference/clear", async (c) => {
    const jobId = runCommandAsync("reference", ["clear"]);
    return c.json({ jobId });
  });

  // ── Brand Input (user-provided references) ──

  // Get saved brand input
  brand.get("/brand/input", (c) => {
    const inputPath = join(getRoot(), ".ogu/BRAND_INPUT.json");
    const data = readJson(inputPath);
    return c.json(data || { urls: [], images: [] });
  });

  // Save brand input
  brand.post("/brand/input", async (c) => {
    const body = await c.req.json();
    const oguDir = join(getRoot(), ".ogu");
    mkdirSync(oguDir, { recursive: true });
    writeFileSync(join(oguDir, "BRAND_INPUT.json"), JSON.stringify(body, null, 2));
    return c.json({ ok: true });
  });

  // Upload brand reference image
  brand.post("/brand/input/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json({ error: "file field is required" }, 400);
    }
    const uploadDir = join(getRoot(), ".ogu", "uploads", "brand");
    mkdirSync(uploadDir, { recursive: true });
    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (file as File).name || "upload";
    const filePath = join(uploadDir, fileName);
    writeFileSync(filePath, buffer);
    return c.json({ path: filePath, name: fileName });
  });

  // Serve brand reference image
  brand.get("/brand/input/image/:name", (c) => {
    const name = c.req.param("name");
    const filePath = join(getRoot(), ".ogu", "uploads", "brand", name);
    if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
    const buffer = readFileSync(filePath);
    const ext = name.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "application/octet-stream";
    return new Response(buffer, { headers: { "Content-Type": mime, "Cache-Control": "max-age=3600" } });
  });

  // List logos for a domain
  brand.get("/brand/logos/:domain", (c) => {
    const domain = c.req.param("domain");
    const logosDir = join(getRoot(), ".ogu", "brands", domain);
    if (!existsSync(logosDir) || !statSync(logosDir).isDirectory()) return c.json([]);
    const files = readdirSync(logosDir).filter((f) =>
      /\.(svg|png|jpg|jpeg|gif|webp|ico)$/i.test(f)
    );
    return c.json(files.map((name) => ({ name, url: `/api/brand/logos/${domain}/${name}` })));
  });

  // Serve logo file
  brand.get("/brand/logos/:domain/:file", (c) => {
    const domain = c.req.param("domain");
    const file = c.req.param("file");
    const filePath = join(getRoot(), ".ogu", "brands", domain, file);
    if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
    const buffer = readFileSync(filePath);
    const ext = file.split(".").pop()?.toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml"
      : ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : ext === "ico" ? "image/x-icon"
      : "application/octet-stream";
    return new Response(buffer, { headers: { "Content-Type": mime, "Cache-Control": "max-age=3600" } });
  });

  // Serve font files for a domain
  brand.get("/brand/fonts/:domain/:file", (c) => {
    const domain = c.req.param("domain");
    const file = c.req.param("file");
    const filePath = join(getRoot(), ".ogu", "brands", domain, "fonts", file);
    if (!existsSync(filePath)) return c.json({ error: "Not found" }, 404);
    const buffer = readFileSync(filePath);
    const ext = file.split(".").pop()?.toLowerCase();
    const mime = ext === "woff2" ? "font/woff2"
      : ext === "woff" ? "font/woff"
      : ext === "ttf" ? "font/ttf"
      : ext === "otf" ? "font/otf"
      : "application/octet-stream";
    return new Response(buffer, { headers: { "Content-Type": mime, "Cache-Control": "max-age=86400" } });
  });

  return brand;
}
