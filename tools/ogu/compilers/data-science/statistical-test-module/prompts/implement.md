# Statistical Test Module Compiler — Implementation Guide

## Purpose
Implement rigorous statistical tests with proper effect sizes, confidence intervals, and power analysis.

## Required Output Files
- `statistical-test-spec.json` — test specification
- `test_analysis.py` or `statistical_test.ipynb`

## statistical-test-spec.json Structure
```json
{
  "hypothesis_h0": "There is no difference in conversion rate between groups A and B",
  "hypothesis_h1": "Group B has a higher conversion rate than group A",
  "alpha": 0.05,
  "test_type": "two-sample t-test",
  "test_justification": "Continuous metric, approximately normal distribution, independent samples"
}
```

## Complete Statistical Test Pattern
```python
from scipy import stats
import numpy as np
from statsmodels.stats.power import TTestIndPower

# 1. Power analysis BEFORE the test
analysis = TTestIndPower()
n = analysis.solve_power(effect_size=0.3, alpha=0.05, power=0.8)

# 2. Run the test
t_stat, p_value = stats.ttest_ind(group_a, group_b)

# 3. Effect size (Cohen's d)
effect_size = (group_b.mean() - group_a.mean()) / np.sqrt(
    (group_a.std()**2 + group_b.std()**2) / 2
)

# 4. Confidence interval
n_a, n_b = len(group_a), len(group_b)
se = np.sqrt(group_a.var()/n_a + group_b.var()/n_b)
ci = stats.t.interval(0.95, df=n_a + n_b - 2, loc=group_b.mean() - group_a.mean(), scale=se)
```

## Anti-Patterns
- Reporting only p < 0.05 without effect size
- Running multiple tests without Bonferroni/FDR correction
- No power analysis before deciding sample size
- Test type not justified
