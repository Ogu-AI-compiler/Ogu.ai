# Domain Compiler Network — Reference

> **Verified Execution Network**: every artifact is formally compiled, gated, and attested.
> Downstream compilers validate upstream artifacts. The chain is the guarantee.

---

## Five-Tier Architecture

Compilers are organized into five tiers based on which roles consume them:

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND-ONLY  (tools/ogu/compilers/frontend/)                 │
│  react-component, react-form, react-hook, react-page,           │
│  query-module, mutation-module, invalidation-map,               │
│  state-store, routing-config, navigation-config,                │
│  route-guard, route-resilience, loading-skeleton,               │
│  animation-spec, storybook-story, design-tokens,                │
│  providers-scaffold, layout-component,                          │
│  url-searchparams-contract, unit-test-module,                   │
│  error-boundary-wrapper, security-safe-html-module,             │
│  feature-module-scaffold, testing-harness-config,               │
│  storybook-harness-config, a11y-harness-config,                 │
│  swr-resource-module, experiment-variant-wrapper                │
├─────────────────────────────────────────────────────────────────┤
│  SHARED  (tools/ogu/compilers/shared/)                          │
│  utility-fn, analytics-event, feature-flag, i18n, a11y-test    │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND-ONLY  (tools/ogu/compilers/backend-*)                  │
│  ts-schema, api-route, auth-middleware, db-migration,           │
│  openapi-spec, module-scaffold, config-validation-module,       │
│  domain-service-module, orm-repository-module,                  │
│  transaction-script-module, service-client-runtime-module,      │
│  service-client-module, cache-topology-module, cache-module,    │
│  backend-test-harness-config, backend-test-module,              │
│  job-producer-module, job-worker-module, event-publisher-module │
│  event-consumer-module, scheduled-job-module,                   │
│  webhook-processor-module, rate-limit-policy-module,            │
│  graphql-schema-module, graphql-resolver-module,                │
│  queue-topology-module, healthcheck-module,                     │
│  seed-scenario-module                                           │
├─────────────────────────────────────────────────────────────────┤
│  DATA SCIENCE  (tools/ogu/compilers/data-science/)              │
│  data-schema, data-ingestion-script, data-validation-module,    │
│  data-pipeline-script, eda-notebook, jupyter-notebook-module,   │
│  statistical-test-module, ab-test-analysis,                     │
│  feature-pipeline, feature-store-module, dataset-split-module,  │
│  model-training-script, experiment-config,                      │
│  model-evaluation-report, model-registry-entry,                 │
│  serving-api-module, model-monitoring-config, model-card        │
├─────────────────────────────────────────────────────────────────┤
│  SECURITY  (tools/ogu/compilers/security/)                      │
│  secret-handling-policy, pii-classification,                    │
│  encryption-key-policy, threat-model, authz-policy,             │
│  input-validation-policy, rate-limit-policy, csp-policy,        │
│  audit-log-policy, webhook-verification-policy,                 │
│  file-upload-policy, session-cookie-policy,                     │
│  dep-vuln-policy, sast-policy, vuln-exception-record            │
└─────────────────────────────────────────────────────────────────┘
```

**Why shared?** These compilers produce artifacts consumed by multiple roles:
- `utility-fn` — pure functions used by frontend AND backend
- `analytics-event` — event schema used by frontend, backend, and mobile
- `feature-flag` — evaluated on client AND server
- `i18n` — frontend UI text AND backend email templates
- `a11y-test` — frontend testing that references shared component artifacts

**Data Science tier** is Python-first. Gates check `.py` and `.ipynb` files. Language: Python 3.10+.

**Unification path:**
```
28 frontend compilers   ──► frontend-developer compiler
 5 shared compilers     ──► consumed by all role compilers
28 backend compilers    ──► backend-developer compiler
18 data-science comp.   ──► data-scientist compiler (ML lifecycle end-to-end)
15 security compilers   ──► security-engineer compiler (policy enforcement, threat modeling)
```

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │   ts-schema     │  ← source of truth for all field shapes
                    │  (SC001-SC011)  │
                    └────────┬────────┘
                             │ schema-artifact.json
         ┌───────────────────┼──────────────────────────┐
         │                   │                           │
         ▼                   ▼                           ▼
┌──────────────────┐  ┌─────────────┐         ┌──────────────────┐
│ react-component  │  │ api-route   │         │  db-migration    │
│  (RC001-RC011)   │  │(AR001-AR014)│         │  (DM001-DM012)   │
└──────────────────┘  └──────┬──────┘         └──────────────────┘
         ▲                   │ route-artifact.json
         │                   │
         │            ┌──────┴──────────┐
         │            │   auth-middleware│
         │            │  (AM001-AM011)  │
         │            └─────────────────┘
         │
┌────────┴─────────┐
│   react-form     │  ← depends on schema + route
│  (RF001-RF012)   │
└──────────────────┘
```

**Full dependency picture:**
```
  ts-schema ──────────────────────────────► api-route (cross-schema)
  auth-middleware ─────────────────────────► api-route (cross-auth)
  db-migration ────────────────────────────► api-route (cross-migration)
  ts-schema ──────────► db-migration (cross-schema)
  ts-schema ──────────► react-component (cross-schema)
  ts-schema ──────────► react-form (cross-schema)
  api-route ──────────► react-form (cross-route)
  api-route ──────────► openapi-spec (aggregates route-artifact.json files)
```

---

## Full Compiler Inventory

### Built ✓

| ID | Tier | Status | Artifact |
|---|---|---|---|
| `ts-schema` | backend | ✓ built | `schema-artifact.json` |
| `api-route` | backend | ✓ built | `route-artifact.json` |
| `auth-middleware` | backend | ✓ built | `auth-artifact.json` |
| `db-migration` | backend | ✓ built | `migration-artifact.json` |
| `openapi-spec` | backend | ✓ built | `openapi-artifact.json` |
| `react-component` | frontend | ✓ built | `component-artifact.json` |
| `react-form` | frontend | ✓ built | `form-artifact.json` |
| `react-hook` | frontend | ✓ built | `hook-artifact.json` |
| `react-page` | frontend | ✓ built | `page-artifact.json` |
| `query-module` | frontend | ✓ built | `query-artifact.json` |
| `mutation-module` | frontend | ✓ built | `mutation-artifact.json` |
| `state-store` | frontend | ✓ built | `store-artifact.json` |
| `routing-config` | frontend | ✓ built | `routing-artifact.json` |
| `design-tokens` | frontend | ✓ built | `tokens-artifact.json` |
| `loading-skeleton` | frontend | ✓ built | `skeleton-artifact.json` |
| `animation-spec` | frontend | ✓ built | `animation-artifact.json` |
| `layout-component` | frontend | ✓ built | `layout-artifact.json` |
| `invalidation-map` | frontend | ✓ built | `invalidation-artifact.json` |
| `route-guard` | frontend | ✓ built | `guard-artifact.json` |
| `providers-scaffold` | frontend | ✓ built | `providers-artifact.json` |
| `storybook-story` | frontend | ✓ built | `story-artifact.json` |
| `navigation-config` | frontend | ✓ built | `nav-artifact.json` |
| `route-resilience` | frontend | ✓ built | `resilience-artifact.json` |
| `url-searchparams-contract` | frontend | ✓ built | `searchparams-artifact.json` |
| `unit-test-module` | frontend | ✓ built | `unit-test-artifact.json` |
| `error-boundary-wrapper` | frontend | ✓ built | `error-boundary-artifact.json` |
| `security-safe-html-module` | frontend | ✓ built | `safe-html-artifact.json` |
| `feature-module-scaffold` | frontend | ✓ built | `feature-module-artifact.json` |
| `testing-harness-config` | frontend | ✓ built | `test-harness-artifact.json` |
| `storybook-harness-config` | frontend | ✓ built | `storybook-harness-artifact.json` |
| `a11y-harness-config` | frontend | ✓ built | `a11y-harness-artifact.json` |
| `swr-resource-module` | frontend | ✓ built | `swr-artifact.json` |
| `experiment-variant-wrapper` | frontend | ✓ built | `experiment-artifact.json` |
| `utility-fn` | shared | ✓ built | `utility-artifact.json` |
| `i18n` | shared | ✓ built | `i18n-artifact.json` |
| `analytics-event` | shared | ✓ built | `analytics-artifact.json` |
| `feature-flag` | shared | ✓ built | `flag-artifact.json` |
| `a11y-test` | shared | ✓ built | `a11y-artifact.json` |

### Backend Domain Compilers ✓ (New)

| ID | Tier | IR Identifier | Gates | Artifact |
|---|---|---|---|---|
| `module-scaffold` | backend | `MODULE:{name}` | MS001–MS007 | `scaffold-artifact.json` |
| `config-validation-module` | backend | `CONFIG:{namespace}` | CV001–CV010 | `config-artifact.json` |
| `domain-service-module` | backend | `SERVICE:{name}` | DS001–DS011 | `service-artifact.json` |
| `orm-repository-module` | backend | `REPOSITORY:{modelName}` | OR001–OR012 | `repository-artifact.json` |
| `transaction-script-module` | backend | `TRANSACTION:{name}` | TX001–TX008 | `transaction-artifact.json` |
| `service-client-runtime-module` | backend | `CLIENT_RUNTIME:{name}` | SR001–SR009 | `client-runtime-artifact.json` |
| `service-client-module` | backend | `SERVICE_CLIENT:{provider}` | SC001–SC011 | `service-client-artifact.json` |
| `cache-topology-module` | backend | `CACHE_TOPOLOGY:{name}` | CT001–CT008 | `cache-topology-artifact.json` |
| `cache-module` | backend | `CACHE:{namespace}` | CA001–CA010 | `cache-artifact.json` |
| `backend-test-harness-config` | backend | `TEST_HARNESS:{name}` | TH001–TH008 | `test-harness-artifact.json` |
| `backend-test-module` | backend | `TEST_MODULE:{module}` | BT001–BT009 | `test-module-artifact.json` |
| `queue-topology-module` | backend | `QUEUE_TOPOLOGY:{name}` | QT001–QT008 | `queue-topology-artifact.json` |
| `job-producer-module` | backend | `JOB_PRODUCER:{jobName}` | JP001–JP009 | `job-producer-artifact.json` |
| `job-worker-module` | backend | `JOB_WORKER:{jobName}` | JW001–JW009 | `job-worker-artifact.json` |
| `event-publisher-module` | backend | `EVENT_PUBLISHER:{eventType}` | EP001–EP008 | `event-publisher-artifact.json` |
| `event-consumer-module` | backend | `EVENT_CONSUMER:{eventType}` | EC001–EC009 | `event-consumer-artifact.json` |
| `scheduled-job-module` | backend | `SCHEDULED_JOB:{jobId}` | SJ001–SJ008 | `scheduled-job-artifact.json` |
| `webhook-processor-module` | backend | `WEBHOOK_PROCESSOR:{provider}` | WH001–WH008 | `webhook-processor-artifact.json` |
| `rate-limit-policy-module` | backend | `RATE_LIMIT_POLICY:{policyId}` | RL001–RL007 | `rate-limit-policy-artifact.json` |
| `graphql-schema-module` | backend | `GRAPHQL_SCHEMA:{schemaName}` | GS001–GS008 | `graphql-schema-artifact.json` |
| `graphql-resolver-module` | backend | `GRAPHQL_RESOLVER:{schemaName}` | GR001–GR009 | `graphql-resolver-artifact.json` |
| `healthcheck-module` | backend | `HEALTHCHECK:{name}` | HC001–HC009 | `healthcheck-artifact.json` |
| `seed-scenario-module` | backend | `SEED_SCENARIO:{scenarioId}` | SS001–SS008 | `seed-scenario-artifact.json` |

### DevOps ✓

| ID | Tier | IR Identifier | Artifact |
|---|---|---|---|
| `env_schema` | devops/foundation | `ENV_SCHEMA:{service}` | `env-schema-artifact.json` |
| `dockerfile_image` | devops/foundation | `DOCKERFILE:{service}` | `dockerfile-artifact.json` |
| `ci_cd_pipeline` | devops/foundation | `CI_CD:{platform}:{service}` | `ci-cd-artifact.json` |
| `iac_stack_definition` | devops/foundation | `IAC_STACK:{cloud}:{platform}` | `iac-artifact.json` |
| `secret_bundle` | devops/secrets | `SECRET_BUNDLE:{namespace}` | `secret-bundle-artifact.json` |
| `vault_policy` | devops/secrets | `VAULT_POLICY:{name}` | `vault-policy-artifact.json` |
| `network_dns_config` | devops/secrets | `DNS_CONFIG:{env}` | `dns-config-artifact.json` |
| `kubernetes_workload` | devops/runtime | `K8S_WORKLOAD:{ns}/{Kind}/{name}` | `k8s-workload-artifact.json` |
| `kubernetes_service` | devops/runtime | `K8S_SERVICE:{ns}/{name}` | `k8s-service-artifact.json` |
| `kubernetes_ingress_gateway` | devops/runtime | `K8S_INGRESS:{name}` | `k8s-ingress-artifact.json` |
| `healthcheck_probe_config` | devops/runtime | `PROBE_CONFIG:{service}` | `probe-config-artifact.json` |
| `background_worker_runtime` | devops/runtime | `WORKER_RUNTIME:{service}` | `worker-runtime-artifact.json` |
| `helm_chart` | devops/packaging | `HELM_CHART:{name}:{version}` | `helm-chart-artifact.json` |
| `kustomize_overlay` | devops/packaging | `KUSTOMIZE_OVERLAY:{env}` | `kustomize-overlay-artifact.json` |
| `scheduled_job` | devops/jobs | `SCHEDULED_JOB:{name}` | `scheduled-job-artifact.json` |
| `data_seed_job` | devops/jobs | `DATA_SEED:{name}` | `data-seed-artifact.json` |
| `db_migration_runner` | devops/jobs | `DB_MIGRATION:{tool}:{database}` | `db-migration-artifact.json` |
| `connection_pool_config` | devops/jobs | `CONN_POOL:{service}` | `connection-pool-artifact.json` |
| `db_backup_job` | devops/jobs | `DB_BACKUP:{database}` | `db-backup-artifact.json` |
| `backup_verification_job` | devops/jobs | `BACKUP_VERIFY:{name}` | `backup-verify-artifact.json` |
| `prometheus_rule_group` | devops/observability | `PROMETHEUS_RULES:{namespace}` | `prometheus-rules-artifact.json` |
| `grafana_dashboard_bundle` | devops/observability | `GRAFANA_DASHBOARD:{namespace}` | `grafana-dashboard-artifact.json` |
| `rightsizing_profile` | devops/cost | `RIGHTSIZING:{service}` | `rightsizing-artifact.json` |
| `edge_policy_bundle` | devops/security | `EDGE_POLICY:{name}` | `edge-policy-artifact.json` |
| `security_scan_pipeline` | devops/security | `SECURITY_SCAN:{name}` | `security-scan-artifact.json` |
| `cost_tagging_policy` | devops/cost | `COST_TAGGING:{org}` | `cost-tagging-artifact.json` |
| `developer_platform_stack` | devops/dx | `DEV_PLATFORM:{name}` | `dev-platform-artifact.json` |
| `disaster_recovery_runbook` | devops/dr | `DR_RUNBOOK:{service}` | `dr-runbook-artifact.json` |

### Data Science Compilers ✓ (New)

| ID | Tier | IR Identifier | Gates | Artifact |
|---|---|---|---|---|
| `data-schema` | data-science | `DATA_SCHEMA` | DS001–DS009 | `schema-ds-artifact.json` |
| `data-ingestion-script` | data-science | `DATA_INGESTION` | DI001–DI009 | `ingestion-artifact.json` |
| `data-validation-module` | data-science | `DATA_VALIDATION` | DV001–DV008 | `validation-ds-artifact.json` |
| `data-pipeline-script` | data-science | `DATA_PIPELINE` | DP001–DP010 | `pipeline-ds-artifact.json` |
| `eda-notebook` | data-science | `EDA_NOTEBOOK` | EN001–EN010 | `eda-artifact.json` |
| `jupyter-notebook-module` | data-science | `JUPYTER_NOTEBOOK` | JN001–JN009 | `jupyter-artifact.json` |
| `statistical-test-module` | data-science | `STATISTICAL_TEST` | ST001–ST010 | `statistical-test-artifact.json` |
| `ab-test-analysis` | data-science | `AB_TEST` | AB001–AB009 | `ab-test-artifact.json` |
| `feature-pipeline` | data-science | `FEATURE_PIPELINE` | FP001–FP010 | `feature-pipeline-artifact.json` |
| `feature-store-module` | data-science | `FEATURE_STORE` | FS001–FS008 | `feature-store-artifact.json` |
| `dataset-split-module` | data-science | `DATASET_SPLIT` | SP001–SP009 | `split-artifact.json` |
| `model-training-script` | data-science | `MODEL_TRAINING` | MT001–MT010 | `training-artifact.json` |
| `experiment-config` | data-science | `EXPERIMENT_CONFIG` | EC001–EC008 | `experiment-config-artifact.json` |
| `model-evaluation-report` | data-science | `MODEL_EVALUATION` | ME001–ME010 | `evaluation-artifact.json` |
| `model-registry-entry` | data-science | `MODEL_REGISTRY` | MR001–MR009 | `model-registry-entry-artifact.json` |
| `serving-api-module` | data-science | `SERVING_API` | SA001–SA010 | `serving-artifact.json` |
| `model-monitoring-config` | data-science | `MODEL_MONITORING` | MM001–MM008 | `monitoring-artifact.json` |
| `model-card` | data-science | `MODEL_CARD` | MC001–MC009 | `model-card-artifact.json` |

### Totals

| Tier | Count | Path |
|---|---|---|
| Frontend | 28 | `compilers/frontend/` |
| Backend | 28 | `compilers/backend/` |
| Shared | 5 | `compilers/shared/` |
| DevOps | 28 | `compilers/devops/` |
| Data Science | 18 | `compilers/data-science/` |
| QA | 0 | `compilers/qa/` ← next |
| **Total** | **107** | |

---

## Build Order

For a complete vertical slice, compile in this order:

```
1. ts-schema          → produces schema-artifact.json
2. auth-middleware    → produces auth-artifact.json        (independent)
3. db-migration       → produces migration-artifact.json   (needs schema-artifact.json)
4. react-component    → produces component-artifact.json   (validates against schema-artifact.json)
5. api-route          → produces route-artifact.json       (validates against all three above)
6. react-form         → produces form-artifact.json        (validates against schema + route artifacts)
7. openapi-spec       → produces openapi-artifact.json     (aggregates all route artifacts → full OpenAPI 3.1 doc)
```

Steps 1 and 2 can run in parallel. Step 3 can start after step 1. Steps 4 and 5 can start after their respective dependencies. Step 6 needs both ts-schema (1) and api-route (5).

### Data Science Build Order

```
Phase 1 — Schema & Ingestion (parallel)
  1a. data-schema            → schema-ds-artifact.json
  1b. data-ingestion-script  → ingestion-artifact.json  (reads schema-ds-artifact)

Phase 2 — Validation & EDA (needs schema + ingestion)
  2a. data-validation-module → validation-ds-artifact.json  (cross: schema-ds)
  2b. eda-notebook           → eda-artifact.json
  2c. jupyter-notebook-module→ jupyter-artifact.json

Phase 3 — Pipeline & Statistics (needs validation)
  3a. data-pipeline-script   → pipeline-ds-artifact.json
  3b. statistical-test-module→ statistical-test-artifact.json
  3c. ab-test-analysis       → ab-test-artifact.json

Phase 4 — Feature Engineering (needs pipeline)
  4a. feature-pipeline       → feature-pipeline-artifact.json
  4b. dataset-split-module   → split-artifact.json

Phase 5 — Feature Store (needs feature-pipeline)
  5a. feature-store-module   → feature-store-artifact.json  (cross: feature-pipeline)

Phase 6 — Training (needs split + feature-store + experiment-config)
  6a. experiment-config      → experiment-config-artifact.json
  6b. model-training-script  → training-artifact.json

Phase 7 — Evaluation & Registry (needs training)
  7a. model-evaluation-report → evaluation-artifact.json
  7b. model-registry-entry    → model-registry-entry-artifact.json

Phase 8 — Deployment & Documentation (needs registry)
  8a. serving-api-module      → serving-artifact.json
  8b. model-monitoring-config → monitoring-artifact.json
  8c. model-card              → model-card-artifact.json  (cross: model-registry)
```

### DevOps Build Order

```
Phase 1 — Foundation (parallel)
  1a. env_schema           → env-schema-artifact.json
  1b. dockerfile_image     → dockerfile-artifact.json
  1c. ci_cd_pipeline       → ci-cd-artifact.json
  1d. iac_stack_definition → iac-artifact.json

Phase 2 — Secrets (needs env_schema)
  2a. secret_bundle        → secret-bundle-artifact.json  (reads env-schema-artifact)
  2b. vault_policy         → vault-policy-artifact.json
  2c. network_dns_config   → dns-config-artifact.json

Phase 3 — Runtime (needs secret_bundle + dockerfile)
  3a. kubernetes_workload      → k8s-workload-artifact.json  (reads secret-bundle + dockerfile artifacts)
  3b. healthcheck_probe_config → probe-config-artifact.json
  3c. background_worker_runtime→ worker-runtime-artifact.json

Phase 4 — Services & Networking (needs kubernetes_workload)
  4a. kubernetes_service         → k8s-service-artifact.json  (reads k8s-workload-artifact)
  4b. kubernetes_ingress_gateway → k8s-ingress-artifact.json  (reads k8s-service-artifact)

Phase 5 — Packaging (needs runtime artifacts)
  5a. helm_chart       → helm-chart-artifact.json
  5b. kustomize_overlay→ kustomize-overlay-artifact.json

Phase 6 — Jobs (parallel, need runtime + secrets)
  6a. scheduled_job         → scheduled-job-artifact.json
  6b. data_seed_job         → data-seed-artifact.json
  6c. db_migration_runner   → db-migration-artifact.json
  6d. connection_pool_config→ connection-pool-artifact.json
  6e. db_backup_job         → db-backup-artifact.json
  6f. backup_verification_job→ backup-verify-artifact.json

Phase 7 — Observability (needs runtime)
  7a. prometheus_rule_group    → prometheus-rules-artifact.json
  7b. grafana_dashboard_bundle → grafana-dashboard-artifact.json

Phase 8 — Security, Cost, DX, DR (parallel)
  8a. rightsizing_profile    → rightsizing-artifact.json
  8b. edge_policy_bundle     → edge-policy-artifact.json
  8c. security_scan_pipeline → security-scan-artifact.json
  8d. cost_tagging_policy    → cost-tagging-artifact.json
  8e. developer_platform_stack→ dev-platform-artifact.json
  8f. disaster_recovery_runbook→ dr-runbook-artifact.json
```

---

## Compiler Profiles

### 1. `ts-schema` — TypeScript Schema Compiler
**Role**: Source of truth. Defines entity shapes that all other compilers validate against.
**Error codes**: SC001–SC011
**Artifact**: `schema-artifact.json`
**Upstream deps**: none
**Downstream consumers**: react-component, api-route, db-migration

| Phase | ID | Gates |
|---|---|---|
| 0 | parse | — |
| 1 | scaffold | spec-valid, schema-valid |
| 2 | implement | zod-valid, ts-valid, no-any, no-todos |
| 3 | coverage-check | tests-pass, coverage, field-coverage |
| 4 | verify | exports-valid, contract-schema |
| 5 | attest | — |

Key gate — **`field-coverage`**: every field declared in `schema-spec.json` must have a Zod definition in `schema.ts`. Schema is self-contained; it does NOT check component or route files.

---

### 2. `react-component` — React Component Compiler
**Role**: UI components with full a11y, prop typing, and Storybook stories.
**Error codes**: RC001–RC011
**Artifact**: `component-artifact.json`
**Upstream deps**: `schema-artifact.json` (optional — enforced only if artifact exists)
**Downstream consumers**: —

| Phase | ID | Gates |
|---|---|---|
| 0 | parse | — |
| 1 | scaffold | spec-valid, schema-valid |
| 2 | implement | ts-valid, no-any, a11y-labels, no-todos |
| 3 | test | tests-pass, coverage (80%) |
| 4 | verify | props, contract-shape, contract-a11y, cross-schema |
| 5 | attest | — |

Key gate — **`cross-schema`** (RC011): if `schema-artifact.json` exists, component data props (non-meta props) must align with schema fields. Schema is the source of truth — component adapts to schema, never the other way.

Meta props exempt from cross-check: `className`, `style`, `children`, `onClick`, `onChange`, `onSubmit`, `onClose`, `ref`, `id`, `key`, `role`, `aria-*`.

---

### 3. `api-route` — API Route Compiler
**Role**: HTTP route handlers with auth, validation, error codes, tests, and OpenAPI.
**Error codes**: AR001–AR014
**Artifact**: `route-artifact.json`
**Upstream deps**: `schema-artifact.json`, `auth-artifact.json`, `migration-artifact.json`
**Downstream consumers**: —

| Phase | ID | Gates |
|---|---|---|
| 0 | parse | — |
| 1 | scaffold | spec-valid, schema-valid |
| 2 | implement | auth-present, error-codes, input-validated, no-raw-sql, no-todos |
| 3 | test | tests-pass, coverage (80%) |
| 4 | verify | openapi-shape, contract-route, cross-schema, cross-auth, cross-migration |
| 5 | attest | — |

Cross-compiler gates:
- **`cross-schema`** (AR012): route `input`/`output` fields must align with `schema-artifact.json` fields. Schema wins.
- **`cross-auth`** (AR013): if `spec.auth !== "none"`, `auth-artifact.json` must exist and export `requireAuth`, `AuthError`, `TokenExpiredError`.
- **`cross-migration`** (AR014): if handler uses DB (`db`, `prisma`, `pool`, `knex`, `drizzle`, `repository`), `migration-artifact.json` must exist.

---

### 4. `auth-middleware` — Auth Middleware Compiler
**Role**: JWT/API-key middleware — the auth layer every protected route depends on.
**Error codes**: AM001–AM011
**Artifact**: `auth-artifact.json`
**Upstream deps**: none
**Downstream consumers**: api-route (cross-auth gate)

| Phase | ID | Gates |
|---|---|---|
| 0 | parse | — |
| 1 | scaffold | spec-valid, exports-valid |
| 2 | implement | no-hardcoded-secrets, expiry-checked, no-todos, error-typed |
| 3 | test | tests-pass, coverage (85%) |
| 4 | verify | timing-safe, no-secret-leak, contract-auth |
| 5 | attest | — |

Coverage threshold is **85%** (higher than others) — auth is critical path.

Key security gates:
- **`no-hardcoded-secrets`** (AM002): no literal secret/key/password strings.
- **`expiry-checked`** (AM004): `jwt.decode()` without `jwt.verify()` = fail.
- **`timing-safe`** (AM008): API key strategy must use `crypto.timingSafeEqual`.
- **`no-secret-leak`** (AM009): token values forbidden in log statements.

---

### 5. `db-migration` — Database Migration Compiler
**Role**: SQL up/down migrations with rollback, idempotency, and FK integrity.
**Error codes**: DM001–DM012
**Artifact**: `migration-artifact.json`
**Upstream deps**: `schema-artifact.json` (optional — enforced only if artifact exists)
**Downstream consumers**: api-route (cross-migration gate)

| Phase | ID | Gates |
|---|---|---|
| 0 | parse | — |
| 1 | scaffold | spec-valid, cross-schema |
| 2 | implement | up-valid, down-valid, no-todos, no-destructive |
| 3 | integrity | idempotent, rollback-complete, pk-not-nullable |
| 4 | verify | fk-indexed, version-sequential, contract-migration |
| 5 | attest | — |

Key gates:
- **`cross-schema`** (DM002): migration columns must align with schema fields. Type mapping enforced: `uuid` → `UUID`/`VARCHAR(36)`, `email` → `VARCHAR`, `boolean` → `BOOLEAN`, etc.
- **`idempotent`** (DM007): every `CREATE TABLE` needs `IF NOT EXISTS`, every `DROP TABLE` needs `IF EXISTS`.
- **`rollback-complete`** (DM008): every `CREATE TABLE/INDEX/TYPE` in `up.sql` must have a corresponding `DROP` in `down.sql`.
- **`fk-indexed`** (DM010): every FK column must have a `CREATE INDEX` covering it.
- **`version-sequential`** (DM011): migration version must be exactly `previous + 1`.

---

## Cross-Compiler Gate Matrix

| Gate | In compiler | Checks artifact | Error code | Required? |
|---|---|---|---|---|
| `cross-schema` | react-component | schema-artifact.json | RC011 | false (skips if absent) |
| `cross-schema` | api-route | schema-artifact.json | AR012 | false (skips if absent) |
| `cross-schema` | db-migration | schema-artifact.json | DM002 | false (skips if absent) |
| `cross-auth` | api-route | auth-artifact.json | AR013 | true (if route is protected) |
| `cross-migration` | api-route | migration-artifact.json | AR014 | true (if handler uses DB) |
| `cross-schema` | react-form | schema-artifact.json | RF009 | false (skips if absent) |
| `cross-route` | react-form | route-artifact.json | RF010 | false (skips if absent) |
| `field-coverage` | ts-schema | schema-spec.json (self) | SC008 | true |
| `cross-route` | query-module | route-artifact.json | QM011 | false (skips if absent) |
| `cross-route` | mutation-module | route-artifact.json | MU011 | false (skips if absent) |
| `cross-query` | mutation-module | query-artifact.json | MU012 | false (skips if absent) |
| `cross-schema` | state-store | ts-schema-artifact.json | SS011 | false (skips if absent) |
| `cross-page` | routing-config | page-artifact.json | RC010 | false (skips if absent) |
| `cross-guard` | routing-config | (code analysis) | RC011 | true (if protected routes) |
| `cross-component` | loading-skeleton | component-artifact.json | SK010 | false (skips if absent) |
| `cross-query` | invalidation-map | query-artifact.json | IV005 | false (skips if absent) |
| `cross-mutation` | invalidation-map | mutation-artifact.json | IV006 | false (skips if absent) |
| `cross-auth` | route-guard | auth-artifact.json | RG009 | false (skips if absent) |
| `cross-routing` | route-guard | routing-artifact.json | RG010 | false (skips if absent) |
| `cross-component` | storybook-story | component-artifact.json | SB007 | false (skips if absent) |
| `cross-routing` | navigation-config | routing-artifact.json | NC009 | false (skips if absent) |
| `cross-routing` | route-resilience | routing-artifact.json | RR009 | false (skips if absent) |
| `cross-component` | a11y-test | component-artifact.json | A1007 | false (skips if absent) |

---

## Artifact Schemas

| Artifact | Schema ID | Key fields |
|---|---|---|
| `schema-artifact.json` | `schema-artifact-v1` | `entity`, `fields[]`, `zod_exports[]`, `ts_exports[]` |
| `component-artifact.json` | `component-artifact-v1` | `name`, `props[]`, `a11y_compliant`, `coverage` |
| `route-artifact.json` | `route-artifact-v1` | `method`, `path`, `auth`, `input_schema`, `output_schema`, `coverage` |
| `auth-artifact.json` | `auth-artifact-v1` | `strategy`, `exports[]`, `coverage`, `timing_safe` |
| `migration-artifact.json` | `migration-artifact-v1` | `version`, `table`, `operation`, `columns[]`, `rollback_complete`, `idempotent` |
| `form-artifact.json` | `form-artifact-v1` | `name`, `fields[]`, `submit_route`, `auth`, `schema_aligned`, `route_aligned`, `coverage` |

All artifacts include: `gates_passed[]`, `compiled_at`, `compiler_version`, `attestation_hash`.

---

## Error Code Index

| Code | Compiler | Meaning |
|---|---|---|
| SC001 | ts-schema | schema-spec.json missing or invalid |
| SC002 | ts-schema | schema.ts parse error |
| SC003 | ts-schema | Zod schema invalid |
| SC004 | ts-schema | TypeScript errors in schema.ts |
| SC005 | ts-schema | `any` type used in schema |
| SC006 | ts-schema | TODO/FIXME found |
| SC007 | ts-schema | Schema not exported correctly |
| SC008 | ts-schema | Schema spec declares fields not in schema.ts |
| SC009 | ts-schema | Tests failed |
| SC010 | ts-schema | Coverage below threshold |
| SC011 | ts-schema | Schema contract violation |
| RC001 | react-component | component-spec.json missing or invalid |
| RC002 | react-component | Schema file invalid |
| RC003 | react-component | TypeScript errors |
| RC004 | react-component | `any` type used |
| RC005 | react-component | Missing aria-label / accessible name |
| RC006 | react-component | TODO/FIXME found |
| RC007 | react-component | Tests failed |
| RC008 | react-component | Coverage below threshold |
| RC009 | react-component | Props contract violation |
| RC010 | react-component | A11y contract violation |
| RC011 | react-component | Component props conflict with schema fields |
| AR001 | api-route | route-spec.json missing or invalid |
| AR002 | api-route | Schema file invalid |
| AR003 | api-route | Auth middleware missing on protected route |
| AR004 | api-route | HTTP status codes incorrect |
| AR005 | api-route | Raw SQL detected |
| AR006 | api-route | TODO/FIXME found |
| AR007 | api-route | OpenAPI shape invalid |
| AR008 | api-route | Tests failed |
| AR009 | api-route | Coverage below threshold |
| AR010 | api-route | Input used without schema validation |
| AR011 | api-route | Route contract violation |
| AR012 | api-route | Route input/output fields conflict with schema |
| AR013 | api-route | Protected route missing compiled auth-middleware artifact |
| AR014 | api-route | Route uses DB but missing compiled db-migration artifact |
| AM001 | auth-middleware | auth-spec.json missing or invalid |
| AM002 | auth-middleware | Hardcoded secret detected |
| AM003 | auth-middleware | Missing required exports |
| AM004 | auth-middleware | Token decoded without verify (expiry bypass) |
| AM005 | auth-middleware | TODO/FIXME found |
| AM006 | auth-middleware | Error not typed (catch block uses `any`) |
| AM007 | auth-middleware | Tests failed |
| AM008 | auth-middleware | API key comparison not timing-safe |
| AM009 | auth-middleware | Token value logged (secret leak) |
| AM010 | auth-middleware | Coverage below 85% threshold |
| AM011 | auth-middleware | Auth contract violation |
| DM001 | db-migration | migration-spec.json missing or invalid |
| DM002 | db-migration | Migration columns conflict with schema fields |
| DM003 | db-migration | up.sql missing or invalid |
| DM004 | db-migration | down.sql missing or invalid |
| DM005 | db-migration | TODO/FIXME found |
| DM006 | db-migration | Destructive column change detected |
| DM007 | db-migration | Migration not idempotent (missing IF NOT EXISTS) |
| DM008 | db-migration | Rollback incomplete (missing DROP for CREATE) |
| DM009 | db-migration | Primary key is nullable |
| DM010 | db-migration | Foreign key column missing index |
| DM011 | db-migration | Migration version not sequential |
| DM012 | db-migration | Migration contract violation |
| RF001 | react-form | form-spec.json missing or invalid |
| RF002 | react-form | form-schema.ts invalid or missing Zod exports |
| RF003 | react-form | TypeScript errors in Form.tsx |
| RF004 | react-form | Untyped `any` in form files |
| RF005 | react-form | Input field missing label or aria-label |
| RF006 | react-form | Validation errors not displayed per-field |
| RF007 | react-form | TODO/FIXME/HACK found in implementation |
| RF008 | react-form | Form tests failed |
| RF009 | react-form | Form fields conflict with schema-artifact fields |
| RF010 | react-form | Form submit payload does not satisfy route input schema |
| RF011 | react-form | Submit handler missing or is a no-op |
| RF012 | react-form | Form contract violation (loading state, a11y, error boundary) |
| QM001 | query-module | Invalid query spec |
| QM002 | query-module | Hook name must start with 'use'; queryKey must be exported |
| QM003 | query-module | queryKey must be array; all params must appear in it |
| QM004 | query-module | TypeScript compilation failed |
| QM005 | query-module | Explicit 'any' type found |
| QM006 | query-module | Required params present but no enabled guard |
| QM007 | query-module | Mutation side-effect in query fetcher |
| QM008 | query-module | TODO/FIXME found |
| QM009 | query-module | Tests failed |
| QM010 | query-module | Coverage below threshold |
| QM011 | query-module | Endpoint/response type mismatch with route-artifact |
| QM012 | query-module | Contract violation |
| MU001 | mutation-module | Invalid mutation spec |
| MU002 | mutation-module | Hook name must start with 'use' and end with 'Mutation' |
| MU003 | mutation-module | TypeScript compilation failed |
| MU004 | mutation-module | Explicit 'any' type found |
| MU005 | mutation-module | No invalidateQueries in onSuccess |
| MU006 | mutation-module | Optimistic update missing onError rollback |
| MU007 | mutation-module | No onError handler |
| MU008 | mutation-module | TODO/FIXME found |
| MU009 | mutation-module | Tests failed |
| MU010 | mutation-module | Coverage below threshold |
| MU011 | mutation-module | Payload type mismatch with route-artifact |
| MU012 | mutation-module | invalidateQueries keys don't match query-artifact queryKeys |
| MU013 | mutation-module | Contract violation |
| SS001 | state-store | Invalid store spec |
| SS002 | state-store | Store/slice naming invalid |
| SS003 | state-store | TypeScript compilation failed |
| SS004 | state-store | Explicit 'any' type found |
| SS005 | state-store | Mutable state update without Immer |
| SS006 | state-store | Async logic in sync reducer |
| SS007 | state-store | Impure selector |
| SS008 | state-store | TODO/FIXME found |
| SS009 | state-store | Tests failed |
| SS010 | state-store | Coverage below threshold |
| SS011 | state-store | State shape mismatch with ts-schema-artifact |
| SS012 | state-store | Contract violation |
| RC001 | routing-config | Invalid routing spec |
| RC002 | routing-config | TypeScript compilation failed |
| RC003 | routing-config | Explicit 'any' type found |
| RC004 | routing-config | Dead route detected |
| RC005 | routing-config | Cyclic redirect detected |
| RC006 | routing-config | Top-level route not lazy-loaded |
| RC007 | routing-config | Path param without TypeScript type |
| RC008 | routing-config | TODO/FIXME found |
| RC009 | routing-config | Tests failed |
| RC010 | routing-config | Route references page not in page-artifact |
| RC011 | routing-config | Protected route missing auth guard |
| RC012 | routing-config | Contract violation |
| DT001 | design-tokens | Invalid tokens spec |
| DT002 | design-tokens | Token naming convention violation |
| DT003 | design-tokens | TypeScript compilation failed |
| DT004 | design-tokens | WCAG AA contrast ratio not met |
| DT005 | design-tokens | Token key collision |
| DT006 | design-tokens | Dark mode token missing for light counterpart |
| DT007 | design-tokens | TODO/FIXME found |
| DT008 | design-tokens | Contract violation |
| SK001 | loading-skeleton | Invalid skeleton spec |
| SK002 | loading-skeleton | TypeScript compilation failed |
| SK003 | loading-skeleton | Explicit 'any' found |
| SK004 | loading-skeleton | Missing aria-busy="true" |
| SK005 | loading-skeleton | Shimmer animation ignores prefers-reduced-motion |
| SK006 | loading-skeleton | Skeleton shape mismatch with target component |
| SK007 | loading-skeleton | Real data in skeleton |
| SK008 | loading-skeleton | TODO/FIXME found |
| SK009 | loading-skeleton | Tests failed |
| SK010 | loading-skeleton | Target component-artifact not found |
| SK011 | loading-skeleton | Contract violation |
| AN001 | animation-spec | Invalid animation spec |
| AN002 | animation-spec | TypeScript compilation failed |
| AN003 | animation-spec | Explicit 'any' found |
| AN004 | animation-spec | Invalid easing (not cubic-bezier or named preset) |
| AN005 | animation-spec | Animating layout-thrashing property (width/height/top/left) |
| AN006 | animation-spec | Duration out of bounds (must be 50ms–2000ms) |
| AN007 | animation-spec | No reduced-motion handling |
| AN008 | animation-spec | TODO/FIXME found |
| AN009 | animation-spec | Tests failed |
| AN010 | animation-spec | component-artifact not found |
| AN011 | animation-spec | Contract violation |
| LC001 | layout-component | Invalid layout spec |
| LC002 | layout-component | TypeScript compilation failed |
| LC003 | layout-component | Explicit 'any' found |
| LC004 | layout-component | Slot not typed as ReactNode or not rendered |
| LC005 | layout-component | Missing responsive breakpoints |
| LC006 | layout-component | Inline style used (use Tailwind classes) |
| LC007 | layout-component | TODO/FIXME found |
| LC008 | layout-component | Tests failed |
| LC009 | layout-component | component-artifact not found |
| LC010 | layout-component | Contract violation |
| UF001 | utility-fn | Invalid utility spec |
| UF002 | utility-fn | TypeScript compilation failed |
| UF003 | utility-fn | Explicit 'any' found |
| UF004 | utility-fn | Side-effect in pure function |
| UF005 | utility-fn | React/Next.js import in utility function |
| UF006 | utility-fn | Function not exported |
| UF007 | utility-fn | TODO/FIXME found |
| UF008 | utility-fn | Tests failed |
| UF009 | utility-fn | Coverage below 100% threshold |
| UF010 | utility-fn | Contract violation |
| I1001 | i18n | Invalid i18n spec |
| I1002 | i18n | TypeScript compilation failed |
| I1003 | i18n | Key parity mismatch between locales |
| I1004 | i18n | Interpolation variable mismatch between locales |
| I1005 | i18n | Empty translation value |
| I1006 | i18n | TODO/FIXME found |
| I1007 | i18n | Tests failed |
| I1008 | i18n | Contract violation |
| IV001 | invalidation-map | Invalid invalidation-map spec |
| IV002 | invalidation-map | Query key referenced in map has no corresponding query-artifact |
| IV003 | invalidation-map | Mutation referenced in map has no corresponding mutation-artifact |
| IV004 | invalidation-map | Circular invalidation detected |
| IV005 | invalidation-map | Query artifact mismatch |
| IV006 | invalidation-map | Mutation artifact mismatch |
| IV007 | invalidation-map | Contract violation |
| RG001 | route-guard | Invalid guard spec |
| RG002 | route-guard | TypeScript compilation failed |
| RG003 | route-guard | Explicit 'any' found |
| RG004 | route-guard | No redirect on unauthenticated |
| RG005 | route-guard | Flash of protected content |
| RG006 | route-guard | No loading state while auth resolves |
| RG007 | route-guard | TODO/FIXME found |
| RG008 | route-guard | Tests failed |
| RG009 | route-guard | auth-artifact not found |
| RG010 | route-guard | routing-artifact not found |
| RG011 | route-guard | Contract violation |
| PR001 | providers-scaffold | Invalid providers spec |
| PR002 | providers-scaffold | TypeScript compilation failed |
| PR003 | providers-scaffold | Explicit 'any' found |
| PR004 | providers-scaffold | Provider order violation |
| PR005 | providers-scaffold | Duplicate provider detected |
| PR006 | providers-scaffold | QueryClient missing retry/staleTime config |
| PR007 | providers-scaffold | TODO/FIXME found |
| PR008 | providers-scaffold | Tests failed |
| PR009 | providers-scaffold | Contract violation |
| SB001 | storybook-story | Invalid story spec |
| SB002 | storybook-story | TypeScript compilation failed |
| SB003 | storybook-story | Not valid CSF3 format |
| SB004 | storybook-story | Story args not typed with component Props type |
| SB005 | storybook-story | a11y addon parameters missing |
| SB006 | storybook-story | TODO/FIXME found |
| SB007 | storybook-story | component-artifact not found |
| SB008 | storybook-story | Contract violation |
| AE001 | analytics-event | Invalid analytics spec |
| AE002 | analytics-event | TypeScript compilation failed |
| AE003 | analytics-event | Explicit 'any' found |
| AE004 | analytics-event | Event name not SCREAMING_SNAKE_CASE |
| AE005 | analytics-event | PII field detected in event payload |
| AE006 | analytics-event | Required base properties missing |
| AE007 | analytics-event | TODO/FIXME found |
| AE008 | analytics-event | Tests failed |
| AE009 | analytics-event | Contract violation |
| FF001 | feature-flag | Invalid flag spec |
| FF002 | feature-flag | TypeScript compilation failed |
| FF003 | feature-flag | Explicit 'any' found |
| FF004 | feature-flag | Flag missing safe default value |
| FF005 | feature-flag | Flag name not kebab-case |
| FF006 | feature-flag | Nested flag dependency detected |
| FF007 | feature-flag | TODO/FIXME found |
| FF008 | feature-flag | Tests failed |
| FF009 | feature-flag | Contract violation |
| NC001 | navigation-config | Invalid navigation spec |
| NC002 | navigation-config | TypeScript compilation failed |
| NC003 | navigation-config | Explicit 'any' found |
| NC004 | navigation-config | Nav item points to unregistered route |
| NC005 | navigation-config | No active-state logic (aria-current missing) |
| NC006 | navigation-config | Navigation not keyboard accessible |
| NC007 | navigation-config | TODO/FIXME found |
| NC008 | navigation-config | Tests failed |
| NC009 | navigation-config | routing-artifact not found |
| NC010 | navigation-config | Contract violation |
| RR001 | route-resilience | Invalid resilience spec |
| RR002 | route-resilience | TypeScript compilation failed |
| RR003 | route-resilience | Explicit 'any' found |
| RR004 | route-resilience | No ErrorBoundary wrapping route |
| RR005 | route-resilience | No 404/NotFound route |
| RR006 | route-resilience | No Suspense fallback for lazy routes |
| RR007 | route-resilience | TODO/FIXME found |
| RR008 | route-resilience | Tests failed |
| RR009 | route-resilience | routing-artifact not found |
| RR010 | route-resilience | Contract violation |
| A1001 | a11y-test | Invalid a11y spec |
| A1002 | a11y-test | axe-core test not found |
| A1003 | a11y-test | No keyboard navigation test |
| A1004 | a11y-test | No focus management test |
| A1005 | a11y-test | TODO/FIXME found |
| A1006 | a11y-test | Tests failed |
| A1007 | a11y-test | component-artifact not found |
| A1008 | a11y-test | Contract violation |
| USP001 | url-searchparams-contract | Invalid searchparams spec |
| USP002 | url-searchparams-contract | TypeScript compilation failed |
| USP003 | url-searchparams-contract | Explicit 'any' found |
| USP004 | url-searchparams-contract | parse() has unguarded throw |
| USP005 | url-searchparams-contract | serialize() is non-canonical |
| USP006 | url-searchparams-contract | Default values not omitted from URL |
| USP007 | url-searchparams-contract | TODO/FIXME found |
| USP008 | url-searchparams-contract | Tests failed |
| USP009 | url-searchparams-contract | Contract violation |
| UT001 | unit-test-module | Invalid unit test spec |
| UT002 | unit-test-module | Uses getByTestId/className instead of getByRole |
| UT003 | unit-test-module | Real network call in unit test |
| UT004 | unit-test-module | Shared mutable state between tests |
| UT005 | unit-test-module | Weak assertion (toBeTruthy/toBeFalsy) |
| UT006 | unit-test-module | TODO/FIXME found |
| UT007 | unit-test-module | Tests failed |
| UT008 | unit-test-module | Contract violation |
| EB001 | error-boundary-wrapper | Invalid error boundary spec |
| EB002 | error-boundary-wrapper | TypeScript compilation failed |
| EB003 | error-boundary-wrapper | Explicit 'any' found |
| EB004 | error-boundary-wrapper | Not a class component or react-error-boundary |
| EB005 | error-boundary-wrapper | Fallback component can throw |
| EB006 | error-boundary-wrapper | Error reporting uses console.log only |
| EB007 | error-boundary-wrapper | TODO/FIXME found |
| EB008 | error-boundary-wrapper | Tests failed |
| EB009 | error-boundary-wrapper | Contract violation |
| SH001 | security-safe-html-module | Invalid safe-html spec |
| SH002 | security-safe-html-module | TypeScript compilation failed |
| SH003 | security-safe-html-module | Explicit 'any' found |
| SH004 | security-safe-html-module | Raw innerHTML without sanitization |
| SH005 | security-safe-html-module | href/src without URL allowlist |
| SH006 | security-safe-html-module | No XSS test vectors |
| SH007 | security-safe-html-module | TODO/FIXME found |
| SH008 | security-safe-html-module | Tests failed |
| SH009 | security-safe-html-module | Contract violation |
| FM001 | feature-module-scaffold | Invalid feature module spec |
| FM002 | feature-module-scaffold | Barrel uses export * or missing index.ts |
| FM003 | feature-module-scaffold | Missing capability files |
| FM004 | feature-module-scaffold | Cross-feature import detected |
| FM005 | feature-module-scaffold | Private symbols leaked through barrel |
| FM006 | feature-module-scaffold | TODO/FIXME found |
| FM007 | feature-module-scaffold | Contract violation |
| TC001 | testing-harness-config | Invalid test harness spec |
| TC002 | testing-harness-config | vitest.config.ts missing or incomplete |
| TC003 | testing-harness-config | @testing-library/jest-dom not configured |
| TC004 | testing-harness-config | Coverage not configured with thresholds |
| TC005 | testing-harness-config | TODO/FIXME found |
| TC006 | testing-harness-config | Contract violation |
| SBC001 | storybook-harness-config | Invalid storybook harness spec |
| SBC002 | storybook-harness-config | .storybook/main.ts missing or incomplete |
| SBC003 | storybook-harness-config | Storybook not TypeScript |
| SBC004 | storybook-harness-config | @storybook/addon-a11y not installed |
| SBC005 | storybook-harness-config | TODO/FIXME found |
| SBC006 | storybook-harness-config | Contract violation |
| AH001 | a11y-harness-config | Invalid a11y harness spec |
| AH002 | a11y-harness-config | axe library not installed or not used in tests |
| AH003 | a11y-harness-config | WCAG level not declared |
| AH004 | a11y-harness-config | @storybook/addon-a11y missing when Storybook used |
| AH005 | a11y-harness-config | TODO/FIXME found |
| AH006 | a11y-harness-config | storybook-harness-config compiler failed |
| AH007 | a11y-harness-config | Contract violation |
| SW001 | swr-resource-module | Invalid SWR resource spec |
| SW002 | swr-resource-module | TypeScript compilation failed |
| SW003 | swr-resource-module | Explicit 'any' found |
| SW004 | swr-resource-module | SWR key is not parameterized |
| SW005 | swr-resource-module | Revalidation strategy not declared |
| SW006 | swr-resource-module | Direct SWR cache manipulation |
| SW007 | swr-resource-module | SWR state not properly destructured |
| SW008 | swr-resource-module | TODO/FIXME found |
| SW009 | swr-resource-module | Tests failed |
| SW010 | swr-resource-module | Contract violation |
| EV001 | experiment-variant-wrapper | Invalid experiment variant spec |
| EV002 | experiment-variant-wrapper | TypeScript compilation failed |
| EV003 | experiment-variant-wrapper | Explicit 'any' found |
| EV004 | experiment-variant-wrapper | No fallback/control variant |
| EV005 | experiment-variant-wrapper | Exposure tracking not in useEffect or fires multiple times |
| EV006 | experiment-variant-wrapper | Branching sprawl (>5 variants) or nested experiments |
| EV007 | experiment-variant-wrapper | TODO/FIXME found |
| EV008 | experiment-variant-wrapper | Tests failed |
| EV009 | experiment-variant-wrapper | feature-flag-config compiler failed |
| EV010 | experiment-variant-wrapper | Contract violation |
| DS001 | data-schema | data-schema-spec.json missing or invalid |
| DS002 | data-schema | Column missing explicit dtype |
| DS003 | data-schema | Nullable column missing null_strategy |
| DS004 | data-schema | No primary key defined |
| DS005 | data-schema | Numeric column missing range constraints |
| DS006 | data-schema | Category column missing allowed_values |
| DS007 | data-schema | PII column unmasked |
| DS008 | data-schema | TODO/FIXME found |
| DS009 | data-schema | Contract violation |
| DI001 | data-ingestion-script | ingestion-spec.json missing or invalid |
| DI002 | data-ingestion-script | Hardcoded absolute path detected |
| DI003 | data-ingestion-script | Missing if __name__ == '__main__' guard |
| DI004 | data-ingestion-script | print() used instead of logging |
| DI005 | data-ingestion-script | Write to /raw/ directory |
| DI006 | data-ingestion-script | Append-mode write (non-idempotent) |
| DI007 | data-ingestion-script | No schema validation at load time |
| DI008 | data-ingestion-script | TODO/FIXME found |
| DI009 | data-ingestion-script | Contract violation |
| DV001 | data-validation-module | validation-spec.json missing or invalid |
| DV002 | data-validation-module | No schema/expectation definition |
| DV003 | data-validation-module | Critical column not covered |
| DV004 | data-validation-module | Silent failure (except: pass) |
| DV005 | data-validation-module | No report generated |
| DV006 | data-validation-module | Upstream schema-ds artifact failed |
| DV007 | data-validation-module | TODO/FIXME found |
| DV008 | data-validation-module | Contract violation |
| DP001 | data-pipeline-script | pipeline-spec.json missing or invalid |
| DP002 | data-pipeline-script | Hardcoded absolute path |
| DP003 | data-pipeline-script | Missing main guard |
| DP004 | data-pipeline-script | print() used instead of logging |
| DP005 | data-pipeline-script | Write to /raw/ directory |
| DP006 | data-pipeline-script | Append-mode write (non-idempotent) |
| DP007 | data-pipeline-script | No schema boundary validation |
| DP008 | data-pipeline-script | Bare except: block |
| DP009 | data-pipeline-script | TODO/FIXME found |
| DP010 | data-pipeline-script | Contract violation |
| EN001 | eda-notebook | eda-spec.json missing or invalid |
| EN002 | eda-notebook | Required notebook sections missing |
| EN003 | eda-notebook | Write to /raw/ directory |
| EN004 | eda-notebook | No random seed |
| EN005 | eda-notebook | No missing value analysis |
| EN006 | eda-notebook | No distribution analysis |
| EN007 | eda-notebook | No correlation analysis |
| EN008 | eda-notebook | No findings documented |
| EN009 | eda-notebook | TODO/FIXME found |
| EN010 | eda-notebook | Contract violation |
| JN001 | jupyter-notebook-module | jupyter-notebook-spec.json missing or invalid |
| JN002 | jupyter-notebook-module | Non-linear cell execution order |
| JN003 | jupyter-notebook-module | Insufficient markdown documentation |
| JN004 | jupyter-notebook-module | Outputs not cleared (embedded images) |
| JN005 | jupyter-notebook-module | Logic not extracted into functions |
| JN006 | jupyter-notebook-module | Global mutation pattern (inplace=True) |
| JN007 | jupyter-notebook-module | Reproducibility seed not set |
| JN008 | jupyter-notebook-module | TODO/FIXME found |
| JN009 | jupyter-notebook-module | Contract violation |
| ST001 | statistical-test-module | statistical-test-spec.json missing or invalid |
| ST002 | statistical-test-module | H0/H1 not defined |
| ST003 | statistical-test-module | No power analysis / sample size calculation |
| ST004 | statistical-test-module | Test selection not justified |
| ST005 | statistical-test-module | No effect size reported |
| ST006 | statistical-test-module | No confidence intervals |
| ST007 | statistical-test-module | p-value reported without effect size |
| ST008 | statistical-test-module | Multiple tests without correction |
| ST009 | statistical-test-module | TODO/FIXME found |
| ST010 | statistical-test-module | Contract violation |
| AB001 | ab-test-analysis | ab-test-spec.json missing or invalid |
| AB002 | ab-test-analysis | No control group defined |
| AB003 | ab-test-analysis | No sample size pre-calculation |
| AB004 | ab-test-analysis | No SRM check or manual assignment |
| AB005 | ab-test-analysis | Primary metric not defined or used |
| AB006 | ab-test-analysis | No guardrail metrics |
| AB007 | ab-test-analysis | Missing significance test / effect size / power / CI |
| AB008 | ab-test-analysis | TODO/FIXME found |
| AB009 | ab-test-analysis | Contract violation |
| FP001 | feature-pipeline | feature-pipeline-spec.json missing or invalid |
| FP002 | feature-pipeline | sklearn Pipeline not used |
| FP003 | feature-pipeline | Chained assignment (.ix[] or df['col']['row']) |
| FP004 | feature-pipeline | .fit(X_test) detected |
| FP005 | feature-pipeline | Target leakage in feature transformers |
| FP006 | feature-pipeline | fit() outside Pipeline on non-train data |
| FP007 | feature-pipeline | Stochastic transformer without random_state |
| FP008 | feature-pipeline | Feature names not exported |
| FP009 | feature-pipeline | TODO/FIXME found |
| FP010 | feature-pipeline | Contract violation |
| FS001 | feature-store-module | feature-store-spec.json missing or invalid |
| FS002 | feature-store-module | Feature group not versioned |
| FS003 | feature-store-module | Entity key missing or not used |
| FS004 | feature-store-module | Training-serving skew risk |
| FS005 | feature-store-module | No TTL defined for online features |
| FS006 | feature-store-module | TODO/FIXME found |
| FS007 | feature-store-module | Upstream feature-pipeline artifact failed |
| FS008 | feature-store-module | Contract violation |
| SP001 | dataset-split-module | split-spec.json missing or invalid |
| SP002 | dataset-split-module | Fit before split (data leakage) |
| SP003 | dataset-split-module | No random_state in train_test_split |
| SP004 | dataset-split-module | .fit(X_test) detected |
| SP005 | dataset-split-module | Classification without stratify=y |
| SP006 | dataset-split-module | Time-series without temporal split |
| SP007 | dataset-split-module | Split ratios not documented |
| SP008 | dataset-split-module | TODO/FIXME found |
| SP009 | dataset-split-module | Contract violation |
| MT001 | model-training-script | training-spec.json missing or invalid |
| MT002 | model-training-script | No random seed set |
| MT003 | model-training-script | sklearn Pipeline not used (non-DL) |
| MT004 | model-training-script | Missing main guard |
| MT005 | model-training-script | .fit(X_test) detected |
| MT006 | model-training-script | Hardcoded hyperparameters |
| MT007 | model-training-script | No experiment tracking (MLflow/W&B) |
| MT008 | model-training-script | Model not serialized |
| MT009 | model-training-script | TODO/FIXME found |
| MT010 | model-training-script | Contract violation |
| EC001 | experiment-config | experiment-spec.json missing or invalid |
| EC002 | experiment-config | No config file (YAML/JSON) found |
| EC003 | experiment-config | Hyperparameters missing comments |
| EC004 | experiment-config | No random_state/seed in config |
| EC005 | experiment-config | Hardcoded hyperparameters in training code |
| EC006 | experiment-config | No search space defined |
| EC007 | experiment-config | TODO/FIXME found |
| EC008 | experiment-config | Contract violation |
| ME001 | model-evaluation-report | evaluation-spec.json missing or invalid |
| ME002 | model-evaluation-report | Predictions on training set |
| ME003 | model-evaluation-report | .fit(X_test) during evaluation |
| ME004 | model-evaluation-report | Insufficient metrics (need F1+precision+recall or RMSE+MAE+R²) |
| ME005 | model-evaluation-report | No baseline comparison |
| ME006 | model-evaluation-report | No confusion matrix or residual plot |
| ME007 | model-evaluation-report | No confidence intervals |
| ME008 | model-evaluation-report | No findings documented |
| ME009 | model-evaluation-report | TODO/FIXME found |
| ME010 | model-evaluation-report | Contract violation |
| MR001 | model-registry-entry | registry-spec.json missing or invalid |
| MR002 | model-registry-entry | No serialized model artifact |
| MR003 | model-registry-entry | No metadata (params/metrics) |
| MR004 | model-registry-entry | Model below performance threshold |
| MR005 | model-registry-entry | No model card linked |
| MR006 | model-registry-entry | No reproducibility hash/run ID |
| MR007 | model-registry-entry | No version tagged |
| MR008 | model-registry-entry | TODO/FIXME found |
| MR009 | model-registry-entry | Contract violation |
| SA001 | serving-api-module | serving-spec.json missing or invalid |
| SA002 | serving-api-module | Input not validated (no Pydantic/marshmallow) |
| SA003 | serving-api-module | No typed response schema |
| SA004 | serving-api-module | No /health or /ping endpoint |
| SA005 | serving-api-module | Model loaded per-request (anti-pattern) |
| SA006 | serving-api-module | Bare except: block |
| SA007 | serving-api-module | print() instead of logging |
| SA008 | serving-api-module | max_latency_ms not defined |
| SA009 | serving-api-module | TODO/FIXME found |
| SA010 | serving-api-module | Contract violation |
| MM001 | model-monitoring-config | monitoring-spec.json missing or invalid |
| MM002 | model-monitoring-config | No baseline distribution |
| MM003 | model-monitoring-config | No drift metric defined |
| MM004 | model-monitoring-config | alert_threshold not a positive number |
| MM005 | model-monitoring-config | No retraining trigger defined |
| MM006 | model-monitoring-config | No data quality checks |
| MM007 | model-monitoring-config | TODO/FIXME found |
| MM008 | model-monitoring-config | Contract violation |
| MC001 | model-card | model-card-spec.json missing or invalid |
| MC002 | model-card | MODEL_CARD.md not found or too short |
| MC003 | model-card | Required sections missing |
| MC004 | model-card | No numeric performance metrics |
| MC005 | model-card | Intended use / out-of-scope not documented |
| MC006 | model-card | Bias/fairness not documented |
| MC007 | model-card | TODO/FIXME found |
| MC008 | model-card | Model registry entry failed |
| MC009 | model-card | Contract violation |
| ES001 | env_schema | env-schema-spec.json missing or invalid |
| ES002 | env_schema | Duplicate env key names |
| ES003 | env_schema | Invalid type value |
| ES004 | env_schema | Default value type mismatch |
| ES005 | env_schema | Secret value as default (plaintext secret) |
| ES006 | env_schema | TODO/FIXME found |
| ES007 | env_schema | Env schema contract violation |
| DF001 | dockerfile_image | dockerfile-spec.json missing or invalid |
| DF002 | dockerfile_image | Dockerfile not found |
| DF003 | dockerfile_image | Multiple ENTRYPOINT/CMD in final stage |
| DF004 | dockerfile_image | Base image not pinned to digest |
| DF005 | dockerfile_image | Container runs as root |
| DF006 | dockerfile_image | Secret/credential in RUN command |
| DF007 | dockerfile_image | .dockerignore missing |
| DF008 | dockerfile_image | Exposed ports don't match spec |
| DF009 | dockerfile_image | TODO/FIXME found |
| DF010 | dockerfile_image | Dockerfile contract violation |
| CIP001 | ci_cd_pipeline | ci-cd-spec.json missing or invalid |
| CIP002 | ci_cd_pipeline | No trigger defined |
| CIP003 | ci_cd_pipeline | Jobs not organized into stages |
| CIP004 | ci_cd_pipeline | Cyclic job dependency detected |
| CIP005 | ci_cd_pipeline | Secret literal in pipeline config |
| CIP006 | ci_cd_pipeline | Missing required quality gate (test, lint, or scan) |
| CIP007 | ci_cd_pipeline | TODO/FIXME found |
| CIP008 | ci_cd_pipeline | CI/CD pipeline contract violation |
| IAC001 | iac_stack_definition | iac-spec.json missing or invalid |
| IAC002 | iac_stack_definition | Undeclared inputs in Terraform files |
| IAC003 | iac_stack_definition | Undeclared outputs in Terraform files |
| IAC004 | iac_stack_definition | Unresolved resource references |
| IAC005 | iac_stack_definition | Hardcoded credentials in IaC |
| IAC006 | iac_stack_definition | Provider not in allowlist |
| IAC007 | iac_stack_definition | TODO/FIXME found |
| IAC008 | iac_stack_definition | IaC stack contract violation |
| SB001 | secret_bundle | secret-bundle-spec.json missing or invalid |
| SB002 | secret_bundle | Secret key not mapped to env-schema |
| SB003 | secret_bundle | Non-unique namespace |
| SB004 | secret_bundle | Plaintext secret value in YAML |
| SB005 | secret_bundle | Invalid secret path for source type |
| SB006 | secret_bundle | TODO/FIXME found |
| SB007 | secret_bundle | Secret bundle contract violation |
| VP001 | vault_policy | vault-policy-spec.json missing or invalid |
| VP002 | vault_policy | Path outside allowed prefix |
| VP003 | vault_policy | Wildcard path detected |
| VP004 | vault_policy | Disallowed capability |
| VP005 | vault_policy | Excessive capabilities (not least-privilege) |
| VP006 | vault_policy | Role references undeclared role |
| VP007 | vault_policy | TODO/FIXME found |
| VP008 | vault_policy | Vault policy contract violation |
| DNS001 | network_dns_config | dns-config-spec.json missing or invalid |
| DNS002 | network_dns_config | Hostname not a valid FQDN |
| DNS003 | network_dns_config | Duplicate hostname |
| DNS004 | network_dns_config | Record target unresolvable |
| DNS005 | network_dns_config | TTL out of bounds |
| DNS006 | network_dns_config | TLS hostname mismatch |
| DNS007 | network_dns_config | TODO/FIXME found |
| DNS008 | network_dns_config | DNS config contract violation |
| KW001 | kubernetes_workload | k8s-workload-spec.json missing or invalid |
| KW002 | kubernetes_workload | Selector labels don't match template labels |
| KW003 | kubernetes_workload | Container missing resource requests/limits |
| KW004 | kubernetes_workload | Image reference not valid |
| KW005 | kubernetes_workload | ConfigMap/Secret ref not declared |
| KW006 | kubernetes_workload | Invalid rollout strategy |
| KW007 | kubernetes_workload | TODO/FIXME found |
| KW008 | kubernetes_workload | K8s workload contract violation |
| KS001 | kubernetes_service | k8s-service-spec.json missing or invalid |
| KS002 | kubernetes_service | Selector doesn't resolve to workload |
| KS003 | kubernetes_service | Invalid port definition |
| KS004 | kubernetes_service | Duplicate port numbers |
| KS005 | kubernetes_service | Service type not allowed |
| KS006 | kubernetes_service | TODO/FIXME found |
| KS007 | kubernetes_service | K8s service contract violation |
| KI001 | kubernetes_ingress_gateway | k8s-ingress-spec.json missing or invalid |
| KI002 | kubernetes_ingress_gateway | Backend service not found in service artifact |
| KI003 | kubernetes_ingress_gateway | Invalid hostname (not FQDN) |
| KI004 | kubernetes_ingress_gateway | TLS hostname mismatch |
| KI005 | kubernetes_ingress_gateway | Invalid path rule |
| KI006 | kubernetes_ingress_gateway | TODO/FIXME found |
| KI007 | kubernetes_ingress_gateway | K8s ingress contract violation |
| PC001 | healthcheck_probe_config | probe-config-spec.json missing or invalid |
| PC002 | healthcheck_probe_config | Probe port not in service ports |
| PC003 | healthcheck_probe_config | Probe schema invalid |
| PC004 | healthcheck_probe_config | Threshold/timing value invalid |
| PC005 | healthcheck_probe_config | Missing liveness or readiness probe |
| PC006 | healthcheck_probe_config | TODO/FIXME found |
| PC007 | healthcheck_probe_config | Probe config contract violation |
| BW001 | background_worker_runtime | worker-runtime-spec.json missing or invalid |
| BW002 | background_worker_runtime | Image reference invalid |
| BW003 | background_worker_runtime | Queue binding invalid |
| BW004 | background_worker_runtime | Autoscaling bounds invalid |
| BW005 | background_worker_runtime | Worker exposes HTTP ports |
| BW006 | background_worker_runtime | Graceful shutdown period not set |
| BW007 | background_worker_runtime | TODO/FIXME found |
| BW008 | background_worker_runtime | Worker runtime contract violation |
| HC001 | helm_chart | helm-chart-spec.json missing or invalid |
| HC002 | helm_chart | Chart.yaml missing or invalid |
| HC003 | helm_chart | values.yaml missing or invalid |
| HC004 | helm_chart | Templates contain render errors |
| HC005 | helm_chart | Unresolved template expressions |
| HC006 | helm_chart | .Values key referenced but not in values.yaml |
| HC007 | helm_chart | TODO/FIXME found |
| HC008 | helm_chart | Helm chart contract violation |
| KO001 | kustomize_overlay | kustomize-overlay-spec.json missing or invalid |
| KO002 | kustomize_overlay | kustomization.yaml missing or invalid |
| KO003 | kustomize_overlay | Patch target not found |
| KO004 | kustomize_overlay | Duplicate resource reference |
| KO005 | kustomize_overlay | Namespace doesn't match environment |
| KO006 | kustomize_overlay | TODO/FIXME found |
| KO007 | kustomize_overlay | Kustomize overlay contract violation |
| SJ001 | scheduled_job | scheduled-job-spec.json missing or invalid |
| SJ002 | scheduled_job | Cron expression invalid |
| SJ003 | scheduled_job | Job template invalid |
| SJ004 | scheduled_job | Concurrency policy not set |
| SJ005 | scheduled_job | Resource limits invalid |
| SJ006 | scheduled_job | Undeclared secret reference |
| SJ007 | scheduled_job | TODO/FIXME found |
| SJ008 | scheduled_job | Scheduled job contract violation |
| DS001 | data_seed_job | data-seed-spec.json missing or invalid |
| DS002 | data_seed_job | Seed command file not found |
| DS003 | data_seed_job | Idempotency strategy not declared |
| DS004 | data_seed_job | Targets production environment |
| DS005 | data_seed_job | Database reference not declared |
| DS006 | data_seed_job | TODO/FIXME found |
| DS007 | data_seed_job | Data seed job contract violation |
| MR001 | db_migration_runner | db-migration-runner-spec.json missing or invalid |
| MR002 | db_migration_runner | Migration directory not found |
| MR003 | db_migration_runner | Migration tool not in allowlist |
| MR004 | db_migration_runner | Credentials not via env vars |
| MR005 | db_migration_runner | Migration ordering not explicit |
| MR006 | db_migration_runner | TODO/FIXME found |
| MR007 | db_migration_runner | Migration runner contract violation |
| CP001 | connection_pool_config | connection-pool-spec.json missing or invalid |
| CP002 | connection_pool_config | Pool limits not positive integers |
| CP003 | connection_pool_config | Client connection count insufficient vs pool max |
| CP004 | connection_pool_config | Auth/TLS config invalid |
| CP005 | connection_pool_config | Host reference not declared |
| CP006 | connection_pool_config | TODO/FIXME found |
| CP007 | connection_pool_config | Connection pool contract violation |
| DBB001 | db_backup_job | db-backup-spec.json missing or invalid |
| DBB002 | db_backup_job | Cron schedule invalid |
| DBB003 | db_backup_job | Retention policy not set |
| DBB004 | db_backup_job | No checksum generation configured |
| DBB005 | db_backup_job | Literal credentials in backup config |
| DBB006 | db_backup_job | TODO/FIXME found |
| DBB007 | db_backup_job | DB backup job contract violation |
| BV001 | backup_verification_job | backup-verify-spec.json missing or invalid |
| BV002 | backup_verification_job | Targets production environment |
| BV003 | backup_verification_job | No verification queries defined |
| BV004 | backup_verification_job | No result artifact path specified |
| BV005 | backup_verification_job | No schedule or trigger defined |
| BV006 | backup_verification_job | TODO/FIXME found |
| BV007 | backup_verification_job | Backup verification contract violation |
| PR001 | prometheus_rule_group | prometheus-rules-spec.json missing or invalid |
| PR002 | prometheus_rule_group | Duplicate alert names |
| PR003 | prometheus_rule_group | Alert missing required fields (expr, for, labels) |
| PR004 | prometheus_rule_group | Recording rule name violates convention |
| PR005 | prometheus_rule_group | Invalid severity label |
| PR006 | prometheus_rule_group | TODO/FIXME found |
| PR007 | prometheus_rule_group | Prometheus rules contract violation |
| GD001 | grafana_dashboard_bundle | grafana-dashboard-spec.json missing or invalid |
| GD002 | grafana_dashboard_bundle | Dashboard JSON file missing or parse error |
| GD003 | grafana_dashboard_bundle | Dashboard missing required fields |
| GD004 | grafana_dashboard_bundle | Datasource UID not in declared datasources |
| GD005 | grafana_dashboard_bundle | Duplicate panel IDs |
| GD006 | grafana_dashboard_bundle | TODO/FIXME found |
| GD007 | grafana_dashboard_bundle | Grafana dashboard contract violation |
| RS001 | rightsizing_profile | rightsizing-spec.json missing or invalid |
| RS002 | rightsizing_profile | Container missing resource requests or limits |
| RS003 | rightsizing_profile | Resource limit exceeds node capacity |
| RS004 | rightsizing_profile | Resource request exceeds limit |
| RS005 | rightsizing_profile | HPA bounds invalid |
| RS006 | rightsizing_profile | TODO/FIXME found |
| RS007 | rightsizing_profile | Rightsizing contract violation |
| EP001 | edge_policy_bundle | edge-policy-spec.json missing or invalid |
| EP002 | edge_policy_bundle | Rule missing rate limit definition |
| EP003 | edge_policy_bundle | CORS configuration invalid |
| EP004 | edge_policy_bundle | WAF rule invalid |
| EP005 | edge_policy_bundle | Geo restriction invalid |
| EP006 | edge_policy_bundle | TODO/FIXME found |
| EP007 | edge_policy_bundle | Edge policy contract violation |
| SS001 | security_scan_pipeline | security-scan-spec.json missing or invalid |
| SS002 | security_scan_pipeline | Unknown scanner type |
| SS003 | security_scan_pipeline | Scanner missing severity threshold |
| SS004 | security_scan_pipeline | Blanket ignore rule detected |
| SS005 | security_scan_pipeline | Report output not configured |
| SS006 | security_scan_pipeline | TODO/FIXME found |
| SS007 | security_scan_pipeline | Security scan contract violation |
| CT001 | cost_tagging_policy | cost-tagging-spec.json missing or invalid |
| CT002 | cost_tagging_policy | Missing common billing tags |
| CT003 | cost_tagging_policy | Tag key or value invalid |
| CT004 | cost_tagging_policy | Resource type coverage insufficient |
| CT005 | cost_tagging_policy | Enforcement mode not set |
| CT006 | cost_tagging_policy | TODO/FIXME found |
| CT007 | cost_tagging_policy | Cost tagging contract violation |
| DP001 | developer_platform_stack | dev-platform-spec.json missing or invalid |
| DP002 | developer_platform_stack | Unknown component type |
| DP003 | developer_platform_stack | No golden paths defined |
| DP004 | developer_platform_stack | No IDP component |
| DP005 | developer_platform_stack | No SBOM component |
| DP006 | developer_platform_stack | TODO/FIXME found |
| DP007 | developer_platform_stack | Developer platform contract violation |
| DR001 | disaster_recovery_runbook | dr-runbook-spec.json missing or invalid |
| DR002 | disaster_recovery_runbook | RTO/RPO invalid or inconsistent |
| DR003 | disaster_recovery_runbook | DR scenario incomplete |
| DR004 | disaster_recovery_runbook | Failover target config invalid |
| DR005 | disaster_recovery_runbook | Communication plan not defined |
| DR006 | disaster_recovery_runbook | Test schedule not defined |
| DR007 | disaster_recovery_runbook | TODO/FIXME found |
| DR008 | disaster_recovery_runbook | DR runbook contract violation |

### Backend Domain Compiler Error Codes

> Note: Some prefixes share letters with DevOps compilers (SC, DS, EP, HC, SJ, SS, CT). Each compiler runs in isolation — codes are scoped to their own compiler context and never intermix.

| Code | Compiler | Meaning |
|---|---|---|
| MS001 | module-scaffold | module-spec.json missing or invalid |
| MS002 | module-scaffold | Public entrypoint (index.ts) missing or has no exports |
| MS003 | module-scaffold | Internal folder not declared in capabilities[] |
| MS004 | module-scaffold | Cross-module import bypasses public entrypoint |
| MS005 | module-scaffold | Circular import detected between modules |
| MS006 | module-scaffold | TODO/FIXME/HACK comment found |
| MS007 | module-scaffold | Module scaffold contract violation |
| CV001 | config-validation-module | config-spec.json missing or invalid |
| CV002 | config-validation-module | Exported config key not in validation schema |
| CV003 | config-validation-module | Schema key has no required flag or default value |
| CV004 | config-validation-module | Direct process.env access outside config module boundary |
| CV005 | config-validation-module | Secret key not marked secret: true in spec |
| CV006 | config-validation-module | Schema does not enforce startup failure for missing keys |
| CV007 | config-validation-module | Unknown env key policy not declared (must be reject or ignore) |
| CV008 | config-validation-module | TODO/FIXME/HACK comment found |
| CV009 | config-validation-module | Tests failed |
| CV010 | config-validation-module | Config contract violation |
| DS001 | domain-service-module | service-spec.json missing or invalid |
| DS002 | domain-service-module | TypeScript compilation failed |
| DS003 | domain-service-module | Explicit 'any' type found in service |
| DS004 | domain-service-module | Service imports HTTP framework types (express, fastify) |
| DS005 | domain-service-module | Service accesses process.env directly |
| DS006 | domain-service-module | Service performs multiple DB writes inline — use transaction-script |
| DS007 | domain-service-module | Service method returns void or untyped |
| DS008 | domain-service-module | Idempotent use case missing dedupe or unique-key strategy |
| DS009 | domain-service-module | TODO/FIXME/HACK comment found |
| DS010 | domain-service-module | Tests failed |
| DS011 | domain-service-module | Service contract violation |
| OR001 | orm-repository-module | repository-spec.json missing or invalid |
| OR002 | orm-repository-module | Repository entity not in migration-artifact — compile db-migration first |
| OR003 | orm-repository-module | TypeScript compilation failed |
| OR004 | orm-repository-module | Explicit 'any' type found in repository |
| OR005 | orm-repository-module | Repository imports HTTP framework types |
| OR006 | orm-repository-module | Repository makes external network call |
| OR007 | orm-repository-module | Paginated repository method lacks stable ordering |
| OR008 | orm-repository-module | Mutating method has no typed return |
| OR009 | orm-repository-module | Raw SQL without explicit escape hatch comment |
| OR010 | orm-repository-module | TODO/FIXME/HACK comment found |
| OR011 | orm-repository-module | Tests failed |
| OR012 | orm-repository-module | Repository contract violation |
| TX001 | transaction-script-module | transaction-spec.json missing or invalid |
| TX002 | transaction-script-module | DB write operations found outside transaction boundary |
| TX003 | transaction-script-module | HTTP/network call found inside transaction block |
| TX004 | transaction-script-module | Failure path does not roll back all writes |
| TX005 | transaction-script-module | Transaction requires isolation level but none declared |
| TX006 | transaction-script-module | TODO/FIXME/HACK comment found |
| TX007 | transaction-script-module | Tests failed |
| TX008 | transaction-script-module | Transaction script contract violation |
| SR001 | service-client-runtime-module | client-runtime-spec.json missing or invalid |
| SR002 | service-client-runtime-module | HTTP request without timeout or AbortSignal |
| SR003 | service-client-runtime-module | Base URL hardcoded — must come from config module |
| SR004 | service-client-runtime-module | Secret header logged without redaction |
| SR005 | service-client-runtime-module | Retry logic applies to non-allowlisted conditions |
| SR006 | service-client-runtime-module | Non-2xx response not mapped to typed client error |
| SR007 | service-client-runtime-module | TODO/FIXME/HACK comment found |
| SR008 | service-client-runtime-module | Tests failed |
| SR009 | service-client-runtime-module | Client runtime contract violation |
| SC001 | service-client-module | service-client-spec.json missing or invalid |
| SC002 | service-client-module | client-runtime-artifact.json not found — compile service-client-runtime first |
| SC003 | service-client-module | Hardcoded base URL found — must come from config via client runtime |
| SC004 | service-client-module | Auth token injected per-call instead of via interceptor |
| SC005 | service-client-module | Response not mapped to typed domain object |
| SC006 | service-client-module | Non-2xx response not mapped to typed error class |
| SC007 | service-client-module | No retry or circuit-breaker declared for this client |
| SC008 | service-client-module | Sensitive request field logged without redaction |
| SC009 | service-client-module | TODO/FIXME/HACK comment found |
| SC010 | service-client-module | Tests failed |
| SC011 | service-client-module | Service client contract violation |
| CT001 | cache-topology-module | cache-topology-spec.json missing or invalid |
| CT002 | cache-topology-module | Cache family missing namespace or namespace not unique |
| CT003 | cache-topology-module | Cache family has neither ttl nor noExpiry: true |
| CT004 | cache-topology-module | Duplicate key builder for the same resource |
| CT005 | cache-topology-module | Cache key builder is non-deterministic (Date.now, random) |
| CT006 | cache-topology-module | TODO/FIXME/HACK comment found |
| CT007 | cache-topology-module | Tests failed |
| CT008 | cache-topology-module | Cache topology contract violation |
| CA001 | cache-module | cache-spec.json missing or invalid |
| CA002 | cache-module | cache-topology-artifact.json not found — compile cache-topology first |
| CA003 | cache-module | Key builder function signature does not match declared key inputs |
| CA004 | cache-module | TTL value hardcoded inline — must come from topology or config |
| CA005 | cache-module | Cache miss does not propagate to origin — returns null silently |
| CA006 | cache-module | Write-back attempted after origin read failure |
| CA007 | cache-module | Invalidation targets namespace not declared in spec |
| CA008 | cache-module | TODO/FIXME/HACK comment found |
| CA009 | cache-module | Tests failed |
| CA010 | cache-module | Cache contract violation |
| TH001 | backend-test-harness-config | test-harness-spec.json missing or invalid |
| TH002 | backend-test-harness-config | Test runner config file missing or does not load |
| TH003 | backend-test-harness-config | Unit and integration test environments not split |
| TH004 | backend-test-harness-config | Network calls not blocked by default in unit test mode |
| TH005 | backend-test-harness-config | Coverage thresholds not machine-readable or not enforced |
| TH006 | backend-test-harness-config | Global setup file missing or does not register matchers |
| TH007 | backend-test-harness-config | TODO/FIXME/HACK comment found |
| TH008 | backend-test-harness-config | Test harness contract violation |
| BT001 | backend-test-module | test-module-spec.json missing or invalid |
| BT002 | backend-test-module | One or more behavior scenarios have no corresponding test |
| BT003 | backend-test-module | Real network call in unit test — use MSW or mock |
| BT004 | backend-test-module | Shared mutable state between tests |
| BT005 | backend-test-module | Mock return value typed as any/unknown |
| BT006 | backend-test-module | Weak assertion: toBeTruthy/toBeFalsy/toBeDefined with no value check |
| BT007 | backend-test-module | TODO/FIXME/HACK comment found |
| BT008 | backend-test-module | Tests failed |
| BT009 | backend-test-module | Test module contract violation |
| QT001 | queue-topology-module | queue-topology-spec.json missing or invalid |
| QT002 | queue-topology-module | Duplicate queue name detected |
| QT003 | queue-topology-module | Queue missing retry policy or explicit no-retry declaration |
| QT004 | queue-topology-module | Queue missing retention policy for completed and failed jobs |
| QT005 | queue-topology-module | Queue name literal found outside queue topology module |
| QT006 | queue-topology-module | TODO/FIXME/HACK comment found |
| QT007 | queue-topology-module | Tests failed |
| QT008 | queue-topology-module | Queue topology contract violation |
| JP001 | job-producer-module | job-producer-spec.json missing or invalid |
| JP002 | job-producer-module | queue-topology-artifact.json not found — compile queue-topology first |
| JP003 | job-producer-module | Job payload not validated before enqueue |
| JP004 | job-producer-module | Queue name hardcoded — must come from topology constant |
| JP005 | job-producer-module | Enqueue call not awaited — fire-and-forget detected |
| JP006 | job-producer-module | Job options not sourced from spec |
| JP007 | job-producer-module | TODO/FIXME/HACK comment found |
| JP008 | job-producer-module | Tests failed |
| JP009 | job-producer-module | Job producer contract violation |
| JW001 | job-worker-module | job-worker-spec.json missing or invalid |
| JW002 | job-worker-module | job-producer-artifact.json not found — compile job-producer first |
| JW003 | job-worker-module | Job payload not validated on receipt |
| JW004 | job-worker-module | No idempotency key check before processing |
| JW005 | job-worker-module | Error not classified as retryable vs non-retryable |
| JW006 | job-worker-module | Promise rejection not caught in processor function |
| JW007 | job-worker-module | TODO/FIXME/HACK comment found |
| JW008 | job-worker-module | Tests failed |
| JW009 | job-worker-module | Job worker contract violation |
| EP001 | event-publisher-module | event-publisher-spec.json missing or invalid |
| EP002 | event-publisher-module | Event not wrapped in typed envelope (eventType, aggregateId, timestamp, version) |
| EP003 | event-publisher-module | Channel/topic hardcoded as string — must come from spec constant |
| EP004 | event-publisher-module | Business logic found inside publisher (DB/HTTP call) |
| EP005 | event-publisher-module | Publish call not awaited |
| EP006 | event-publisher-module | TODO/FIXME/HACK comment found |
| EP007 | event-publisher-module | Tests failed |
| EP008 | event-publisher-module | Event publisher contract violation |
| EC001 | event-consumer-module | event-consumer-spec.json missing or invalid |
| EC002 | event-consumer-module | event-publisher-artifact.json not found — compile publisher first |
| EC003 | event-consumer-module | Event envelope not validated on receipt |
| EC004 | event-consumer-module | Idempotency key not persisted before processing |
| EC005 | event-consumer-module | Handler errors not classified (no dead-letter / retry distinction) |
| EC006 | event-consumer-module | Consumer subscribes to undeclared channel |
| EC007 | event-consumer-module | TODO/FIXME/HACK comment found |
| EC008 | event-consumer-module | Tests failed |
| EC009 | event-consumer-module | Event consumer contract violation |
| SJ001 | scheduled-job-module | scheduled-job-spec.json missing or invalid |
| SJ002 | scheduled-job-module | Cron expression is invalid |
| SJ003 | scheduled-job-module | Job registration ID uses dynamic value — must be stable constant |
| SJ004 | scheduled-job-module | No distributed lock — concurrent nodes will double-execute |
| SJ005 | scheduled-job-module | Job error propagates to scheduler process (unhandled throw) |
| SJ006 | scheduled-job-module | TODO/FIXME/HACK comment found |
| SJ007 | scheduled-job-module | Tests failed |
| SJ008 | scheduled-job-module | Scheduled job contract violation |
| WH001 | webhook-processor-module | webhook-processor-spec.json missing or invalid |
| WH002 | webhook-processor-module | Signature not verified before payload parsing |
| WH003 | webhook-processor-module | Raw body not preserved — signature verification will fail |
| WH004 | webhook-processor-module | HTTP 200/202 not returned before async processing |
| WH005 | webhook-processor-module | No async handoff — business logic executed synchronously |
| WH006 | webhook-processor-module | TODO/FIXME/HACK comment found |
| WH007 | webhook-processor-module | Tests failed |
| WH008 | webhook-processor-module | Webhook processor contract violation |
| RL001 | rate-limit-policy-module | rate-limit-spec.json missing or invalid |
| RL002 | rate-limit-policy-module | Rate limit key builder uses non-deterministic value |
| RL003 | rate-limit-policy-module | 429 response missing Retry-After header |
| RL004 | rate-limit-policy-module | Rate limit bypassed without declaration in spec.bypassConditions |
| RL005 | rate-limit-policy-module | TODO/FIXME/HACK comment found |
| RL006 | rate-limit-policy-module | Tests failed |
| RL007 | rate-limit-policy-module | Rate limit policy contract violation |
| GS001 | graphql-schema-module | graphql-schema-spec.json missing or invalid |
| GS002 | graphql-schema-module | GraphQL SDL fails to parse |
| GS003 | graphql-schema-module | Sensitive field exposed without @internal or @deprecated |
| GS004 | graphql-schema-module | Mutation returns root entity directly — must return payload type |
| GS005 | graphql-schema-module | Paginated query does not use Relay connection spec |
| GS006 | graphql-schema-module | TODO/FIXME/HACK comment found |
| GS007 | graphql-schema-module | Tests failed |
| GS008 | graphql-schema-module | GraphQL schema contract violation |
| GR001 | graphql-resolver-module | graphql-resolver-spec.json missing or invalid |
| GR002 | graphql-resolver-module | graphql-schema-artifact.json not found — compile schema first |
| GR003 | graphql-resolver-module | Direct DB access in resolver — use service layer |
| GR004 | graphql-resolver-module | List resolver has no DataLoader or batch loading |
| GR005 | graphql-resolver-module | Resolver missing authorization check |
| GR006 | graphql-resolver-module | Non-GraphQL error thrown from resolver (raw Error instead of GraphQLError) |
| GR007 | graphql-resolver-module | TODO/FIXME/HACK comment found |
| GR008 | graphql-resolver-module | Tests failed |
| GR009 | graphql-resolver-module | GraphQL resolver contract violation |
| HC001 | healthcheck-module | healthcheck-spec.json missing or invalid |
| HC002 | healthcheck-module | Liveness check calls remote system — must be local-only |
| HC003 | healthcheck-module | Readiness output not machine-readable per-dependency |
| HC004 | healthcheck-module | Dependency check has no timeout bound |
| HC005 | healthcheck-module | Health check performs destructive operation |
| HC006 | healthcheck-module | Failing dependency does not produce deterministic unhealthy/degraded result |
| HC007 | healthcheck-module | TODO/FIXME/HACK comment found |
| HC008 | healthcheck-module | Tests failed |
| HC009 | healthcheck-module | Healthcheck contract violation |
| SS001 | seed-scenario-module | seed-scenario-spec.json missing or invalid |
| SS002 | seed-scenario-module | Seed uses bare insert/create without upsert (not idempotent) |
| SS003 | seed-scenario-module | Random data without spec.allowRandom declaration |
| SS004 | seed-scenario-module | No cleanup/teardown function declared |
| SS005 | seed-scenario-module | Production data detected (real email/phone/SSN pattern) |
| SS006 | seed-scenario-module | TODO/FIXME/HACK comment found |
| SS007 | seed-scenario-module | Tests failed |
| SS008 | seed-scenario-module | Seed scenario contract violation |

---

## IR Identifiers

Each compiled artifact registers a unique IR identifier for cross-compiler lookup:

```
ts-schema       → SCHEMA:{EntityName}           e.g. SCHEMA:User
react-component → COMPONENT:{ComponentName}     e.g. COMPONENT:UserCard
api-route       → ROUTE:{METHOD} {path}         e.g. ROUTE:GET /users/:id
auth-middleware → AUTH:{functionName}            e.g. AUTH:requireAuth
db-migration    → TABLE:{tableName}             e.g. TABLE:users
                  MIGRATION:{version}_{name}    e.g. MIGRATION:001_create_users
react-form      → FORM:{FormName}               e.g. FORM:LoginForm
query-module    → QUERY:{hookName}              e.g. QUERY:useUserQuery
mutation-module → MUTATION:{hookName}           e.g. MUTATION:useUpdateUserMutation
state-store     → STORE:{storeName}             e.g. STORE:useUserStore
routing-config  → ROUTING:{routerType}          e.g. ROUTING:react-router-v6
design-tokens   → TOKENS:{projectName}          e.g. TOKENS:acme-app
loading-skeleton→ SKELETON:{componentName}      e.g. SKELETON:UserCardSkeleton
animation-spec  → ANIMATION:{componentName}    e.g. ANIMATION:ModalAnimation
layout-component→ LAYOUT:{componentName}       e.g. LAYOUT:DashboardLayout
invalidation-map→ INVALIDATION:{mapName}       e.g. INVALIDATION:users
route-guard     → GUARD:{componentName}        e.g. GUARD:ProtectedRoute
providers-scaffold→ PROVIDERS:{appName}        e.g. PROVIDERS:AppProviders
storybook-story → STORY:{componentName}        e.g. STORY:Button
navigation-config→ NAV:{navName}               e.g. NAV:SidebarNav
route-resilience→ RESILIENCE:{appName}         e.g. RESILIENCE:AppRoutes
utility-fn      → UTIL:{fnName}                e.g. UTIL:formatCurrency
i18n            → I18N:{locale}                e.g. I18N:en
analytics-event → ANALYTICS:{namespace}        e.g. ANALYTICS:user-events
feature-flag    → FLAG:{namespace}             e.g. FLAG:app-flags
a11y-test       → A11Y:{componentName}         e.g. A11Y:Modal

# Backend Domain IR Identifiers
module-scaffold              → MODULE:{name}                       e.g. MODULE:user-module
config-validation-module     → CONFIG:{namespace}                  e.g. CONFIG:app
domain-service-module        → SERVICE:{name}                      e.g. SERVICE:UserService
orm-repository-module        → REPOSITORY:{modelName}              e.g. REPOSITORY:User
transaction-script-module    → TRANSACTION:{name}                  e.g. TRANSACTION:createOrderTx
service-client-runtime-module→ CLIENT_RUNTIME:{name}               e.g. CLIENT_RUNTIME:stripe
service-client-module        → SERVICE_CLIENT:{provider}           e.g. SERVICE_CLIENT:stripe
cache-topology-module        → CACHE_TOPOLOGY:{name}               e.g. CACHE_TOPOLOGY:user-cache
cache-module                 → CACHE:{namespace}                   e.g. CACHE:users
backend-test-harness-config  → TEST_HARNESS:{name}                 e.g. TEST_HARNESS:api
backend-test-module          → TEST_MODULE:{module}                e.g. TEST_MODULE:UserService
queue-topology-module        → QUEUE_TOPOLOGY:{name}               e.g. QUEUE_TOPOLOGY:jobs
job-producer-module          → JOB_PRODUCER:{jobName}              e.g. JOB_PRODUCER:send-email
job-worker-module            → JOB_WORKER:{jobName}                e.g. JOB_WORKER:send-email
event-publisher-module       → EVENT_PUBLISHER:{eventType}         e.g. EVENT_PUBLISHER:UserCreated
event-consumer-module        → EVENT_CONSUMER:{eventType}          e.g. EVENT_CONSUMER:UserCreated
scheduled-job-module         → SCHEDULED_JOB:{jobId}               e.g. SCHEDULED_JOB:nightly-cleanup
webhook-processor-module     → WEBHOOK_PROCESSOR:{provider}        e.g. WEBHOOK_PROCESSOR:stripe
rate-limit-policy-module     → RATE_LIMIT_POLICY:{policyId}        e.g. RATE_LIMIT_POLICY:api-global
graphql-schema-module        → GRAPHQL_SCHEMA:{schemaName}         e.g. GRAPHQL_SCHEMA:main
graphql-resolver-module      → GRAPHQL_RESOLVER:{schemaName}       e.g. GRAPHQL_RESOLVER:main
healthcheck-module           → HEALTHCHECK:{name}                  e.g. HEALTHCHECK:api
seed-scenario-module         → SEED_SCENARIO:{scenarioId}          e.g. SEED_SCENARIO:standard-company

# DevOps IR Identifiers
env_schema              → ENV_SCHEMA:{service}                e.g. ENV_SCHEMA:api
dockerfile_image        → DOCKERFILE:{service}                e.g. DOCKERFILE:api
ci_cd_pipeline          → CI_CD:{platform}:{service}          e.g. CI_CD:github:api
iac_stack_definition    → IAC_STACK:{cloud}:{platform}        e.g. IAC_STACK:aws:terraform
secret_bundle           → SECRET_BUNDLE:{namespace}           e.g. SECRET_BUNDLE:production
vault_policy            → VAULT_POLICY:{name}                 e.g. VAULT_POLICY:api-read
network_dns_config      → DNS_CONFIG:{env}                    e.g. DNS_CONFIG:production
kubernetes_workload     → K8S_WORKLOAD:{ns}/{Kind}/{name}     e.g. K8S_WORKLOAD:default/Deployment/api
kubernetes_service      → K8S_SERVICE:{ns}/{name}             e.g. K8S_SERVICE:default/api-svc
kubernetes_ingress_gateway → K8S_INGRESS:{name}              e.g. K8S_INGRESS:api-ingress
healthcheck_probe_config→ PROBE_CONFIG:{service}              e.g. PROBE_CONFIG:api
background_worker_runtime→ WORKER_RUNTIME:{service}          e.g. WORKER_RUNTIME:email-worker
helm_chart              → HELM_CHART:{name}:{version}         e.g. HELM_CHART:api:1.0.0
kustomize_overlay       → KUSTOMIZE_OVERLAY:{env}             e.g. KUSTOMIZE_OVERLAY:production
scheduled_job           → SCHEDULED_JOB:{name}                e.g. SCHEDULED_JOB:nightly-report
data_seed_job           → DATA_SEED:{name}                    e.g. DATA_SEED:seed-roles
db_migration_runner     → DB_MIGRATION:{tool}:{database}      e.g. DB_MIGRATION:prisma:main
connection_pool_config  → CONN_POOL:{service}                 e.g. CONN_POOL:api
db_backup_job           → DB_BACKUP:{database}                e.g. DB_BACKUP:main
backup_verification_job → BACKUP_VERIFY:{name}                e.g. BACKUP_VERIFY:verify-main
prometheus_rule_group   → PROMETHEUS_RULES:{namespace}        e.g. PROMETHEUS_RULES:default
grafana_dashboard_bundle→ GRAFANA_DASHBOARD:{namespace}       e.g. GRAFANA_DASHBOARD:platform
rightsizing_profile     → RIGHTSIZING:{service}               e.g. RIGHTSIZING:api
edge_policy_bundle      → EDGE_POLICY:{name}                  e.g. EDGE_POLICY:global-policy
security_scan_pipeline  → SECURITY_SCAN:{name}                e.g. SECURITY_SCAN:full-scan
cost_tagging_policy     → COST_TAGGING:{org}                  e.g. COST_TAGGING:acme
developer_platform_stack→ DEV_PLATFORM:{name}                 e.g. DEV_PLATFORM:acme-platform
disaster_recovery_runbook→ DR_RUNBOOK:{service}               e.g. DR_RUNBOOK:api
```

---

## CLI Usage

```bash
# List all available compilers
ogu compiler list

# Get full info on a compiler (phases, gates, error codes)
ogu compiler info api-route

# Run a compiler on a directory
ogu compiler ts-schema ./src/schemas/user
ogu compiler react-component ./src/components/UserCard UserCard
ogu compiler api-route ./src/routes/users/get-user

# Flags
--skip-tests         # skip tests-pass + coverage gates
--phase N            # resume from phase N
--gates a,b,c        # run only specific gates
--dir ./path         # explicit directory
--verbose            # full gate output
```

---

## Verified Execution Stack

A fully-attested vertical slice (frontend + backend) produces independent attestation hashes for each layer:

```
Layer 0 — Foundation
  schema-artifact.json      → SCHEMA:User                [hash: a1b2c3d4...]
  tokens-artifact.json      → TOKENS:acme-app             [hash: b2c3d4e5...]
  auth-artifact.json        → AUTH:requireAuth             [hash: e5f6a7b8...]
  migration-artifact.json   → MIGRATION:001_users          [hash: c9d0e1f2...]

Layer 1 — Logic & Data
  route-artifact.json       → ROUTE:GET /users/:id        [hash: e7f8a9b0...]
  query-artifact.json       → QUERY:useUserQuery           [hash: f0a1b2c3...]
  mutation-artifact.json    → MUTATION:useUpdateUserMutation [hash: c4d5e6f7...]
  store-artifact.json       → STORE:useUserStore           [hash: d8e9f0a1...]

Layer 2 — UI Building Blocks
  component-artifact.json   → COMPONENT:UserCard          [hash: a3b4c5d6...]
  skeleton-artifact.json    → SKELETON:UserCardSkeleton   [hash: b5c6d7e8...]
  hook-artifact.json        → HOOK:useUserPermissions     [hash: f9a0b1c2...]
  form-artifact.json        → FORM:LoginForm               [hash: f1a2b3c4...]

Layer 3 — Assembly
  page-artifact.json        → PAGE:UserProfilePage         [hash: c6d7e8f9...]
  routing-artifact.json     → ROUTING:react-router-v6      [hash: a0b1c2d3...]
```

Any change to any layer invalidates the downstream attestation chain. The chain is the guarantee.

---

## Security Tier — Compiler Reference

**Path**: `tools/ogu/compilers/security/`
**Role**: Security Engineer
**Purpose**: Enforce security policy correctness on artifacts before they reach production. Every compiler validates a JSON policy file in the feature artifact directory. Missing spec → skipped (not failed).

### Error Code Namespaces

| Prefix | Compiler |
|--------|----------|
| SH | secret-handling-policy |
| PC | pii-classification |
| EK | encryption-key-policy |
| TM | threat-model |
| AZ | authz-policy |
| IV | input-validation-policy |
| RL | rate-limit-policy |
| CP | csp-policy |
| AL | audit-log-policy |
| WV | webhook-verification-policy |
| FU | file-upload-policy |
| SK | session-cookie-policy |
| DV | dep-vuln-policy |
| ST | sast-policy |
| VE | vuln-exception-record |

### Compiler Summaries

#### `secret-handling-policy` (SH001–SH008)
Validates `secret-handling-policy.json`. Enforces: no env-var in prod, rotation defined, no plaintext logging, consumers scoped, staging/prod path separation, no hardcoded values.

#### `pii-classification` (PC001–PC007)
Validates `pii-classification.json`. Enforces: all PII fields classified by sensitivity, highly-sensitive fields encrypted, sensitive fields log-masked, no duplicate IDs, jurisdiction declared.

#### `encryption-key-policy` (EK001–EK007)
Validates `encryption-key-policy.json`. Enforces: approved algorithms only (blocks MD5/SHA1/DES/RC4/ECB), minimum key lengths (AES≥128, RSA≥2048, EC≥256), no cross-purpose reuse, transit+storage covered, rotation ≤730 days.

#### `threat-model` (TM001–TM009)
Validates `threat-model.json`. Enforces: STRIDE categories, risk score 1–5, high-risk threats mitigated (score≥15), every asset has a threat, trust boundaries named, LLM surfaces get prompt-injection + exfil threats.

#### `authz-policy` (AZ001–AZ008)
Validates `authz-policy.json`. Enforces: default-deny exists, no wildcards in prod allow rules, no unauthenticated admin access, multi-tenant isolation, M2M actors scoped, admin roles require MFA.

#### `input-validation-policy` (IV001–IV007)
Validates `input-validation-policy.json`. Enforces: string maxlength, numeric bounds, high-risk fields sanitized (html/sql/redirect_url), no unvalidated fields, file fields restrict MIME types and block dangerous extensions.

#### `rate-limit-policy` (RL001–RL005)
Validates `rate-limit-policy.json`. Enforces: public endpoints have per-IP limits, auth endpoints stricter (≤20 rpm), burst and sustained limits defined for all non-internal endpoints.

#### `csp-policy` (CP001–CP006)
Validates `csp-policy.json`. Enforces: no unsafe-inline/eval in script-src without nonce, base-uri not wildcard, frame-ancestors not wildcard, no wildcard in connect/style/font/object-src.

#### `audit-log-policy` (AL001–AL006)
Validates `audit-log-policy.json`. Enforces: required schema fields (actor_id/timestamp/source_ip/action_result), PII masked, high-risk actions logged, retention ≥90 days.

#### `webhook-verification-policy` (WV001–WV005)
Validates `webhook-verification-policy.json`. Enforces: constant-time comparison, replay window ≤300s, signature not optional, approved algorithm, secret not hardcoded.

#### `file-upload-policy` (FU001–FU005)
Validates `file-upload-policy.json`. Enforces: no public-read default, dangerous extensions blocked (exe/sh/php/html/js etc.), malware scan declared for public surfaces.

#### `session-cookie-policy` (SK001–SK005)
Validates `session-cookie-policy.json`. Enforces: HttpOnly+Secure+SameSite flags set, idle+absolute timeouts defined, SameSite=None requires explicit CSRF mode.

#### `dep-vuln-policy` (DV001–DV006)
Validates `dep-vuln-policy.json`. Enforces: critical vulns blocked, high vulns ≤14 day SLA, exceptions reference waiver records, all ecosystems have a declared scanner.

#### `sast-policy` (ST001–ST006)
Validates `sast-policy.json`. Enforces: OWASP top categories covered (injection/xss/ssrf/path-traversal/deserialization), blocking severity defined, suppressions have future expiry + meaningful justification.

#### `vuln-exception-record` (VE001–VE005)
Validates `vuln-exception-record.json`. Enforces: expiry ≤90 days from today, mitigation context ≥30 chars and not a placeholder, approver declared and not a placeholder.
