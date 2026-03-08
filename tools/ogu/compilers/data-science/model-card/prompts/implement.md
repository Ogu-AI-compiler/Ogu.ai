# Model Card Compiler — Implementation Guide

## Purpose
Document the model with a complete MODEL_CARD.md covering intended use, performance, limitations, and ethics.

## Required Output Files
- `model-card-spec.json` — model card metadata
- `MODEL_CARD.md` — the model card

## model-card-spec.json Structure
```json
{
  "model_name": "churn_predictor",
  "model_type": "RandomForestClassifier",
  "task": "binary classification",
  "intended_use": "Predict customer churn probability for proactive retention outreach by the CRM team"
}
```

## MODEL_CARD.md Template
```markdown
# Model Card: Churn Predictor

## Model Details
- **Model type**: Random Forest (sklearn)
- **Version**: 2.1.0
- **Training date**: 2024-03-01
- **Training framework**: scikit-learn 1.4.0

## Intended Use
**Primary use**: Predict 30-day churn probability for B2B customers.
**Intended users**: CRM team for proactive retention campaigns.
**Out-of-scope uses**: Do not use for individual credit decisions or employment screening.

## Training Data
Trained on 180,000 customer records from Jan 2022 – Dec 2023.
Features: 24 behavioral and account-level features. No PII used directly.

## Evaluation Results
| Metric | Value | Baseline (majority class) |
|--------|-------|--------------------------|
| F1 Macro | 0.82 | 0.41 |
| Accuracy | 0.89 | 0.73 |
| ROC-AUC | 0.91 | 0.50 |

Evaluated on held-out test set (18,000 samples, Jan–Mar 2024).

## Ethical Considerations
Bias analysis: Subgroup analysis across industry vertical and company size showed <3% performance gap.
The model may underperform for customers in underrepresented industries (<100 training samples).

## Limitations
- Performance degrades for customers with <3 months of history
- Does not capture external market events
- Should not be used for customers outside the B2B segment
```

## Anti-Patterns
- Model card with no numeric metrics ("model performs well")
- No out-of-scope uses documented
- No bias/fairness section
- Shorter than 200 characters
- TODO/FIXME markers left in card
