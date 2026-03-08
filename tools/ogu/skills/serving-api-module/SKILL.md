---
name: serving-api-module
description: Compiler skill for the serving-api-module compiler. Activates when producing serving-artifact.json. Gates: SA001–SA010. Hard-fails when spec missing.
---

# serving-api-module — Compiler Skill

## What This Compiler Does

Compiles ML model serving APIs — validates spec structure (endpoint, framework, latency SLO, input/output schema declarations), requires input schema validation (Pydantic/marshmallow), requires typed output response models, requires `/health` or `/healthz` endpoint, validates latency SLO declaration, requires structured logging, blocks bare `except:` clauses, and blocks loading the model inside request handlers.

**Upstream dependency:** none
**Output artifact:** `serving-artifact.json`
**IR identifier:** `SERVING_API:{project}`

---

## Spec Shape

```json
{
  "endpoint": "/predict",
  "framework": "fastapi",
  "max_latency_ms": 100,
  "latency_slo_ms": 100,
  "latency_percentile": "p99",
  "input_schema": { "age": "float", "income": "float", "category": "str" },
  "output_schema": { "prediction": "float", "confidence": "float", "model_version": "str" }
}
```

Required fields:
- `endpoint` — string
- `framework` — string
- `max_latency_ms` — positive number
- `input_schema` — object
- `output_schema` — object

---

## Gates

### SA001 — spec-valid
Reads `serving-spec.json`. Hard-fails if missing. Required: `endpoint`, `framework`, `max_latency_ms` (positive number), `input_schema`, `output_schema`.

BAD: spec missing or `max_latency_ms: 0` or non-numeric.
GOOD: all five fields present with positive numeric latency.

### SA002 — input-schema-validated (labeled SA001 in code)
Input schema validation must be present in Python code before inference. Accepted:
- `class \w+(BaseModel)` — Pydantic model
- `class \w+(Schema)` — marshmallow schema
- `jsonschema.validate(`
- `pa.DataFrameSchema(` — pandera (batch endpoints)
- `Schema({` — voluptuous

BAD:
```python
@app.post("/predict")
def predict(request: dict):  # raw dict — no validation
    pred = model.predict([[request["age"]]])
```
GOOD:
```python
from pydantic import BaseModel, Field
class PredictRequest(BaseModel):
    age:    float = Field(..., ge=0, le=120)
    income: float = Field(..., ge=0)

@app.post("/predict")
def predict(req: PredictRequest):
    return {"prediction": model.predict([[req.age, req.income]])[0]}
```
Escape: `inputValidationExternal: true` in spec (API gateway validates upstream).
Escape: `# @no-validation-ok`.

### SA003 — output-schema-typed (labeled SA002 in code)
API responses must be typed. Accepted:
- `class \w*Response\w*(BaseModel)` — Pydantic response model
- `class \w*Output\w*(BaseModel)` — Pydantic output
- `class \w*Prediction\w*(BaseModel)` — Pydantic prediction
- `response_model=\w` — FastAPI `response_model` parameter
- `TypedDict`
- `@dataclass` with prediction field

BAD:
```python
return {"prediction": float(pred)}  # raw dict — no typed contract
```
GOOD:
```python
class PredictResponse(BaseModel):
    prediction:    float
    confidence:    Optional[float] = None
    model_version: str

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    return PredictResponse(prediction=float(pred), model_version=MODEL_VERSION)
```
Escape: `# @untyped-response-ok: <reason>` (streaming or binary data endpoints).

### SA004 — health-endpoint (labeled SA003 in code)
A `/health` or `/healthz` endpoint must be declared.

BAD: no health route — load balancer has no way to verify readiness.
GOOD:
```python
@app.get("/health")
def health():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "ok", "model_version": MODEL_VERSION, "model_loaded": True}
```
Escape: `healthCheckExternal: true` in spec (Envoy/Istio sidecar handles it).

### SA005 — latency-contract (labeled SA007 in code)
Spec must declare `latency_slo_ms` (positive number). Optional `latency_percentile` (defaults to `p99`). Value must be ≥1ms (< 1ms = misconfiguration).

BAD: no `latency_slo_ms` in spec.
BAD: `latency_slo_ms: 0` or `latency_slo_ms: "fast"`.
GOOD:
```json
{ "latency_slo_ms": 100, "latency_percentile": "p99" }
```
Escape: `noLatencySLO: true` + `latency_slo_note` in spec (batch-only pipelines).

### SA006 — logging-not-print (labeled SA006 in code)
Serving API must use structured logging (`import logging` / `getLogger` / `import structlog`). Bare `print()` calls are violations.

BAD:
```python
print(f"Prediction: {pred}, latency: {elapsed_ms}ms")
```
GOOD:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Prediction request", extra={"latency_ms": elapsed_ms, "model_v": MODEL_VERSION})
```
Escape: `# @print-ok: <reason>`.

### SA007 — error-handling (labeled SA006 in code)
Bare `except:` blocks are blocked. Must catch specific exception types. `except Exception as e: raise HTTPException(...)` is acceptable.

BAD:
```python
try:
    pred = model.predict(X)
except:
    return {"error": "failed"}  # swallows SystemExit, OOM, etc.
```
GOOD:
```python
try:
    pred = model.predict(X)
except ValueError as e:
    raise HTTPException(status_code=422, detail=str(e))
except Exception as e:
    logger.exception("Inference failed")
    raise HTTPException(status_code=500, detail="Internal error")
```
Escape: `# @bare-except-ok: <reason>`.

### SA008 — model-loaded-once (labeled SA005 in code)
Model must NOT be loaded inside request handler functions. Detects `joblib.load`, `pickle.load`, `mlflow.*.load_model`, `torch.load`, `keras.models.load_model`, `onnxruntime.InferenceSession(` inside request handler body.

BAD:
```python
@app.post("/predict")
def predict(req: PredictRequest):
    model = joblib.load("models/model.joblib")  # loaded on every request!
    return {"prediction": model.predict([[req.age]])[0]}
```
GOOD:
```python
# Module level — loaded once at startup
MODEL = joblib.load("models/model.joblib")

@app.post("/predict")
def predict(req: PredictRequest):
    return {"prediction": MODEL.predict([[req.age]])[0]}
```
Escape: `# @load-per-request-ok: <reason>` (A/B testing with dynamic model selection).

### SA009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### SA010 — contract-serving
Final contract check (RULES array — no escape hatch):
- `BaseModel` / Pydantic / `from pydantic` / `from marshmallow` / `Schema(` present
- `/health` or `/ping` or `/healthz` route present
- `import logging` / `from logging import` / `getLogger` present
- No bare `except:` blocks (`^\s*except\s*:` pattern)

---

## What This Compiler Never Forgives

- `serving-spec.json` missing (SA001 hard-fails)
- `endpoint`, `framework`, `max_latency_ms`, `input_schema`, or `output_schema` missing (SA001)
- `max_latency_ms` not a positive number (SA001)
- No Pydantic/marshmallow/jsonschema input validation (SA002)
- No typed response model on endpoints (SA003)
- No `/health` or `/healthz` endpoint (SA004)
- No `latency_slo_ms` in spec (SA005)
- `latency_slo_ms < 1` (misconfiguration) (SA005)
- `print()` instead of `logger.*` (SA006)
- Bare `except:` block (SA007)
- Model loaded inside request handler function (SA008)
- TODO/FIXME/HACK/XXX anywhere (SA009)
- Contract violations: no Pydantic, no health endpoint, no logging, bare except (SA010)
