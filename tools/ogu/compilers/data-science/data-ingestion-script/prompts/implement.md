# Data Ingestion Script Compiler — Implementation Guide

## Purpose
Build a robust, idempotent ingestion script that loads raw data and validates its schema.

## Required Output Files
- `ingestion-spec.json` — ingestion configuration
- `ingest.py` — main ingestion script

## ingestion-spec.json Structure
```json
{
  "source": "s3://my-bucket/raw/events/",
  "output_path": "data/interim/events.parquet",
  "format": "parquet",
  "schedule": "daily"
}
```

## ingest.py Pattern
```python
import logging
from pathlib import Path
import pandera as pa
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OUTPUT_PATH = Path("data/interim/events.parquet")

def load_data(source: str) -> pd.DataFrame:
    logger.info(f"Loading data from {source}")
    return pd.read_parquet(source)

def validate(df: pd.DataFrame) -> pd.DataFrame:
    schema = pa.DataFrameSchema({...})
    return schema.validate(df)

if __name__ == "__main__":
    df = load_data("s3://bucket/raw/")
    df = validate(df)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH)
    logger.info(f"Written {len(df)} rows to {OUTPUT_PATH}")
```

## Anti-Patterns
- Hardcoded `/home/user/` or `C:\Users\` paths
- Using `print()` instead of `logger.info()`
- Writing to the same file with `open(f, 'a')` (breaks idempotency)
- No schema validation at load time
- Missing `if __name__ == '__main__':` guard
