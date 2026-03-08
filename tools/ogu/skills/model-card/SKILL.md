---
name: model-card
description: Compiler skill for the model-card compiler. Activates when producing model-card-artifact.json. Gates: MC001–MC009. Hard-fails when spec missing.
---

# model-card — Compiler Skill

## What This Compiler Does

Compiles model card documentation — validates spec structure, requires a model card markdown file (≥200 chars), requires six canonical sections, requires numeric performance metrics with baseline and dataset context, requires intended use + out-of-scope documentation, requires bias/fairness analysis, and checks for the upstream `model-registry-entry` artifact.

**Upstream dependency:** `model-registry-entry` (checks `.ogu/artifacts/model-registry-entry-artifact.json`)
**Output artifact:** `model-card-artifact.json`
**IR identifier:** `MODEL_CARD:{project}`

---

## Spec Shape

```json
{
  "model_name": "churn-predictor-v3",
  "model_type": "XGBClassifier",
  "task": "binary_classification",
  "intended_use": "Predict customer churn probability for proactive retention campaigns"
}
```

Required fields:
- `model_name` — string
- `model_type` — string
- `task` — string
- `intended_use` — string

---

## Gates

### MC001 — spec-valid
Reads `model-card-spec.json`. Hard-fails if missing. Required: `model_name`, `model_type`, `task`, `intended_use`.

BAD: spec missing or any required field absent.
GOOD: all four fields present.

### MC002 — model-card-exists
A model card file must exist in the directory: `MODEL_CARD.md`, `model-card.md`, `model_card.md`, or `ModelCard.md`. File must be at least 200 characters.

BAD: no model card file found, or card is a 50-char placeholder.
GOOD: `MODEL_CARD.md` with ≥200 chars of actual content.

### MC003 — required-sections
Model card must contain all six required sections (case-insensitive heading match):
1. **Model Details** (or "Model Description")
2. **Intended Use** (or "Intended Uses")
3. **Training Data** (or "Training Dataset")
4. **Evaluation** (or "Evaluation Results", "Performance")
5. **Limitations** (or "Limitations and Risks")
6. **Ethical Considerations** (or "Ethics", "Bias and Fairness")

BAD: card missing "Limitations" and "Ethical Considerations" sections.
GOOD:
```markdown
## Model Details
## Intended Use
## Training Data
## Evaluation
## Limitations
## Ethical Considerations
```
Escape: `sectionExceptions: ["Limitations"]` in spec (list sections to waive).

### MC004 — performance-metrics-present
Model card Evaluation section must contain:
1. Numeric metric values (e.g., `F1: 0.87`, `AUC: 0.92`)
2. Evaluation dataset specified (dataset name or description)
3. Baseline comparison mentioned

BAD:
```markdown
## Evaluation
The model performs well on the test set.
```
GOOD:
```markdown
## Evaluation
Evaluated on held-out test set (n=10,000, Jan 2024):
- F1 Score: 0.87 (baseline: 0.71)
- ROC-AUC: 0.91
- Precision: 0.84, Recall: 0.90
```

### MC005 — intended-use-documented
Model card must document:
1. Primary `intended_use` (matching spec field)
2. Out-of-scope uses explicitly stated
3. Target audience / users mentioned

BAD:
```markdown
## Intended Use
For predicting churn.
```
GOOD:
```markdown
## Intended Use
**Primary use**: Predict customer churn probability for retention campaigns.
**Target users**: Customer success managers, data scientists.
**Out of scope**: Not intended for automated account termination decisions.
```

### MC006 — bias-fairness-documented
The ethics/bias section must contain:
1. A `##` heading matching ethics/bias/fairness
2. Demographic or subgroup mention (age, gender, race, income, geography, etc.)
3. Fairness limitation acknowledgment

BAD:
```markdown
## Ethical Considerations
This model is fair.
```
GOOD:
```markdown
## Ethical Considerations
### Bias Analysis
Model performance was evaluated across demographic subgroups (age, income bracket, geography).
Performance gap detected: recall is 8% lower for customers in rural areas (feature sparse).
Limitation: training data underrepresents customers aged 65+ — predictions may be less reliable for this group.
```
Escape: `biasAnalysisExternal: true` in spec.

### MC007 — cross-registry (labeled MC008 in code)
Checks `.ogu/artifacts/model-registry-entry-artifact.json` exists, has `pass: true`, and the model name in the artifact matches `spec.model_name`.

Gate is **skipped** (not failed) if the artifact file is not found.

### MC008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb`, `.md` files.

### MC009 — contract-model-card
Final contract check (RULES array — no escape hatch):
- Model card file exists
- Numeric metrics present in card text
- Limitations section present
- Intended use section present
- Training data section present

---

## What This Compiler Never Forgives

- `model-card-spec.json` missing (MC001 hard-fails)
- `model_name`, `model_type`, `task`, or `intended_use` missing (MC001)
- No `MODEL_CARD.md` / `model-card.md` / `model_card.md` / `ModelCard.md` file (MC002)
- Model card file shorter than 200 characters (MC002)
- Any of the 6 required sections missing (MC003)
- No numeric metric values in Evaluation section (MC004)
- No evaluation dataset specified (MC004)
- No baseline comparison in Evaluation (MC004)
- No out-of-scope uses in Intended Use (MC005)
- No demographic/subgroup mention in Ethics section (MC006)
- Upstream registry artifact failed or model name mismatch (MC007 — when artifact exists)
- TODO/FIXME/HACK/XXX anywhere (MC008)
- Missing numeric metrics, limitations, intended use, or training data in card (MC009)
