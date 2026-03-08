# Data Pipeline Script Compiler — Implementation Guide

## Purpose
Build an end-to-end data processing pipeline that is idempotent, observable, and schema-validated.

## Required Output Files
- `pipeline-spec.json` — pipeline configuration
- `pipeline.py` — main pipeline script

## pipeline-spec.json Structure
```json
{
  "pipeline_name": "feature_engineering",
  "input_path": "data/interim/events.parquet",
  "output_path": "data/processed/features.parquet",
  "steps": ["clean", "enrich", "aggregate"]
}
```

## pipeline.py Pattern
```python
import logging
from pathlib import Path
import pandera as pa
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_pipeline(input_path: Path, output_path: Path) -> None:
    logger.info("Loading input data")
    df = pd.read_parquet(input_path)
    input_schema.validate(df)  # validate at boundary

    df = clean(df)
    df = enrich(df)
    df = aggregate(df)

    output_schema.validate(df)  # validate at output boundary
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path)
    logger.info(f"Pipeline complete: {len(df)} rows written")

if __name__ == "__main__":
    run_pipeline(Path("data/interim/events.parquet"), Path("data/processed/features.parquet"))
```

## Anti-Patterns
- No schema validation at pipeline boundaries
- Bare `except:` blocks that hide errors
- Writing with `open(f, 'a')` (non-idempotent)
- Hardcoded absolute paths
