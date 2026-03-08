/**
 * Why:
 * The ML model must be loaded once at application startup, not on every request.
 * Loading a model inside a request handler causes:
 * - Latency spike: joblib.load() of a 500 MB model takes 2-10 seconds per call
 * - Memory churn: each request deserializes a new copy into RAM
 * - Race conditions: multiple concurrent requests loading simultaneously
 *
 * Correct patterns (in order of preference):
 * 1. Module-level load: `MODEL = joblib.load(...)` at top level (simple, works for single-process)
 * 2. FastAPI lifespan: `@asynccontextmanager async def lifespan(app): app.state.model = ...`
 * 3. Flask before_first_request / init_app pattern
 *
 * Detection strategy:
 * - Find model-loading calls (joblib.load, torch.load, mlflow.*.load_model)
 * - Classify them as module-level (safe) or inside function bodies (unsafe)
 * - Functions named `predict`, `inference`, decorated with @app.route / @router.* are request handlers
 *
 * Escape hatch: add `# @load-per-request-ok: <reason>` if loading per-request
 * is intentional (e.g., A/B testing with dynamic model selection).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LOAD_CALLS = [
  /joblib\.load\s*\(/,
  /pickle\.load\s*\(/,
  /mlflow\.\w+\.load_model\s*\(/,
  /torch\.load\s*\(/,
  /keras\.models\.load_model|tf\.saved_model\.load/,
  /onnxruntime\.InferenceSession\s*\(/,
];

const REQUEST_HANDLER_RE = /@(?:app|router|blueprint)\.\s*(?:get|post|put|patch|delete|route)\s*\(|def\s+(?:predict|inference|serve|handle|endpoint)\s*\(|async\s+def\s+(?:predict|inference)\s*\(/;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: false, code: 'SA005', message: 'No Python files found' };

  const violations = [];

  for (const f of pyFiles) {
    const content = readFileSync(join(dir, f), 'utf8');

    // Check escape hatch for entire file
    if (/@load-per-request-ok/.test(content)) continue;

    const lines = content.split('\n');
    let insideHandler = false;
    let handlerIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect entry into a request handler function
      if (REQUEST_HANDLER_RE.test(line)) {
        insideHandler = true;
        handlerIndent = line.match(/^(\s*)/)[1].length;
        continue;
      }

      // Detect exit from handler (back to lower indent)
      if (insideHandler) {
        const currentIndent = line.match(/^(\s*)/)[1].length;
        if (trimmed && currentIndent <= handlerIndent && !trimmed.startsWith('#')) {
          insideHandler = false;
        }
      }

      if (!insideHandler) continue;
      if (/@load-per-request-ok/.test(line)) continue;

      for (const loadRe of LOAD_CALLS) {
        if (loadRe.test(line)) {
          violations.push(`${f}:${i + 1}: model loaded inside request handler — ${trimmed.slice(0, 70)}`);
          break;
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SA005',
      message: `${violations.length} model load(s) inside request handler`,
      detail: violations.join('\n') + '\n\n' +
              'Move model loading to module level or FastAPI lifespan:\n' +
              '  # Option 1 — module level (simple):\n' +
              '  MODEL = joblib.load("models/model.joblib")\n\n' +
              '  # Option 2 — FastAPI lifespan:\n' +
              '  @asynccontextmanager\n' +
              '  async def lifespan(app: FastAPI):\n' +
              '      app.state.model = joblib.load("models/model.joblib")\n' +
              '      yield\n\n' +
              'Add # @load-per-request-ok: <reason> to suppress if intentional.',
    };
  }

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasLoad = LOAD_CALLS.some(re => re.test(content));
  if (!hasLoad) return { pass: true, code: 'SA005', message: 'No model loading detected — check skipped', skipped: true };

  return { pass: true, code: 'SA005', message: 'Model loaded at startup level, not per-request' };
}
