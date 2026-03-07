---
name: schema-design
description: Designs relational or document database schemas optimized for query patterns and data integrity. Use when modeling new entities, planning a schema migration, or optimizing database structure. Triggers: "schema design", "database schema", "data model", "design the tables", "ERD", "data modeling".
---

# Schema Design

## When to Use
- Designing the data model for a new feature or service
- Migrating or refactoring an existing schema
- Optimizing a schema that has become a performance bottleneck

## Workflow
1. Understand the query patterns first — design for reads, not just writes
2. Normalize to 3NF as the starting point; denormalize only when profiling shows need
3. Define constraints: NOT NULL, UNIQUE, FK, and CHECK constraints for integrity
4. Name tables in singular nouns (`user`, `order`) and use snake_case consistently
5. Plan the migration: every schema change needs a reversible migration script

## Quality Bar
- Schema enforces data integrity at the database level, not just the application
- All foreign keys have matching indexes for join performance
- Migration scripts are reversible (up and down) and tested in staging before production
- Large table changes use online schema change tools to avoid downtime
