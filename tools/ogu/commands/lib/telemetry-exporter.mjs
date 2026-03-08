/**
 * telemetry-exporter.mjs — Collects and exports system metrics.
 */
import { writeFileSync } from 'node:fs';

export function collectSystemMetrics() {
  const mem = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    process: { pid: process.pid, uptime: process.uptime(), heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss },
    platform: { arch: process.arch, platform: process.platform, nodeVersion: process.version },
  };
}

export function exportJSON(metrics, filePath) {
  if (!filePath) return JSON.stringify(metrics, null, 2);
  writeFileSync(filePath, JSON.stringify(metrics, null, 2), 'utf8');
  return filePath;
}
