---
name: statistical-analysis
description: Applies statistical methods to analyze data, test hypotheses, and draw conclusions from experiments. Use when interpreting metrics, running significance tests, or building analytical models. Triggers: "statistical analysis", "significance test", "analyze this data", "p-value", "A/B results", "is this statistically significant".
---

# Statistical Analysis

## When to Use
- Interpreting the results of an A/B test or experiment
- Determining whether a metric change is statistically significant
- Building models to understand trends or make predictions

## Workflow
1. Define the null hypothesis and alternative hypothesis before looking at data
2. Select the appropriate test: t-test, chi-square, Mann-Whitney based on data type
3. Check assumptions: normality, independence, sufficient sample size
4. Calculate test statistic and p-value; compare against pre-defined alpha (0.05)
5. Report effect size alongside p-value — statistical significance ≠ practical significance

## Quality Bar
- Sample size calculated before the experiment, not after
- Multiple comparison corrections applied when testing >1 hypothesis
- Results include confidence intervals, not just point estimates
- Analysis reproducible from raw data with documented code
