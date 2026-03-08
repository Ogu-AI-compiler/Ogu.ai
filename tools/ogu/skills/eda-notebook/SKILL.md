---
name: eda-notebook
description: Compiler skill for the eda-notebook compiler. Activates when producing eda-artifact.json. Gates: EN001–EN010. Hard-fails when spec missing.
---

# eda-notebook — Compiler Skill

## What This Compiler Does

Compiles EDA (Exploratory Data Analysis) notebooks — validates spec structure, requires five canonical sections (Data Overview, Missing Values, Distributions, Correlations, Key Findings), requires missing value analysis + imputation plan, requires distribution plots + skewness/IQR, requires correlation analysis vs target, blocks in-place DataFrame mutations, requires reproducible stochastic ops, and validates substantive Key Findings with specific data references.

**Upstream dependency:** none
**Output artifact:** `eda-artifact.json`
**IR identifier:** `EDA_NOTEBOOK:{project}`

---

## Spec Shape

```json
{
  "dataset": "customer_churn",
  "target_variable": "churned",
  "analysis_goals": [
    "Identify features most correlated with churn",
    "Detect missing value patterns",
    "Assess class imbalance"
  ]
}
```

Required fields:
- `dataset` — string
- `target_variable` — string
- `analysis_goals` — non-empty array of strings

---

## Gates

### EN001 — spec-valid
Reads `eda-spec.json`. Hard-fails if missing. Required: `dataset`, `target_variable`, `analysis_goals` (non-empty array).

BAD: `analysis_goals: []` or any required field absent.
GOOD: all three fields present with at least one analysis goal.

### EN002 — notebook-sections
Five sections must appear in `.ipynb` markdown cells, `.py` comments/docstrings, or `.md` files:
1. **Data Overview** (or "Dataset Overview")
2. **Missing Values** (or "Missing Data")
3. **Distributions** (or "Distribution Analysis")
4. **Correlations** (or "Correlation Analysis")
5. **Key Findings** (or "Conclusions", "Summary", "Insights")

BAD: notebook jumps straight to modeling without these sections.
GOOD:
```markdown
## Data Overview
## Missing Values Analysis
## Feature Distributions
## Correlations
## Key Findings
```
Escape: `skipSections: ["Correlations"]` in spec (list sections to skip).

### EN003 — missing-value-analysis
Must have BOTH:
1. Missing value detection: `isnull().sum()` or `msno.` (missingno library)
2. Missing value treatment: `fillna`, `dropna`, or `SimpleImputer`

BAD: only `df.isnull().sum()` without any treatment plan.
GOOD:
```python
print(df.isnull().sum())
msno.matrix(df)
df["age"] = df["age"].fillna(df["age"].median())
```
Escape: `noMissingValues: true` in spec.

### EN004 — distribution-analysis
Must have BOTH:
1. Plot: `.hist()`, `sns.histplot`, `sns.boxplot`, `plt.hist`, or `value_counts()`
2. Statistics: `.skew()`, `.describe()`, or IQR calculation (`quantile`)

BAD: only histograms without skewness or descriptive stats.
GOOD:
```python
df.hist(figsize=(12, 8))
print(df.skew())
print(df.describe())
Q1 = df["price"].quantile(0.25)
Q3 = df["price"].quantile(0.75)
IQR = Q3 - Q1
```
Escape: `skipDistributions: true` in spec.

### EN005 — correlation-analysis
Must have BOTH:
1. Correlation matrix: `.corr()` or `sns.heatmap`
2. Target correlation: `df.corr()["target"]`, `.corrwith()`, or `mutual_info`

BAD: only `df.corr()` without extracting target correlations.
GOOD:
```python
corr_matrix = df.corr()
sns.heatmap(corr_matrix, annot=True)
target_corr = df.corr()["churned"].sort_values(ascending=False)
print(target_corr)
```
Escape: `skipCorrelations: true` in spec.

### EN006 — no-raw-mutation
Blocks `inplace=True` on `df`/`data`/`raw_df` DataFrames without an explicit `.copy()` call. Mutating raw data in EDA makes the notebook non-reproducible.

BAD:
```python
df.fillna(0, inplace=True)
df.drop(columns=["id"], inplace=True)
```
GOOD:
```python
df_clean = df.copy()
df_clean = df_clean.fillna(0)
df_clean = df_clean.drop(columns=["id"])
```
Escape: `# @raw-mutation-ok`.

### EN007 — reproducible
Stochastic operations (`sample`, `TSNE`, `KMeans`, `shuffle`) require seed setting: `np.random.seed()` or `RANDOM_STATE = 42` constant.

BAD:
```python
sample_df = df.sample(1000)              # no seed
tsne = TSNE(n_components=2)              # no random_state
```
GOOD:
```python
RANDOM_STATE = 42
sample_df = df.sample(1000, random_state=RANDOM_STATE)
tsne = TSNE(n_components=2, random_state=RANDOM_STATE)
```
Escape: `noSeedNeeded: true` in spec.

### EN008 — findings-documented
`## Key Findings` section (or Conclusions/Summary/Insights) must contain:
1. At least 2 substantive bullet points
2. Each bullet must contain specific references: numbers, percentages, or column names

BAD:
```markdown
## Key Findings
- The data has some missing values
- Some features are correlated
```
GOOD:
```markdown
## Key Findings
- **churned** is the target (26.3% positive rate — class imbalance detected)
- `tenure_months` has the strongest negative correlation with churn (r=−0.47)
- 18% of `monthly_charges` values are missing — median imputation applied
- Next steps: feature engineering on tenure × contract_type interaction
```

Escape: `findingsInDocs: true` in spec.

### EN009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### EN010 — contract-eda
Final contract check (RULES array — no escape hatch):
- `isnull()/isna()/info()/missingno` present (missing value analysis)
- `.hist()/boxplot()/value_counts()/sns.hist` present (distribution plots)
- `.corr()/sns.heatmap/pairplot` present (correlation analysis)
- No `to_csv.*raw/` writes (must not overwrite raw data in EDA)

---

## What This Compiler Never Forgives

- `eda-spec.json` missing (EN001 hard-fails)
- `dataset`, `target_variable`, or `analysis_goals` missing (EN001)
- `analysis_goals: []` empty array (EN001)
- Missing any of the 5 required sections (EN002)
- Missing value detection without treatment plan (EN003)
- Distribution plots without skewness/describe stats (EN004)
- Correlation matrix without target correlation analysis (EN005)
- `inplace=True` on raw DataFrame (EN006)
- Stochastic ops without random seed (EN007)
- Key Findings with generic bullets (no numbers/percentages/column names) (EN008)
- TODO/FIXME/HACK/XXX anywhere (EN009)
- Writing to `raw/` directory or missing correlation/distribution/missing analysis (EN010)
