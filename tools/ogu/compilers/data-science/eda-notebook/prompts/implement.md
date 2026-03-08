# EDA Notebook Compiler — Implementation Guide

## Purpose
Create a structured exploratory data analysis notebook with all required analytical sections.

## Required Output Files
- `eda-spec.json` — EDA configuration
- `eda.ipynb` — the EDA notebook

## eda-spec.json Structure
```json
{
  "dataset": "user_events",
  "target_variable": "conversion",
  "analysis_goals": ["understand distributions", "identify missing values", "find correlations"]
}
```

## Required Notebook Sections (in order)
1. **# Data Overview** — `.info()`, `.describe()`, `.shape`
2. **# Missing Values** — `.isnull().sum()`, `msno.matrix()`
3. **# Distributions** — `.hist()`, `sns.boxplot()`, `value_counts()`
4. **# Correlations** — `.corr()`, `sns.heatmap()`
5. **# Key Findings** — bulleted markdown summary

## Anti-Patterns
- Writing back to `/raw/` directory from EDA
- No random seed when using random functions
- Only code cells, no markdown explanations
- Conclusions not written down in markdown
