import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SA003 — health-endpoint
 * ML serving APIs must expose a /health or /healthz endpoint that verifies
 * the model is loaded and the service is ready to handle requests.
 *
 * Why:
 * - Load balancers and orchestrators (Kubernetes, ECS, Cloud Run) need a
 *   health check to know when a container is ready to receive traffic.
 *   Without one, traffic is routed before the model is loaded → 500 errors
 *   during model startup (which can take 5-30 seconds for large models).
 * - A health endpoint that checks model readiness (not just process liveness)
 *   distinguishes between "container started" and "model loaded and warm."
 *   Kubernetes readinessProbe with /health prevents premature traffic routing.
 * - Monitoring systems use health endpoints to detect degradation:
 *   if inference starts timing out, the health endpoint can return 503
 *   and trigger automatic instance replacement.
 *
 * Required: GET /health or /healthz returning 200 + {"status": "ok"}.
 * Enhanced: returns model version, last prediction time, and latency p99.
 *
 * Escape hatch: add "healthCheckExternal": true to serving-spec.json if
 * health checking is handled by a sidecar proxy (e.g., Envoy, Istio).
 */

const HEALTH_ROUTE_PATTERNS = [
  /@app\.(?:get|route)\s*\(\s*['"`]\/health(?:z)?\b/,
  /router\.(?:get|add_api_route)\s*\(\s*['"`]\/health(?:z)?\b/,
  /app\.add_url_rule\s*\(\s*['"`]\/health(?:z)?\b/,
  /Blueprint.*health|health.*Blueprint/i,
  /path\s*=\s*['"`]\/health(?:z)?['"`]/,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'serving-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'SA003', message: 'serving-spec.json not readable' }; }

  if (spec.healthCheckExternal === true) {
    return { pass: true, code: 'SA003', message: 'Health check handled by external proxy', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SA003', message: 'No Python files — health endpoint check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasHealth = HEALTH_ROUTE_PATTERNS.some(p => p.test(content));

  if (!hasHealth) {
    return {
      pass: false, code: 'SA003',
      message: 'No /health or /healthz endpoint found',
      detail: 'Add a health endpoint:\n\n' +
        '  @app.get("/health")\n' +
        '  def health():\n' +
        '      if model is None:\n' +
        '          raise HTTPException(status_code=503, detail="Model not loaded")\n' +
        '      return {\n' +
        '          "status": "ok",\n' +
        '          "model_version": MODEL_VERSION,\n' +
        '          "model_loaded": model is not None,\n' +
        '      }\n\n' +
        'Configure in Kubernetes:\n' +
        '  readinessProbe:\n' +
        '    httpGet:\n' +
        '      path: /health\n' +
        '      port: 8080\n' +
        '    initialDelaySeconds: 10',
    };
  }

  return { pass: true, code: 'SA003', message: 'Health endpoint (/health or /healthz) defined' };
}
