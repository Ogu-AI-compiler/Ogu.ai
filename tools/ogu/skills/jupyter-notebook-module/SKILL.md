---
name: jupyter-notebook-module
description: Compiler skill for the jupyter-notebook-module compiler. Activates when producing notebook-artifact.json. Gates: JN001–JN009. Hard-fails when spec missing.
---

# jupyter-notebook-module — Compiler Skill

## What This Compiler Does

Compiles Jupyter notebook modules — validates spec structure, requires linear cell execution order, requires markdown documentation density (1 per 4 code cells + section headings), blocks large embedded outputs (images, long text), requires function extraction for large code blocks, blocks in-place DataFrame mutations, requires reproducible seeds for stochastic ops, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `notebook-artifact.json`
**IR identifier:** `JUPYTER_NOTEBOOK:{project}`

---

## Spec Shape

```json
{
  "notebook_name": "customer_churn_analysis",
  "purpose": "Feature engineering and EDA for churn prediction model",
  "sections": ["Data Loading", "EDA", "Feature Engineering", "Model Training"]
}
```

Required fields:
- `notebook_name` — string
- `purpose` — string
- `sections` — non-empty array of section names

---

## Gates

### JN001 — spec-valid
Reads `notebook-spec.json`. Hard-fails if missing. Required: `notebook_name`, `purpose`, `sections` (non-empty array).

BAD: spec missing or `sections: []`.
GOOD: all three fields present.

### JN002 — linear-execution
Notebook cell `execution_count` values must be monotonically non-decreasing. Gaps larger than 30% of the total execution count indicate non-linear execution (cells run out of order).

BAD: execution counts `[1, 2, 50, 3, 4]` — jumped to 50 then back to 3.
GOOD: execution counts `[1, 2, 3, 4, 5]` — strictly sequential.
GOOD: execution counts `[1, null, 3, 4]` — null cells (not yet run) are OK.
Escape: `nonLinearOk: true` in spec.

### JN003 — markdown-documentation
- At least 1 markdown cell per 4 code cells
- First cell must be a markdown heading
- At least 2 section headings (`##` level or higher) in the notebook

BAD: 20 consecutive code cells with no markdown cells.
BAD: first cell is a code cell.
GOOD:
```markdown
# Customer Churn Analysis

## Data Loading
[code cell]
[code cell]

## Exploratory Data Analysis
[code cell]
...
```
Escape: `markdownMinimal: true` in spec.

### JN004 — outputs-cleared
Notebooks must not contain:
- Embedded `image/png` or `image/jpeg` in cell outputs (regenerated on run)
- Text output exceeding 100 lines per cell

BAD: notebook with embedded base64 images in outputs.
BAD: a cell with 500 lines of printed output.
GOOD: outputs cleared before committing (`Cell → All Output → Clear`).
Escape: `outputsAllowed: true` in spec.

### JN005 — functions-extracted
Notebooks with more than 80 code lines must use `def` statements. Duplicate cell bodies (same logic copy-pasted) are flagged.

BAD:
```python
# Cell 1 — 90 lines of inline code with no functions
# Cell 2 — same 90 lines copy-pasted with minor changes
```
GOOD:
```python
def load_and_clean(path: str) -> pd.DataFrame:
    ...

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    ...
```
Escape: `largeBlocksOk: true` in spec.

### JN006 — no-global-mutations
In-place mutations on DataFrames in notebooks create hidden state. Blocked in notebook code cells: `.drop(inplace=True)`, `.fillna(inplace=True)`, `.rename(inplace=True)`, `.sort_values(inplace=True)`.

BAD:
```python
df.drop(columns=["id"], inplace=True)
df.fillna(0, inplace=True)
```
GOOD:
```python
df = df.drop(columns=["id"])
df = df.fillna(0)
```
Escape: `# @global-mutation-ok`.

### JN007 — reproducible
Stochastic operations in notebooks require seed setting:
- NumPy: `np.random.seed(N)` or `np.random.default_rng(N)`
- Python: `random.seed(N)`
- PyTorch: `torch.manual_seed(N)`
- sklearn: `random_state=N` parameter

Detected stochastic ops: `sample()`, `TSNE(`, `KMeans(`, `shuffle(`, `np.random.`.

BAD:
```python
sample = df.sample(1000)
tsne = TSNE(n_components=2)
```
GOOD:
```python
SEED = 42
sample = df.sample(1000, random_state=SEED)
tsne = TSNE(n_components=2, random_state=SEED)
```
Escape: `noSeedNeeded: true` in spec.

### JN008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### JN009 — contract-notebook
Final contract check (RULES array — no escape hatch):
- First cell of `.ipynb` is a markdown cell with a heading
- Cell execution counts are non-decreasing (linear execution)
- `def` statements present if notebook has >40 total code lines
- No empty code cells (all code cells have at least one non-whitespace source line)

---

## What This Compiler Never Forgives

- `notebook-spec.json` missing (JN001 hard-fails)
- `notebook_name`, `purpose`, or `sections` missing (JN001)
- `sections: []` empty (JN001)
- Non-monotonic execution counts with large gaps (JN002)
- Fewer than 1 markdown cell per 4 code cells (JN003)
- First cell is not a markdown heading (JN003, JN009)
- Fewer than 2 `##` section headings (JN003)
- Embedded base64 images in outputs (JN004)
- >100 lines of text output in a single cell (JN004)
- >80 code lines with no `def` statements (JN005)
- `inplace=True` mutations on DataFrames in notebook cells (JN006)
- Stochastic ops without random seed (JN007)
- TODO/FIXME/HACK/XXX anywhere (JN008)
- Empty code cells in notebook (JN009)
