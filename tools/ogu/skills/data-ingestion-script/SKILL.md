---
name: data-ingestion-script
description: Compiler skill for the data-ingestion-script compiler. Activates when producing data-ingestion-artifact.json. Gates: DI001–DI009. Hard-fails when spec missing.
---

# data-ingestion-script — Compiler Skill

## What This Compiler Does

Compiles data ingestion scripts — validates spec structure, enforces `pathlib` for path handling (no hardcoded absolute paths), requires a `main` guard, enforces structured logging over `print()`, blocks in-place DataFrame mutations, blocks append-mode file writes (idempotency), and requires schema validation at data load time.

**Upstream dependency:** none
**Output artifact:** `data-ingestion-artifact.json`
**IR identifier:** `DATA_INGESTION:{project}`

---

## Spec Shape

```json
{
  "source": "s3://data-bucket/raw/customers.parquet",
  "output_path": "data/processed/customers_clean.parquet",
  "format": "parquet",
  "schema_file": "schemas/customer_schema.json"
}
```

Required fields:
- `source` — string (data source URI or path)
- `output_path` — string (destination path)
- `format` — string (parquet, csv, json, etc.)

---

## Gates

### DI001 — spec-valid
Reads `ingestion-spec.json`. Hard-fails if missing. Required: `source`, `output_path`, `format`.

BAD: `ingestion-spec.json` missing or any required field absent.
GOOD: all three fields present and non-empty strings.

### DI002 — pathlib-paths
Requires `from pathlib import Path` or `import os`. Blocks hardcoded absolute paths: `/home/`, `/root/`, `/Users/`, `C:\`.

BAD:
```python
df = pd.read_csv("/home/user/data/raw.csv")
```
GOOD:
```python
from pathlib import Path
DATA_DIR = Path(__file__).parent / "data"
df = pd.read_csv(DATA_DIR / "raw.csv")
```
Escape: `# @absolute-path-ok` on the specific line.

### DI003 — main-guard
Requires `if __name__ == "__main__"`. Top-level ingestion execution without a main guard triggers when the module is imported.

BAD:
```python
df = ingest_data()  # runs at import time
df.to_parquet("output.parquet")
```
GOOD:
```python
def ingest(config): ...

if __name__ == "__main__":
    config = load_config()
    ingest(config)
```
Escape: `# @no-main-guard-ok`.

### DI004 — logging-not-print
Requires `import logging` and `getLogger`. Bare `print()` calls outside the main guard are violations.

BAD:
```python
print(f"Loaded {len(df)} rows")
```
GOOD:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Loaded %d rows", len(df))
```
Escape: `# @print-ok` on the specific line.

### DI005 — no-raw-mutation
Blocks `inplace=True` on DataFrame operations: `fillna`, `drop`, `dropna`, `rename`, `reset_index`, `sort_values`.

BAD:
```python
df.fillna(0, inplace=True)
df.drop(columns=["tmp"], inplace=True)
```
GOOD:
```python
df = df.fillna(0)
df = df.drop(columns=["tmp"])
```
Escape: `# @raw-mutation-ok`.

### DI006 — no-append-mode
Blocks append-mode file writes: `open(path, "a")`, `to_csv(mode="a")`, `.append(ignore_index=True)`. Ingestion pipelines must be idempotent — append mode creates duplicate data on reruns.

BAD:
```python
df.to_csv("output.csv", mode="a", header=False)
with open("log.txt", "a") as f: ...
```
GOOD:
```python
df.to_parquet("output.parquet")  # overwrites on rerun
df.to_csv("output.csv")          # overwrites header and data
```
Escape: `# @append-ok`.

### DI007 — schema-boundary-check
Requires schema validation at the data load boundary. Must call `.validate()`, use `pa.DataFrameSchema`, or use `great_expectations` at load time.

BAD:
```python
df = pd.read_parquet("raw.parquet")
# no validation — invalid data silently enters pipeline
```
GOOD:
```python
import pandera as pa
schema = pa.DataFrameSchema({"id": pa.Column(int), "age": pa.Column(float, pa.Check.ge(0))})
df = pd.read_parquet("raw.parquet")
schema.validate(df)
```
Escape: `outputSchemaExternal: true` in spec.

### DI008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` comments in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### DI009 — contract-ingestion
Final contract check (RULES array — no escape hatch):
- `from pathlib import Path` or `import os` present
- `import logging` / `getLogger` present
- Schema validation present (`pandera`, `great_expectations`, `.validate(`)
- `if __name__ == "__main__"` guard present

---

## What This Compiler Never Forgives

- `ingestion-spec.json` missing (DI001 hard-fails)
- `source`, `output_path`, or `format` missing (DI001)
- Hardcoded absolute paths (`/home/`, `/root/`, `/Users/`, `C:\`) (DI002)
- No `pathlib` or `os` import (DI002)
- Top-level execution without `if __name__ == "__main__"` (DI003)
- `print()` instead of `logger.*` (DI004)
- `inplace=True` on any DataFrame operation (DI005)
- `open(path, "a")` or `to_csv(mode="a")` — non-idempotent append (DI006)
- No schema validation at load boundary (DI007)
- TODO/FIXME/HACK/XXX anywhere (DI008)
- Contract violations: no pathlib, no logging, no schema validation, no main guard (DI009)
