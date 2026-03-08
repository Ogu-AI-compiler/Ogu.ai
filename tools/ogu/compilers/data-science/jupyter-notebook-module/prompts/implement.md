# Jupyter Notebook Module Compiler — Implementation Guide

## Purpose
Build a well-structured, reproducible Jupyter notebook following production standards.

## Required Output Files
- `jupyter-notebook-spec.json` — notebook configuration
- `*.ipynb` — the notebook itself

## jupyter-notebook-spec.json Structure
```json
{
  "notebook_name": "feature_analysis.ipynb",
  "purpose": "Analyze feature importance and correlations for model selection",
  "sections": ["Setup", "Data Loading", "Feature Analysis", "Conclusions"]
}
```

## Notebook Structure Requirements
1. First cell: Markdown heading (`# Notebook Title`)
2. One markdown cell per ~4 code cells
3. All functions extracted with `def` (not inline for reused logic)
4. `SEED = 42` and applied to all stochastic operations
5. Run "Restart & Run All" before committing
6. No embedded images in outputs (clear with `jupyter nbconvert --clear-output`)

## Anti-Patterns
- Out-of-order cell execution (non-monotonic execution_count)
- `inplace=True` on DataFrame operations (mutates global state)
- No `def` functions in a notebook with >80 code lines
- Missing first-cell heading
- Embedded PNG/JPEG outputs in committed notebooks
