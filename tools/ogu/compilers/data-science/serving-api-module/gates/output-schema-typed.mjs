import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SA002 — output-schema-typed
 * ML serving APIs must return typed, schema-validated responses, not raw model outputs.
 *
 * Why:
 * - Raw model output (numpy arrays, floats) is not a stable API contract.
 *   Clients depend on the response structure being consistent across model versions.
 * - Typed responses (Pydantic models, JSON schema) document the contract:
 *   "this endpoint always returns {prediction: float, confidence: float, model_version: str}."
 * - When a model update changes output format (e.g., adds a class, changes array shape),
 *   typed responses make the breaking change visible immediately. Without types,
 *   clients silently receive malformed responses and fail in mysterious ways.
 * - Output schema also prevents accidental leakage of internal model information:
 *   returning model weights, raw logits, or internal features that clients
 *   shouldn't see.
 *
 * Acceptable patterns:
 * - Pydantic response model in FastAPI
 * - TypedDict or dataclass for response structure
 * - JSON schema validation on response
 * - Explicit dict with documented fields
 *
 * Escape hatch: # @untyped-response-ok: <reason> for streaming endpoints
 * or endpoints returning binary data (images, files).
 */

const RESPONSE_MODEL_PATTERNS = [
  /class\s+\w*Response\w*\s*\(\s*BaseModel\s*\)/,   // pydantic response model
  /class\s+\w*Output\w*\s*\(\s*BaseModel\s*\)/,
  /class\s+\w*Prediction\w*\s*\(\s*BaseModel\s*\)/,
  /response_model\s*=\s*\w/,                          // FastAPI response_model param
  /TypedDict/,
  /@dataclass.*\n.*prediction/is,
  /jsonschema\.validate\s*\([^)]*response/,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'serving-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'SA002', message: 'serving-spec.json not readable' }; }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SA002', message: 'No Python files — output schema check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@untyped-response-ok/.test(content)) {
    return { pass: true, code: 'SA002', message: '@untyped-response-ok — untyped response intentional', skipped: true };
  }

  const hasResponseSchema = RESPONSE_MODEL_PATTERNS.some(p => p.test(content));

  if (!hasResponseSchema) {
    return {
      pass: false, code: 'SA002',
      message: 'No typed response schema found in serving API',
      detail: 'Define a typed response model:\n\n' +
        '  from pydantic import BaseModel\n' +
        '  from typing import Optional\n\n' +
        '  class PredictResponse(BaseModel):\n' +
        '      prediction: float\n' +
        '      confidence: Optional[float] = None\n' +
        '      model_version: str\n' +
        '      feature_count: int\n\n' +
        '  @app.post("/predict", response_model=PredictResponse)\n' +
        '  def predict(req: PredictRequest) -> PredictResponse:\n' +
        '      pred = model.predict([[req.age, req.income]])[0]\n' +
        '      return PredictResponse(\n' +
        '          prediction=float(pred),\n' +
        '          model_version=MODEL_VERSION,\n' +
        '          feature_count=len(req.dict()),\n' +
        '      )',
    };
  }

  return { pass: true, code: 'SA002', message: 'Output response schema typed and validated' };
}
