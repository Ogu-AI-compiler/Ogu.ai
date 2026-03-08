---
name: data-pipeline-script
description: Compiler skill for the data-pipeline-script compiler. Activates when producing pipeline-artifact.json. Gates: DP001–DP010. Hard-fails when spec missing.
---

# data-pipeline-script — Compiler Skill

## What This Compiler Does

Compiles data pipeline scripts — validates spec structure, enforces pathlib for path handling, requires idempotent output writes (no append mode), requires `if __name__ == "__main__"` guard, enforces structured logging over `print()`, blocks in-place DataFrame mutations, requires proper error handling, requires schema validation at both input and output boundaries, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `pipeline-artifact.json`
**IR identifier:** `DATA_PIPELINE:{project}`

---

## Spec Shape

```json
{
  "pipeline_name": "customer-feature-pipeline",
  "stages": ["ingest", "clean", "transform", "validate"],
  "input_format": "parquet",
  "output_format": "parquet"
}
```

Required fields:
- `pipeline_name` — string
- `stages` — non-empty array
- `input_format` — string
- `output_format` — string

---

## Gates

### DP001 — spec-valid
Reads `pipeline-spec.json`. Hard-fails if missing. Required: `pipeline_name`, `stages` (non-empty array), `input_format`, `output_format`.

BAD: `pipeline-spec.json` missing or `stages` is empty.
GOOD: all four fields present.

### DP002 — pathlib-paths
Requires `from pathlib import Path` or `import os`. Blocks hardcoded absolute paths: `/home/`, `/root/`, `/Users/`, `C:\`.

BAD:
```python
df = pd.read_parquet("/home/user/data/raw.parquet")
```
GOOD:
```python
from pathlib import Path
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
df = pd.read_parquet(RAW_DIR / "customers.parquet")
```
Escape: `# @absolute-path-ok`.

### DP003 — idempotent-pipeline
Blocks append-mode writes: `open(path, "a")`, `to_csv(mode="a")`, `.append(ignore_index=True)`. Pipeline reruns must overwrite, not accumulate.

BAD:
```python
df.to_csv("output.csv", mode="a", header=False)
```
GOOD:
```python
df.to_parquet("output.parquet")        # overwrites
df.to_sql("table", if_exists="replace") # overwrites
```
Escape: `# @append-pipeline-ok`.

### DP004 — main-guard (labeled DP003 in code)
Requires `if __name__ == "__main__"`. Pipeline scripts must not execute at import time.

BAD:
```python
run_pipeline()  # top-level call — runs on import
```
GOOD:
```python
if __name__ == "__main__":
    run_pipeline(load_config())
```
Escape: `# @no-main-guard-ok`.

### DP005 — logging-not-print (labeled DP004 in code)
Requires `import logging` or `getLogger`. Bare `print()` calls outside the main guard are violations.

BAD:
```python
print(f"Stage complete: {stage}")
```
GOOD:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Stage complete: %s", stage)
```
Escape: `# @print-ok`.

### DP006 — no-raw-mutation (labeled DP005 in code)
Blocks `inplace=True` on: `fillna`, `drop`, `dropna`, `rename`, `reset_index`, `sort_values`.

BAD:
```python
df.dropna(inplace=True)
df.rename(columns={"old": "new"}, inplace=True)
```
GOOD:
```python
df = df.dropna()
df = df.rename(columns={"old": "new"})
```
Escape: `# @raw-mutation-ok`.

### DP007 — error-handling (labeled DP006 in code)
Blocks bare `except: pass` and `except Exception: continue`. All caught exceptions must either call `logger.error/exception/critical` or `raise` or `sys.exit`.

BAD:
```python
try:
    process(df)
except:
    pass  # silently swallows errors
```
GOOD:
```python
try:
    process(df)
except ValueError as e:
    logger.exception("Processing failed: %s", e)
    raise
```
Escape: `# @silent-error-ok`.

### DP008 — schema-boundary-check (labeled DP007 in code)
Schema validation must occur at BOTH input boundary (before transform) AND output boundary (after transform). Must use `schema.validate(df)`, `output_schema.validate(...)`, or assert on shape/columns.

BAD:
```python
df = pd.read_parquet("input.parquet")
# process...
df.to_parquet("output.parquet")  # no validation at either boundary
```
GOOD:
```python
input_schema.validate(df)           # input boundary
df = transform(df)
output_schema.validate(df)          # output boundary
df.to_parquet("output.parquet")
```
Escape: `outputSchemaExternal: true` in spec (skips output schema check only).

### DP009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### DP010 — contract-pipeline
Final contract check (RULES array — no escape hatch):
- `from pathlib import Path` or `pathlib` imported
- `import logging` / `getLogger` present
- Schema validation present (`pandera`, `great_expectations`, `.validate(`)
- `if __name__ == "__main__"` guard present

---

## What This Compiler Never Forgives

- `pipeline-spec.json` missing (DP001 hard-fails)
- `pipeline_name`, `stages`, `input_format`, or `output_format` missing (DP001)
- `stages` is empty array (DP001)
- Hardcoded absolute paths (DP002)
- Append-mode output writes — non-idempotent (DP003)
- Top-level pipeline execution without main guard (DP004)
- `print()` instead of `logger.*` (DP005)
- `inplace=True` on DataFrame operations (DP006)
- Bare `except: pass` or `except Exception: continue` (DP007)
- Missing schema validation at input or output boundary (DP008)
- TODO/FIXME/HACK/XXX anywhere (DP009)
- Contract violations: no pathlib, no logging, no schema validation, no main guard (DP010)
