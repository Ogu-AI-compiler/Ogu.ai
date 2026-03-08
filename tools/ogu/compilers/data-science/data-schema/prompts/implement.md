# Data Schema Compiler — Implementation Guide

## Purpose
Define a typed, versioned schema contract for a dataset before any ingestion, validation, or modeling.

## Required Output Files
- `data-schema-spec.json` — machine-readable schema spec
- `schema.py` — pandera DataFrameSchema definition (optional but recommended)

## data-schema-spec.json Structure
```json
{
  "dataset": "user_events",
  "version": "1.0.0",
  "description": "User interaction events from the web app",
  "primary_key": "event_id",
  "columns": [
    { "name": "event_id", "dtype": "string", "primary_key": true, "nullable": false },
    { "name": "user_id", "dtype": "int64", "nullable": false },
    { "name": "event_type", "dtype": "category", "allowed_values": ["click", "view", "purchase"] },
    { "name": "timestamp", "dtype": "datetime64", "nullable": false },
    { "name": "amount", "dtype": "float64", "min": 0.0, "max": 100000.0, "nullable": true, "null_strategy": "expected for non-purchase events" },
    { "name": "email", "dtype": "string", "pii": true, "masking": "hash_sha256" }
  ]
}
```

## Anti-Patterns
- Using `object` dtype without justification
- Nullable columns without `null_strategy` explanation
- Missing `primary_key` declaration
- PII columns (email, ssn, phone, dob) without `pii: true` and `masking`
- Numeric columns without `min`/`max` range constraints
