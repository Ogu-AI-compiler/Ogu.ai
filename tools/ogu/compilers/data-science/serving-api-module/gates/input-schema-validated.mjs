import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SA001 — input-schema-validated
 * ML serving APIs must validate input data against a schema before inference.
 *
 * Why:
 * - Models are brittle: they silently accept malformed inputs and produce
 *   nonsensical predictions. A missing feature returns NaN, which propagates
 *   through the model and produces a confident but wrong prediction.
 * - Production model failures are almost always caused by input drift:
 *   a feature that was always present during training becomes optional,
 *   a numeric field starts receiving strings, a categorical value appears
 *   that was never in training. Schema validation catches these at the boundary.
 * - Without input validation, debugging production failures requires
 *   checking model internals. With validation, the error message is:
 *   "field 'age' required, got null" — immediately actionable.
 *
 * Supported validation frameworks:
 * - Pydantic BaseModel (most common for FastAPI)
 * - marshmallow Schema
 * - jsonschema validate()
 * - voluptuous Schema
 * - pandera DataFrameSchema (for batch endpoints)
 *
 * Escape hatch: # @no-validation-ok: <reason> at module level, or
 * add "inputValidationExternal": true to serving-spec.json if validation
 * is performed by an API gateway upstream.
 */

const VALIDATION_PATTERNS = [
  /class\s+\w+\s*\(\s*BaseModel\s*\)/,        // pydantic
  /class\s+\w+\s*\(\s*Schema\s*\)/,            // marshmallow
  /jsonschema\s*\.\s*validate\s*\(/,
  /pa\s*\.\s*DataFrameSchema\s*\(/,             // pandera
  /Schema\s*\(\s*{/,                            // voluptuous
  /request\.get_json\s*\([^)]*\)\s*\n.*validate/s,
  /@app\.route.*\n.*def.*:\n.*schema/is,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'serving-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'SA001', message: 'serving-spec.json not readable' }; }

  if (spec.inputValidationExternal === true) {
    return { pass: true, code: 'SA001', message: 'Input validation handled by API gateway (external)', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SA001', message: 'No Python files — input validation check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-validation-ok/.test(content)) {
    return { pass: true, code: 'SA001', message: 'Input validation skipped via @no-validation-ok', skipped: true };
  }

  const hasValidation = VALIDATION_PATTERNS.some(p => p.test(content));

  if (!hasValidation) {
    return {
      pass: false, code: 'SA001',
      message: 'No input schema validation found in serving API',
      detail: 'Add Pydantic validation (recommended for FastAPI):\n\n' +
        '  from pydantic import BaseModel, Field\n' +
        '  from typing import List\n\n' +
        '  class PredictRequest(BaseModel):\n' +
        '      age: float = Field(..., ge=0, le=120)\n' +
        '      income: float = Field(..., ge=0)\n' +
        '      category: str\n\n' +
        '  @app.post("/predict")\n' +
        '  def predict(req: PredictRequest):\n' +
        '      features = [[req.age, req.income]]\n' +
        '      return {"prediction": model.predict(features)[0]}',
    };
  }

  return { pass: true, code: 'SA001', message: 'Input schema validated before inference' };
}
