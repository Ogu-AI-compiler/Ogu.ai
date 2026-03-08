# Serving API Module Compiler — Implementation Guide

## Purpose
Build a production-grade model serving API with input validation, health endpoint, and structured logging.

## Required Output Files
- `serving-spec.json` — API configuration
- `main.py` — FastAPI/Flask serving application

## serving-spec.json Structure
```json
{
  "endpoint": "/predict",
  "framework": "fastapi",
  "max_latency_ms": 200,
  "input_schema": { "features": "array of floats" },
  "output_schema": { "prediction": "int", "probability": "float" }
}
```

## main.py Pattern (FastAPI)
```python
import logging
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

model = None  # loaded at startup, NOT per-request

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = joblib.load("models/model.joblib")
    logger.info("Model loaded")
    yield

app = FastAPI(lifespan=lifespan)

class PredictRequest(BaseModel):
    features: list[float]

class PredictResponse(BaseModel):
    prediction: int
    probability: float

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        pred = model.predict([request.features])[0]
        prob = model.predict_proba([request.features])[0].max()
        return PredictResponse(prediction=int(pred), probability=float(prob))
    except Exception as e:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=str(e))
```

## Anti-Patterns
- Loading model inside the request handler (latency spike + race condition)
- No `/health` endpoint (breaks Kubernetes readiness probes)
- Bare `except:` blocks
- `print()` instead of `logger.info()`
- Returning bare dict without `response_model`
