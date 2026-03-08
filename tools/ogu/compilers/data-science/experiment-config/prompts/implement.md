# Experiment Config Compiler — Implementation Guide

## Purpose
Define all hyperparameters in a versioned config file, never hardcoded in training code.

## Required Output Files
- `experiment-spec.json` — experiment metadata
- `config.yaml` — hyperparameters (or `params.yaml`)

## experiment-spec.json Structure
```json
{
  "experiment_name": "rf_baseline_v2",
  "model_type": "RandomForestClassifier",
  "hyperparameters": ["n_estimators", "max_depth", "min_samples_leaf"]
}
```

## config.yaml Pattern
```yaml
# Experiment: rf_baseline_v2
# Purpose: Baseline random forest for churn prediction

seed: 42  # random seed for reproducibility
random_state: 42  # sklearn random_state

hyperparameters:
  n_estimators: 200  # number of trees; tuned by grid search
  max_depth: 10      # max tree depth; prevents overfitting
  min_samples_leaf: 5  # minimum samples per leaf; regularization

search_space:
  n_estimators: [50, 100, 200, 500]
  max_depth: [5, 10, 15, null]
```

## Anti-Patterns
- `n_estimators=100` hardcoded in training script
- Config file exists but no `random_state` or `seed`
- Hyperparameters without explanatory comments
- No search space defined for tuning
