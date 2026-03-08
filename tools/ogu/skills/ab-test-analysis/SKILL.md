---
name: ab-test-analysis
description: Compiler skill for the ab-test-analysis compiler. Activates when producing ab-test-artifact.json. Gates: AB001–AB009. Hard-fails when spec missing.
---

# ab-test-analysis — Compiler Skill

## What This Compiler Does

Compiles A/B test analysis scripts — validates spec structure, detects Sample Ratio Mismatch (SRM), enforces control group presence, requires pre-registered sample size, enforces a single primary metric, requires guardrail metrics, and validates statistical rigor (p-value + effect size + power + CI all present). All `.py` and `.ipynb` files in the directory are analysed.

**Upstream dependency:** none
**Output artifact:** `ab-test-artifact.json`
**IR identifier:** `AB_TEST_ANALYSIS:{project}`

---

## Spec Shape

```json
{
  "experiment_name": "checkout-cta-v2",
  "control_variant": "control",
  "treatment_variants": ["variant_a", "variant_b"],
  "primary_metric": "conversion_rate",
  "guardrail_metrics": ["revenue_per_user", "page_load_time"],
  "allocation": { "control": 0.5, "variant_a": 0.25, "variant_b": 0.25 },
  "minimum_sample_size": 5000,
  "alpha": 0.05
}
```

Required fields:
- `experiment_name` — string
- `control_variant` — string (the baseline group)
- `treatment_variants` — non-empty array
- `primary_metric` — string (exactly one)

---

## Gates

### AB001 — spec-valid
Reads `ab-test-spec.json`. Hard-fails if missing. Required: `experiment_name`, `control_variant`, `treatment_variants` (non-empty array), `primary_metric`.

BAD: `ab-test-spec.json` missing or any required field absent.
GOOD: all four fields present.

### AB002 — srm-check
Sample Ratio Mismatch detection via `chi2_contingency`. If allocation ratios are declared in spec, actual group sizes must match expected within χ² significance. SRM invalidates all test results.

BAD:
```python
# spec declares 50/50 but actual is 70/30 — SRM present
chi2_contingency([[7000, 3000]])  # without comparing to expected
```
GOOD:
```python
from scipy.stats import chi2_contingency
observed = [len(control_df), len(treatment_df)]
expected_ratio = [spec["allocation"]["control"], spec["allocation"]["variant_a"]]
total = sum(observed)
expected = [total * r for r in expected_ratio]
stat, p, _, _ = chi2_contingency([observed, expected])
assert p > 0.05, f"SRM detected! p={p:.4f}"
```

### AB003 — control-variant-required
A control (baseline) group must be present. The `control_variant` from spec must appear as a group in the analysis code.

BAD: analysis with only treatment groups, no baseline.
GOOD: `control_variant = spec["control_variant"]` used in comparisons.

### AB004 — sample-size-adequate
Sample size must be determined via power analysis (`TTestIndPower`, `solve_power`) or declared as `minimum_sample_size` in spec.

BAD: running test with arbitrary N, no power analysis.
GOOD:
```python
from statsmodels.stats.power import TTestIndPower
analysis = TTestIndPower()
n = analysis.solve_power(effect_size=0.1, alpha=0.05, power=0.8)
assert len(control) >= n, f"Need {n:.0f} samples per group"
```
Escape: `"sampleSizeJustified": true` + `"sample_size_note"` in spec.

### AB005 — single-primary-metric
Exactly one `primary_metric` must be declared. Multiple primary metrics inflate Type I error rate without correction.

BAD: `"primary_metric": ["conversion_rate", "revenue"]` — multiple primaries.
GOOD: `"primary_metric": "conversion_rate"` — single string.

### AB006 — guardrail-metrics
`guardrail_metrics` array must be declared in spec. Guardrails detect regressions on critical secondary metrics while optimising the primary.

BAD: no `guardrail_metrics` key in spec.
GOOD: `"guardrail_metrics": ["revenue_per_user", "page_load_time_ms"]`

### AB007 — statistical-significance
All four statistical reporting components must be present in code:
1. **p-value**: `ttest_ind`, `mannwhitneyu`, or equivalent
2. **Effect size**: `cohen_d`, `cohens_d`, or manual calculation
3. **Power**: `TTestIndPower`, `solve_power`, or `statsmodels.stats.power`
4. **Confidence intervals**: `scipy.stats.*interval`, `bootstrap`, `confidence_interval`

BAD: only `ttest_ind` — missing effect size, power, and CI.
GOOD:
```python
from scipy.stats import ttest_ind, norm
from statsmodels.stats.power import TTestIndPower

stat, p = ttest_ind(control, treatment)
effect_size = (treatment.mean() - control.mean()) / pooled_std(control, treatment)
power = TTestIndPower().solve_power(effect_size=effect_size, nobs1=len(control), alpha=0.05)
margin = norm.ppf(0.975) * np.sqrt(treatment.var()/len(treatment) + control.var()/len(control))
ci = (diff - margin, diff + margin)
```
Escape: `# @no-power-ok` or `# @no-ci-ok`.

### AB008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` comments in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### AB009 — contract-ab-test
Final contract check (RULES array — no escape hatch):
- Multiple metrics computed (at least 2 metric functions)
- Baseline comparison present (`control` / `baseline` referenced alongside treatment)
- Test set predictions on actual held-out data

---

## What This Compiler Never Forgives

- `ab-test-spec.json` missing (AB001 hard-fails)
- `experiment_name`, `control_variant`, `treatment_variants`, or `primary_metric` missing (AB001)
- Sample Ratio Mismatch not detected/corrected (AB002)
- No control/baseline group in analysis (AB003)
- No sample size declaration or power analysis (AB004)
- Multiple primary metrics (AB005)
- No `guardrail_metrics` array (AB006)
- Missing p-value, effect size, power, or CI in analysis (AB007)
- TODO/FIXME/HACK/XXX anywhere (AB008)
- Contract violations: no multiple metrics, no baseline comparison (AB009)
