---
name: data-validation-module
description: Compiler skill for the data-validation-module compiler. Activates when producing validation-artifact.json. Gates: DV001–DV008. Hard-fails when spec missing.
---

# data-validation-module — Compiler Skill

## What This Compiler Does

Compiles data validation modules — validates spec structure and library declaration, requires validation expectations to be defined in code, requires critical columns to be covered by validation rules, blocks silent validation failures (bare `except` on schema errors), requires validation reports to be generated, and checks for the upstream `data-schema` artifact.

**Upstream dependency:** `data-schema` (checks `.ogu/artifacts/schema-ds-artifact.json`)
**Output artifact:** `validation-artifact.json`
**IR identifier:** `DATA_VALIDATION:{project}`

---

## Spec Shape

```json
{
  "dataset": "customer_transactions",
  "critical_columns": ["transaction_id", "amount", "customer_id"],
  "library": "pandera",
  "report_output": "reports/validation_report.html"
}
```

Required fields:
- `dataset` — string
- `critical_columns` — array of column name strings
- `library` — one of: `pandera`, `great_expectations`, `deepchecks`, `cerberus`, `voluptuous`

---

## Gates

### DV001 — spec-valid
Reads `validation-spec.json`. Hard-fails if missing. Required: `dataset`, `critical_columns` (array), `library` (must be one of the supported libraries).

BAD: `validation-spec.json` missing, or `library: "custom"` not in supported list.
GOOD:
```json
{ "dataset": "orders", "critical_columns": ["order_id", "amount"], "library": "pandera" }
```

### DV002 — expectations-defined
Validation expectations must be defined in Python code. Accepted patterns:
- `pa.DataFrameSchema(` — pandera schema
- `pa.Column(` — pandera column definition
- `pa.Check.` — pandera check
- `ExpectationSuite(` — great_expectations
- `expect_column_to_exist` — great_expectations expectation
- `great_expectations` import
- `.validate(df` — any `.validate()` call on a DataFrame

BAD:
```python
df = pd.read_parquet("data.parquet")
# no validation expectations defined
```
GOOD:
```python
import pandera as pa
schema = pa.DataFrameSchema({
    "order_id": pa.Column(int, pa.Check.gt(0)),
    "amount":   pa.Column(float, pa.Check.ge(0)),
})
schema.validate(df)
```
Escape: `expectationsExternal: true` in spec.

### DV003 — critical-columns-covered
Every column name in `spec.critical_columns` must appear (as a quoted string) in the Python validation code.

BAD:
```python
# spec declares critical_columns: ["amount", "customer_id"]
schema = pa.DataFrameSchema({"order_id": pa.Column(int)})
# "amount" and "customer_id" not in validation code
```
GOOD:
```python
schema = pa.DataFrameSchema({
    "amount":      pa.Column(float, pa.Check.ge(0)),
    "customer_id": pa.Column(str, pa.Check.str_startswith("C")),
})
```
Escape: `coverageByFramework: true` in spec (framework validates all columns automatically).

### DV004 — no-silent-failures
Bare `except SchemaError: pass`, `except ValidationError: pass`, `except SchemaError: continue`, `except ValidationError: continue` are blocked. Validation failures must raise or log.

BAD:
```python
try:
    schema.validate(df)
except pa.errors.SchemaError:
    pass  # silently ignores validation failure
```
GOOD:
```python
try:
    schema.validate(df)
except pa.errors.SchemaError as e:
    logger.critical("Schema validation failed: %s", e)
    raise
```
Escape: `# @validation-silent-ok`.

### DV005 — report-generated
Validation reports must be generated. Accepted patterns:
- `build_data_docs()` — great_expectations
- `.to_html(` — pandas/other HTML export
- `DataQualityReport` — evidently
- `evidently` import
- `whylogs` import
- Similar reporting libraries

BAD: validation runs but no report is generated or exported.
GOOD:
```python
import evidently
from evidently.report import Report
report = Report(metrics=[...])
report.run(reference_data=train_df, current_data=new_df)
report.save_html("reports/validation_report.html")
```
Escape: `reportsExternal: true` in spec.

### DV006 — cross-schema
Checks `.ogu/artifacts/schema-ds-artifact.json` exists and has `pass: true`. The upstream data-schema compiler must have passed before validation can run.

Gate is **skipped** (not failed) if the artifact file is not found (upstream not yet compiled).

### DV007 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### DV008 — contract-validation
Final contract check (RULES array — no escape hatch):
- `pa.DataFrameSchema` / `ExpectationSuite` / `SchemaModel` present in code
- `raise` or `logger.critical/error` present (failures are not silent)

---

## What This Compiler Never Forgives

- `validation-spec.json` missing (DV001 hard-fails)
- `dataset`, `critical_columns`, or `library` missing (DV001)
- `library` value not in supported set (DV001)
- No validation expectations defined in code (DV002)
- Critical column name not referenced in validation code (DV003)
- `except SchemaError/ValidationError: pass/continue` — silent failure (DV004)
- No validation report generated (DV005)
- Upstream schema artifact failed (DV006 — when artifact exists)
- TODO/FIXME/HACK/XXX anywhere (DV007)
- No DataFrameSchema/ExpectationSuite in code (DV008)
- Validation failures not raised or logged (DV008)
