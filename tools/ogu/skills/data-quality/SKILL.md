---
name: data-quality
description: Validates, monitors, and improves data accuracy, completeness, and consistency in pipelines and warehouses. Use when auditing data quality, adding validation rules, or investigating data anomalies. Triggers: "data quality", "validate data", "data accuracy", "data issues", "data freshness", "bad data".
---

# Data Quality

## When to Use
- Adding validation to a new data pipeline or ETL job
- Investigating reported data accuracy issues
- Setting up ongoing data quality monitoring

## Workflow
1. Define data quality dimensions: completeness, accuracy, consistency, timeliness, uniqueness
2. Write expectations/assertions for each critical column and table
3. Add validation gates to pipeline: fail on critical violations, warn on minor
4. Build data quality dashboards tracking pass rates over time
5. Establish SLAs: what's acceptable freshness, null rate, and duplicate rate per dataset

## Quality Bar
- All critical pipelines have automated data quality checks
- Data quality SLAs are documented and reviewed with data consumers
- Quality failures trigger alerts and prevent downstream consumption
- Root cause analysis documented for all quality incidents
