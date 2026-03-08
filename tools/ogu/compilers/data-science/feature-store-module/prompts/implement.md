# Feature Store Module Compiler — Implementation Guide

## Purpose
Register a versioned feature group with entity key, TTL, and type annotations to avoid training-serving skew.

## Required Output Files
- `feature-store-spec.json` — feature group specification
- `register_features.py` — feature group registration code

## feature-store-spec.json Structure
```json
{
  "feature_group": "user_behavioral_features",
  "entity_key": "user_id",
  "version": 2,
  "store_type": "online",
  "ttl_days": 30,
  "features": [
    { "name": "days_since_last_login", "dtype": "int64" },
    { "name": "avg_session_duration_s", "dtype": "float64" },
    { "name": "preferred_category", "dtype": "string" }
  ]
}
```

## register_features.py Pattern (Hopsworks/Feast-style)
```python
from datetime import timedelta

VERSION = 2
FEATURE_GROUP = "user_behavioral_features"

def register(fs):
    fg = fs.get_or_create_feature_group(
        name=FEATURE_GROUP,
        version=VERSION,
        primary_key=["user_id"],
        online_enabled=True,
        feature_store_format="parquet",
    )
    fg.insert(compute_features())
```

## Anti-Patterns
- Applying StandardScaler both in training AND in the serving endpoint (skew!)
- No entity key — features become un-joinable
- No version — schema evolution breaks downstream models
- No TTL for online features — stale data silently used for inference
