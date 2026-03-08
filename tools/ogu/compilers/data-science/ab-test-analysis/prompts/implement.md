# A/B Test Analysis Compiler — Implementation Guide

## Purpose
Conduct a rigorous A/B test analysis with pre-registration, SRM checks, and complete statistical reporting.

## Required Output Files
- `ab-test-spec.json` — pre-registered experiment spec
- `ab_test_analysis.py` or `ab_test_analysis.ipynb`

## ab-test-spec.json Structure
```json
{
  "experiment_name": "checkout_button_color_test",
  "hypothesis": "Changing the checkout button from grey to green will increase purchase conversion rate by at least 5%",
  "primary_metric": "purchase_conversion_rate",
  "guardrail_metrics": ["page_load_time_p99", "error_rate", "add_to_cart_rate"],
  "alpha": 0.05,
  "min_sample_size": 5000,
  "treatment_variants": ["control", "green_button"],
  "control_variant": "control"
}
```

## Analysis Pattern
```python
from scipy import stats
from statsmodels.stats.power import TTestIndPower
import numpy as np

# 1. SRM check
chi2, srm_p = stats.chi2_contingency([[n_control, n_treatment]])[0:2]

# 2. Primary metric test
t_stat, p_value = stats.ttest_ind(control_metric, treatment_metric)

# 3. Effect size (lift)
lift = (treatment_metric.mean() - control_metric.mean()) / control_metric.mean()
cohen_d = lift / np.sqrt((control_metric.std()**2 + treatment_metric.std()**2) / 2)

# 4. Confidence interval
ci = stats.t.interval(0.95, df=..., loc=lift, scale=se)

# 5. Power
power = TTestIndPower().power(effect_size=cohen_d, nobs1=n_control, alpha=0.05)

# 6. Guardrail checks
for metric in guardrail_metrics:
    _, gp = stats.ttest_ind(control[metric], treatment[metric])
    assert gp > 0.05 / len(guardrail_metrics), f"Guardrail failure: {metric}"
```

## Anti-Patterns
- Peeking at results before sample size reached (p-hacking)
- No SRM check before analysis
- Ignoring guardrail metric regressions
- Reporting only p-value without lift and CI
- User_id % 2 assignment instead of hash-based randomization
