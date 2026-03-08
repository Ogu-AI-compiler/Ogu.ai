# Data Validation Module Compiler — Implementation Guide

## Purpose
Build a validation module that checks dataset quality using pandera or Great Expectations, raising on failures.

## Required Output Files
- `validation-spec.json` — lists critical columns and validation library
- `validate.py` — validation module

## validation-spec.json Structure
```json
{
  "dataset": "user_events",
  "critical_columns": ["user_id", "event_type", "timestamp"],
  "library": "pandera"
}
```

## validate.py Pattern (pandera)
```python
import pandera as pa
import pandas as pd

schema = pa.DataFrameSchema({
    "user_id": pa.Column(int, nullable=False),
    "event_type": pa.Column(str, pa.Check.isin(["click", "view", "purchase"])),
    "timestamp": pa.Column(pa.DateTime),
})

def validate(df: pd.DataFrame) -> pd.DataFrame:
    return schema.validate(df)  # raises SchemaError on failure
```

## Anti-Patterns
- `except SchemaError: pass` — silently swallowing failures
- Not covering all `critical_columns` from spec
- No report generation for visibility
