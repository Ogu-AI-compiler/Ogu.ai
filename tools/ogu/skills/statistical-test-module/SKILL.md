---
name: statistical-test-module
description: Compiler skill for the statistical-test-module compiler. Activates when producing statistical-test-artifact.json. Gates: ST001–ST010. Hard-fails when spec missing.
---

# statistical-test-module — Compiler Skill

## What This Compiler Does

Compiles statistical testing modules — validates spec structure (hypothesis statements, alpha level, test type), requires hypotheses to be explicitly stated in code or documentation, requires test selection to be justified with assumption checks (normality, variance homogeneity), requires adequate sample size, requires effect size reporting alongside p-values, requires confidence intervals, requires multiple-testing correction when running multiple tests, and blocks reporting p-values without context.

**Upstream dependency:** none
**Output artifact:** `statistical-test-artifact.json`
**IR identifier:** `STATISTICAL_TEST:{project}`

---

## Spec Shape

**`statistical-test-spec.json`** (used by ST001 — spec-valid):
```json
{
  "hypothesis_h0": "There is no difference in conversion rate between groups A and B",
  "hypothesis_h1": "Group B has a higher conversion rate than group A",
  "alpha": 0.05,
  "test_type": "two-sample t-test"
}
```

Required fields:
- `hypothesis_h0` — string (null hypothesis)
- `hypothesis_h1` — string (alternative hypothesis)
- `alpha` — number between 0 and 1 (exclusive)
- `test_type` — string

**`stat-test-spec.json`** (used by ST003–ST007 — analysis gates):
```json
{
  "hypothesis_h0": "No difference in means",
  "hypothesis_h1": "Treatment group has higher mean",
  "minimum_sample_size": 100,
  "alpha": 0.05
}
```

---

## Gates

### ST001 — spec-valid
Reads `statistical-test-spec.json`. Hard-fails if missing. Required: `hypothesis_h0`, `hypothesis_h1`, `alpha` (number strictly between 0 and 1), `test_type`.

BAD: spec missing or `alpha: 0` or `alpha: 1` or `alpha: "0.05"` (string).
GOOD: all four fields present with numeric alpha in (0, 1).

### ST002 — hypothesis-defined (labeled ST001 in code)
Hypothesis must be explicitly stated in code or documentation. Reads `stat-test-spec.json`. Accepts:
- `null_hypothesis` + `alternative_hypothesis` in spec
- `H0:` / `H1:` / `H_0:` / `H_1:` patterns in `.py`/`.ipynb`/`.md` files
- `null_hypothesis` / `alternative_hypothesis` / `hypothesis` variable names in code

BAD:
```python
# Run t-test on two groups
stat, p = ttest_ind(group_a, group_b)
print(f"p={p:.4f}")  # no hypothesis stated
```
GOOD:
```python
# H0: No difference in mean purchase value between groups A and B
# H1: Group B has a higher mean purchase value than group A
stat, p = ttest_ind(group_a, group_b, alternative="greater")
```
Escape: `hypothesisInDocs: true` in spec (hypothesis documented in external design doc).

### ST003 — sample-size-adequate (labeled ST003 in code)
Sample size must be justified before running the test. Accepted:
- `minimum_sample_size` declared in `stat-test-spec.json` AND enforced in code (`len(` check or `assert len(`)
- `TTestIndPower(` / `solve_power(` — power analysis determines sample size at runtime

BAD:
```python
# No sample size check — underpowered test possible
stat, p = ttest_ind(group_a, group_b)
```
GOOD:
```python
from statsmodels.stats.power import TTestIndPower
analysis = TTestIndPower()
n = analysis.solve_power(effect_size=0.5, alpha=0.05, power=0.8)
print(f"Required n per group: {n:.0f}")
# OR enforce minimum from spec:
assert len(group_a) >= spec["minimum_sample_size"], "Insufficient sample size"
```
Escape: `sampleSizeJustified: true` in spec (sample size pre-validated in study design).

### ST004 — test-selection-justified (labeled ST004 in code)
Statistical test assumptions must be verified. Reads `stat-test-spec.json`:
- t-test → normality check: `shapiro(`, `kstest(`, `normaltest(`, `lilliefors(`
- ANOVA → normality + variance homogeneity: normality check + `levene(` / `bartlett(`

Auto-skips when `test_type` contains non-parametric tests (mann-whitney, wilcoxon, kruskal, chi2, chi-squared, fisher, mcnemar, friedman).

BAD:
```python
# t-test without checking normality
stat, p = ttest_ind(control, treatment)
```
GOOD:
```python
from scipy.stats import shapiro, levene
# Check normality assumption
_, p_norm_control = shapiro(control)
_, p_norm_treatment = shapiro(treatment)
# Check equal variance
_, p_levene = levene(control, treatment)
print(f"Normality: control p={p_norm_control:.3f}, treatment p={p_norm_treatment:.3f}")
print(f"Variance homogeneity: p={p_levene:.3f}")
stat, p = ttest_ind(control, treatment)
```
Escape: `# @test-choice-ok: <reason>` or `testJustifiedInDocs: true` in spec.

### ST005 — effect-size-reported (labeled ST005 in code)
Effect size must be computed and reported alongside p-values. Accepted patterns:
- `cohen_d` / `cohens_d` / `effect_size`
- `cramers_v` / `cramer_v` / `cramers_phi`
- `eta_squared` / `eta2`
- `odds_ratio`
- `pearsonr(` / `spearmanr(` — correlation as effect size
- `pingouin` library (handles effect sizes automatically)

BAD:
```python
stat, p = ttest_ind(group_a, group_b)
print(f"p={p:.4f}")  # no effect size — is the difference meaningful?
```
GOOD:
```python
from scipy.stats import ttest_ind
import numpy as np

stat, p = ttest_ind(group_a, group_b)
pooled_std = np.sqrt((group_a.std()**2 + group_b.std()**2) / 2)
cohen_d = (group_a.mean() - group_b.mean()) / pooled_std
print(f"t={stat:.3f}, p={p:.4f}, Cohen's d={cohen_d:.3f}")
```
Escape: `# @no-effect-size-ok: <reason>`.

### ST006 — confidence-intervals (labeled ST006 in code)
Confidence intervals must be computed for the primary estimate. Reads `stat-test-spec.json`. Accepted patterns:
- `confidence_interval` / `conf_int` / `confint`
- `scipy.stats.*.interval(` — parametric CI
- `bootstrap` / bootstrapping with ≥100 resamples
- `t.ppf(` / `norm.ppf(` — manual CI computation
- `wilson` interval

BAD:
```python
stat, p = ttest_ind(group_a, group_b)
print(f"Difference: {group_a.mean() - group_b.mean():.3f}")  # no CI
```
GOOD:
```python
from scipy import stats
import numpy as np

diff = group_a.mean() - group_b.mean()
se = np.sqrt(group_a.var()/len(group_a) + group_b.var()/len(group_b))
ci_low, ci_high = stats.t.interval(0.95, df=len(group_a)+len(group_b)-2,
                                    loc=diff, scale=se)
print(f"Difference: {diff:.3f} (95% CI: [{ci_low:.3f}, {ci_high:.3f}])")
```
Escape: `# @no-ci-ok: <reason>`.

### ST007 — p-value-in-context (labeled ST007 in code)
A p-value result must not stand alone — it must be accompanied by effect size or confidence interval in the same vicinity of code (within 10 lines). Blocked: isolated `p_value`/`pvalue`/`p-value` print or assignment without nearby effect size or CI.

BAD:
```python
stat, p = ttest_ind(group_a, group_b)
print(f"Result is {'significant' if p < 0.05 else 'not significant'} (p={p:.4f})")
# No effect size or CI — p alone tells you nothing about practical importance
```
GOOD:
```python
stat, p = ttest_ind(group_a, group_b)
cohen_d = (group_a.mean() - group_b.mean()) / pooled_std
print(f"p={p:.4f}, Cohen's d={cohen_d:.3f} (95% CI: [{ci_low:.3f}, {ci_high:.3f}])")
```
Escape: `# @p-only-ok: <reason>`.

### ST008 — multiple-testing-corrected (labeled ST008 in code)
When ≥2 different statistical test types are detected in code, multiple-testing correction must be applied. Accepted correction methods:
- `bonferroni` — Bonferroni correction
- `multipletests(` — statsmodels correction
- `fdr_bh` / `fdrcorrection(` — Benjamini-Hochberg FDR
- `holm` — Holm-Bonferroni
- `sidak` — Šidák correction

Auto-skips when fewer than 2 distinct test functions are present.

BAD:
```python
# Running 5 t-tests with no correction — false positive rate = 23%
for feature in features:
    stat, p = ttest_ind(group_a[feature], group_b[feature])
    if p < 0.05:
        print(f"{feature}: significant")
```
GOOD:
```python
from statsmodels.stats.multitest import multipletests

p_values = []
for feature in features:
    _, p = ttest_ind(group_a[feature], group_b[feature])
    p_values.append(p)

reject, p_corrected, _, _ = multipletests(p_values, alpha=0.05, method="fdr_bh")
for feature, p_adj, sig in zip(features, p_corrected, reject):
    print(f"{feature}: p_adj={p_adj:.4f}, {'significant' if sig else 'not significant'}")
```
Escape: `# @no-correction-ok: <reason>`.

### ST009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### ST010 — contract-statistical-test
Final contract check (RULES array — no escape hatch):
- Effect size reported: `cohen_d` / `effect_size` / `cramers_v` / `eta_squared` / `odds_ratio` / `pearsonr` / `spearmanr` / `pingouin` present
- Confidence intervals: `confidence_interval` / `conf_int` / `bootstrap` / `t.ppf` / `norm.ppf` / `scipy.stats.*interval` present
- Alpha level in code: `alpha\s*=\s*0\.\d+` pattern — alpha must be explicit in code, not just in spec

---

## What This Compiler Never Forgives

- `statistical-test-spec.json` missing (ST001 hard-fails)
- `hypothesis_h0`, `hypothesis_h1`, `alpha`, or `test_type` missing (ST001)
- `alpha` not strictly between 0 and 1 (ST001)
- No hypothesis statement in code or documentation (ST002)
- No sample size check or power analysis (ST003)
- t-test without normality check, or ANOVA without normality + variance check (ST004)
- No effect size reported alongside p-value (ST005)
- No confidence intervals computed (ST006)
- p-value reported without effect size or CI in context (ST007)
- ≥2 test types run without multiple-testing correction (ST008)
- TODO/FIXME/HACK/XXX anywhere (ST009)
- Contract violations: no effect size, no CI, no explicit alpha in code (ST010)
