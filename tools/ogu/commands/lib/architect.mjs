/**
 * architect.mjs — Slice 427
 * PRD → Task Graph decomposition.
 *
 * Takes a PRD (from pm-engine) + optional team (from team-assembler) and
 * generates a flat list of concrete, executable tasks: the Task Graph.
 *
 * Each task has the full execution schema:
 *   task_id, title, owner_role, description, input_artifacts, output_artifacts,
 *   definition_of_done, gates, time_budget_minutes, dependencies (dependsOn)
 *
 * Generation strategy:
 *   1. Detect feature signals (entities, api, ui, auth, payment, etc.)
 *   2. Select task templates per signal
 *   3. Wire intra-feature deps: data → api → ui → test
 *   4. Wire inter-feature deps from prd.features[].dependencies
 *   5. If team provided, assign owner_agent_id to each task
 *
 * Exports:
 *   generateTaskGraph(prd, team, projectId) → Task[]
 *   detectFeatureSignals(feature) → Set<string>
 *   selectTaskTemplates(feature, availableRoles) → string[]
 *   assignOwnerRole(templateType) → string
 *   buildTaskDependencies(featureTaskGroups, prd) → Task[]
 *   validateTaskGraph(tasks) → { valid: boolean, errors: string[] }
 */

// ── Task template definitions ─────────────────────────────────────────────────

const TASK_TEMPLATES = {
  'db-schema': {
    layer: 'data',
    owner_role: 'backend_engineer',
    gates: ['migration-runs', 'schema-valid'],
    time_budget_minutes: 20,
    titleFn: (feat) => `Create ${feat.title} database schema`,
    descFn: (feat) => `Design and implement the database schema for ${feat.title}. Create migration files for ${(feat.entities || []).join(', ') || 'required entities'}.`,
    dodFn: (feat) => `Database schema for ${feat.title} created; migration runs without error; all required tables/columns present.`,
    outputFn: (feat, pid) => [`src/db/migrations/${pid}-${feat.id}-schema.sql`],
    inputFn: () => [],
  },
  'api-endpoint': {
    layer: 'api',
    owner_role: 'backend_engineer',
    gates: ['no-syntax-error', 'output-exists'],
    time_budget_minutes: 45,
    titleFn: (feat) => `Implement ${feat.title} API endpoints`,
    descFn: (feat) => `Create REST API endpoints for ${feat.title}. Implement handlers for: ${(feat.flows || ['core operations']).join(', ')}.`,
    dodFn: (feat) => `All ${feat.title} API endpoints implemented; each returns valid responses; routes are registered and reachable.`,
    outputFn: (feat, pid) => [`src/api/${feat.id}.ts`, `src/api/${feat.id}.test.ts`],
    inputFn: (feat, pid) => [`src/db/migrations/${pid}-${feat.id}-schema.sql`],
  },
  'auth-middleware': {
    layer: 'api',
    owner_role: 'backend_engineer',
    gates: ['no-syntax-error', 'tests-pass'],
    time_budget_minutes: 30,
    titleFn: () => `Implement authentication middleware`,
    descFn: () => `Create JWT-based auth middleware. Validate tokens, reject unauthorized requests, attach user context to request objects.`,
    dodFn: () => `Auth middleware validates JWT tokens; unauthorized requests return 401; protected routes enforce authentication.`,
    outputFn: (feat, pid) => [`src/middleware/auth.ts`, `src/middleware/auth.test.ts`],
    inputFn: () => [],
  },
  'ui-component': {
    layer: 'ui',
    owner_role: 'frontend_engineer',
    gates: ['no-syntax-error', 'output-exists'],
    time_budget_minutes: 60,
    titleFn: (feat) => `Build ${feat.title} UI components`,
    descFn: (feat) => `Create React components for ${feat.title}. Implement UI for: ${(feat.flows || ['main user flow']).join(', ')}.`,
    dodFn: (feat) => `${feat.title} UI renders correctly; form validations work; API integration functional; no console errors.`,
    outputFn: (feat) => [`src/components/${feat.id}/index.tsx`, `src/pages/${feat.id}.tsx`],
    inputFn: (feat, pid) => [`src/api/${feat.id}.ts`],
  },
  'integration-test': {
    layer: 'test',
    owner_role: 'qa',
    gates: ['tests-pass'],
    time_budget_minutes: 30,
    titleFn: (feat) => `Write integration tests for ${feat.title}`,
    descFn: (feat) => `Write integration tests covering ${feat.title} API endpoints and business logic. Cover acceptance criteria: ${(feat.acceptance_criteria || []).slice(0, 3).join('; ')}.`,
    dodFn: (feat) => `All integration tests for ${feat.title} pass; each acceptance criterion has test coverage.`,
    outputFn: (feat) => [`tests/integration/${feat.id}.test.ts`],
    inputFn: (feat, pid) => [`src/api/${feat.id}.ts`],
  },
  'e2e-test': {
    layer: 'test',
    owner_role: 'qa',
    gates: ['tests-pass', 'output-exists'],
    time_budget_minutes: 40,
    titleFn: (feat) => `Write E2E tests for ${feat.title}`,
    descFn: (feat) => `Write end-to-end tests for ${feat.title} user flows. Cover: ${(feat.flows || ['main flow']).join(', ')}.`,
    dodFn: (feat) => `E2E tests for all ${feat.title} flows pass in CI; edge cases documented.`,
    outputFn: (feat) => [`tests/e2e/${feat.id}.spec.ts`],
    inputFn: () => [],
  },
  'security-review': {
    layer: 'review',
    owner_role: 'security',
    gates: ['output-exists'],
    time_budget_minutes: 25,
    titleFn: (feat) => `Security review for ${feat.title}`,
    descFn: (feat) => `Review ${feat.title} implementation for security vulnerabilities: input validation, auth enforcement, data exposure, injection risks.`,
    dodFn: (feat) => `Security review report for ${feat.title} complete; no critical vulnerabilities; medium issues documented with mitigations.`,
    outputFn: (feat) => [`docs/security/${feat.id}-review.md`],
    inputFn: (feat, pid) => [`src/api/${feat.id}.ts`],
  },
  'setup-infrastructure': {
    layer: 'data',
    owner_role: 'devops',
    gates: ['output-exists'],
    time_budget_minutes: 30,
    titleFn: () => `Setup project infrastructure`,
    descFn: () => `Configure project infrastructure: database connections, environment variables, CI pipeline, deployment configuration.`,
    dodFn: () => `Project runs locally; database connection established; CI pipeline configured; environment variables documented.`,
    outputFn: (feat, pid) => [`docker-compose.yml`, `.env.example`, `src/db/connection.ts`],
    inputFn: () => [],
  },
};

// Layer order for intra-feature dependency wiring
const LAYER_ORDER = ['data', 'api', 'review', 'ui', 'test'];

// ── Feature split threshold ───────────────────────────────────────────────────

export const SPLIT_THRESHOLD = 6;

const CORE_LAYERS = new Set(['data', 'api']);
const UI_LAYERS = new Set(['ui', 'review', 'test']);

/**
 * splitFeatureTemplates(feature, templates) → SubFeature[]
 * Splits a feature's templates into core (data+api) and ui (ui+review+test) groups.
 * Returns two sub-feature objects with correct IDs and cross-dependency.
 */
export function splitFeatureTemplates(feature, templates) {
  const coreTemplates = [];
  const uiTemplates = [];

  for (const tmplKey of templates) {
    const tmpl = TASK_TEMPLATES[tmplKey];
    if (!tmpl) { uiTemplates.push(tmplKey); continue; }
    if (CORE_LAYERS.has(tmpl.layer)) {
      coreTemplates.push(tmplKey);
    } else {
      uiTemplates.push(tmplKey);
    }
  }

  return [
    {
      ...feature,
      id: `${feature.id}-core`,
      title: `${feature.title} (Core)`,
      _templates: coreTemplates,
      _isSubFeature: true,
      _parentFeatureId: feature.id,
    },
    {
      ...feature,
      id: `${feature.id}-ui`,
      title: `${feature.title} (UI)`,
      _templates: uiTemplates,
      _dependsOnSubFeature: `${feature.id}-core`,
      _isSubFeature: true,
      _parentFeatureId: feature.id,
    },
  ];
}

// ── Signal detection ──────────────────────────────────────────────────────────

/**
 * detectFeatureSignals(feature) → Set<string>
 * Identifies what kind of implementation a feature requires.
 */
export function detectFeatureSignals(feature) {
  const text = [
    feature.title || '',
    feature.description || '',
    ...(feature.acceptance_criteria || []),
    ...(feature.flows || []),
    ...(feature.edge_cases || []),
  ].join(' ').toLowerCase();

  const entities = feature.entities || [];
  const signals = new Set();

  if (entities.length > 0) signals.add('entities');
  if (/\b(database|table|migration|schema|model|entity|record|row)\b/.test(text)) signals.add('database');
  if (/\b(api|endpoint|route|handler|controller|rest|http|post|get|put|delete)\b/.test(text)) signals.add('api');
  if (/\b(ui|page|component|form|button|screen|modal|view|render|display|layout)\b/.test(text)) signals.add('ui');
  if (/\b(auth|login|logout|signup|register|password|token|jwt|session|credentials?)\b/.test(text)) signals.add('auth');
  if (/\b(payment|stripe|billing|checkout|invoice|subscription|charge|card)\b/.test(text)) signals.add('payment');
  if (/\b(search|filter|sort|paginate|query|index)\b/.test(text)) signals.add('search');
  if (/\b(upload|file|storage|image|media|s3|blob)\b/.test(text)) signals.add('file');
  if (/\b(notification|email|sms|push|alert|message)\b/.test(text)) signals.add('notification');

  return signals;
}

// ── Template selection ────────────────────────────────────────────────────────

/**
 * selectTaskTemplates(feature, availableRoles) → string[]
 * Returns ordered list of template keys to apply to this feature.
 */
export function selectTaskTemplates(feature, availableRoles = new Set()) {
  const signals = detectFeatureSignals(feature);
  const templates = [];

  // Data layer
  if (signals.has('entities') || signals.has('database')) {
    templates.push('db-schema');
  }

  // Auth middleware (once per project, but tracked by feature)
  if (signals.has('auth')) {
    templates.push('auth-middleware');
  }

  // API layer — always when there's meaningful implementation
  templates.push('api-endpoint');

  // Security review for sensitive features
  if (signals.has('auth') || signals.has('payment')) {
    templates.push('security-review');
  }

  // UI layer — only if frontend_engineer role available
  if (signals.has('ui') && (availableRoles.has('frontend_engineer') || availableRoles.size === 0)) {
    templates.push('ui-component');
  }

  // Tests — always
  templates.push('integration-test');

  // E2E tests if feature has explicit flows
  if ((feature.flows || []).length > 0) {
    templates.push('e2e-test');
  }

  return templates;
}

/**
 * assignOwnerRole(templateType) → string
 */
export function assignOwnerRole(templateType) {
  return TASK_TEMPLATES[templateType]?.owner_role || 'backend_engineer';
}

// ── Task ID generation ────────────────────────────────────────────────────────

function makeTaskId(projectId, featureId, templateType) {
  const proj = String(projectId).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 16);
  const feat = String(featureId).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20);
  const type = String(templateType).replace(/[^a-zA-Z0-9]/g, '-');
  return `${proj}-${feat}-${type}`;
}

// ── Agent assignment from team ────────────────────────────────────────────────

function assignAgentFromTeam(task, team) {
  if (!team?.members) return task;
  const member = team.members.find(
    m => m.role_id === task.owner_role && m.status === 'assigned' && m.agent_id
  );
  if (member) {
    return { ...task, owner_agent_id: member.agent_id };
  }
  return task;
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * generateTaskGraph(prd, team, projectId) → Task[]
 *
 * Returns a flat list of tasks with all execution fields set and
 * dependencies wired (both intra-feature and inter-feature).
 */
export function generateTaskGraph(prd, team = null, projectId = 'project') {
  if (!prd || !Array.isArray(prd.features) || prd.features.length === 0) {
    return [];
  }

  const availableRoles = new Set(
    (team?.members || []).map(m => m.role_id).filter(Boolean)
  );

  // Phase 0: Global setup task (always first)
  const setupTask = {
    id: makeTaskId(projectId, 'setup', 'setup-infrastructure'),
    task_id: makeTaskId(projectId, 'setup', 'setup-infrastructure'),
    title: TASK_TEMPLATES['setup-infrastructure'].titleFn({ title: '' }, projectId),
    description: TASK_TEMPLATES['setup-infrastructure'].descFn({ title: '' }, projectId),
    owner_role: TASK_TEMPLATES['setup-infrastructure'].owner_role,
    owner_agent_id: null,
    definition_of_done: TASK_TEMPLATES['setup-infrastructure'].dodFn({ title: '' }, projectId),
    input_artifacts: TASK_TEMPLATES['setup-infrastructure'].inputFn({ title: '' }, projectId),
    output_artifacts: TASK_TEMPLATES['setup-infrastructure'].outputFn({ title: '' }, projectId),
    gates: TASK_TEMPLATES['setup-infrastructure'].gates,
    time_budget_minutes: TASK_TEMPLATES['setup-infrastructure'].time_budget_minutes,
    feature_id: null,
    dependsOn: [],
    layer: 'data',
  };

  // Track tasks per feature (for cross-feature deps)
  const featureTaskGroups = new Map(); // featureId → Task[]
  // Track auth-middleware to avoid duplicates
  let authMiddlewareId = null;

  const allTasks = [setupTask];

  for (const feature of prd.features) {
    const templateKeys = selectTaskTemplates(feature, availableRoles);

    // Split large features into sub-features
    let featureUnits;
    if (templateKeys.length > SPLIT_THRESHOLD) {
      featureUnits = splitFeatureTemplates(feature, templateKeys);
    } else {
      featureUnits = [{ ...feature, _templates: templateKeys }];
    }

    // Track cross-sub-feature API task IDs for wiring
    const subFeatureApiTaskIds = new Map(); // subFeatureId → api-layer task ids

    for (const unit of featureUnits) {
      const unitTemplates = unit._templates || templateKeys;
      const featureTasks = [];
      const layerToTaskIds = new Map(); // layer → task ids in this feature

      for (const templateKey of unitTemplates) {
        // Deduplicate auth-middleware across features
        if (templateKey === 'auth-middleware' && authMiddlewareId) continue;

        const tmpl = TASK_TEMPLATES[templateKey];
        if (!tmpl) continue;

        const taskId = makeTaskId(projectId, unit.id, templateKey);

        const task = {
          id: taskId,
          task_id: taskId,
          title: tmpl.titleFn(unit, projectId),
          description: tmpl.descFn(unit, projectId),
          owner_role: tmpl.owner_role,
          owner_agent_id: null,
          definition_of_done: tmpl.dodFn(unit, projectId),
          input_artifacts: tmpl.inputFn(unit, projectId),
          output_artifacts: tmpl.outputFn(unit, projectId),
          gates: [...tmpl.gates],
          time_budget_minutes: tmpl.time_budget_minutes,
          feature_id: unit.id,
          dependsOn: [setupTask.id],  // all tasks depend at least on setup
          layer: tmpl.layer,
        };

        if (templateKey === 'auth-middleware') authMiddlewareId = taskId;

        featureTasks.push(task);

        const existing = layerToTaskIds.get(tmpl.layer) || [];
        existing.push(taskId);
        layerToTaskIds.set(tmpl.layer, existing);
      }

      // Wire intra-feature layer dependencies
      for (const task of featureTasks) {
        const taskLayerIdx = LAYER_ORDER.indexOf(task.layer);
        if (taskLayerIdx <= 0) continue;

        // Depends on all tasks in earlier layers within this feature
        for (let li = 0; li < taskLayerIdx; li++) {
          const layer = LAYER_ORDER[li];
          const earlierIds = layerToTaskIds.get(layer) || [];
          for (const depId of earlierIds) {
            if (!task.dependsOn.includes(depId)) {
              task.dependsOn.push(depId);
            }
          }
        }
      }

      // Wire cross-sub-feature deps: ui group depends on core group's api tasks
      if (unit._dependsOnSubFeature) {
        const coreApiIds = subFeatureApiTaskIds.get(unit._dependsOnSubFeature) || [];
        for (const task of featureTasks) {
          for (const depId of coreApiIds) {
            if (!task.dependsOn.includes(depId)) {
              task.dependsOn.push(depId);
            }
          }
        }
      }

      // Track API task IDs for cross-sub-feature wiring
      const apiIds = featureTasks.filter(t => t.layer === 'api').map(t => t.id);
      subFeatureApiTaskIds.set(unit.id, apiIds);

      featureTaskGroups.set(unit.id, featureTasks);
      allTasks.push(...featureTasks);
    }
  }

  // Wire inter-feature dependencies from prd.features[].dependencies
  for (const feature of prd.features) {
    if (!Array.isArray(feature.dependencies) || feature.dependencies.length === 0) continue;

    const thisTasks = featureTaskGroups.get(feature.id) || [];
    const firstNonTestTasks = thisTasks.filter(t => t.layer !== 'test').slice(0, 2);

    for (const depFeatId of feature.dependencies) {
      const depTasks = featureTaskGroups.get(depFeatId) || [];
      // Get the "terminal infrastructure" tasks from the dependency feature (data + api layers)
      const infraDepIds = depTasks
        .filter(t => t.layer === 'data' || t.layer === 'api')
        .map(t => t.id);

      for (const t of firstNonTestTasks) {
        for (const depId of infraDepIds) {
          if (!t.dependsOn.includes(depId)) {
            t.dependsOn.push(depId);
          }
        }
      }
    }
  }

  // Assign agents from team
  if (team?.members) {
    for (let i = 0; i < allTasks.length; i++) {
      allTasks[i] = assignAgentFromTeam(allTasks[i], team);
    }
  }

  return allTasks;
}

// ── Dependency wiring helper (standalone) ─────────────────────────────────────

/**
 * buildTaskDependencies(featureTaskGroups, prd) → Task[]
 * Re-wires all feature task groups' inter-feature dependencies from prd.
 * Useful when you have already-generated tasks and want to update deps only.
 */
export function buildTaskDependencies(featureTaskGroups, prd = {}) {
  const allTasks = Array.from(featureTaskGroups.values()).flat();

  for (const feature of (prd.features || [])) {
    if (!Array.isArray(feature.dependencies) || feature.dependencies.length === 0) continue;

    const thisTasks = featureTaskGroups.get?.(feature.id) ||
      allTasks.filter(t => t.feature_id === feature.id);

    for (const depFeatId of feature.dependencies) {
      const depTasks = featureTaskGroups.get?.(depFeatId) ||
        allTasks.filter(t => t.feature_id === depFeatId);
      const infraDepIds = depTasks
        .filter(t => t.layer === 'data' || t.layer === 'api')
        .map(t => t.id);

      for (const t of thisTasks.filter(t => t.layer !== 'test').slice(0, 2)) {
        for (const depId of infraDepIds) {
          if (!t.dependsOn.includes(depId)) t.dependsOn.push(depId);
        }
      }
    }
  }

  return allTasks;
}

// ── Validation ────────────────────────────────────────────────────────────────

const REQUIRED_TASK_FIELDS = [
  'id', 'title', 'owner_role', 'definition_of_done', 'gates',
  'input_artifacts', 'output_artifacts', 'time_budget_minutes',
];

/**
 * validateTaskGraph(tasks) → { valid: boolean, errors: string[] }
 */
export function validateTaskGraph(tasks) {
  const errors = [];

  if (!Array.isArray(tasks)) {
    return { valid: false, errors: ['tasks must be an array'] };
  }
  if (tasks.length === 0) {
    return { valid: false, errors: ['task graph is empty'] };
  }

  const ids = new Set();

  for (const task of tasks) {
    const tid = task.id || task.task_id || '?';

    for (const field of REQUIRED_TASK_FIELDS) {
      if (task[field] === undefined || task[field] === null || task[field] === '') {
        errors.push(`task "${tid}": missing required field "${field}"`);
      }
    }

    if (!Array.isArray(task.gates) || task.gates.length === 0) {
      errors.push(`task "${tid}": gates must be a non-empty array`);
    }

    if (ids.has(tid)) {
      errors.push(`task "${tid}": duplicate id`);
    }
    ids.add(tid);
  }

  // Check that all dependsOn references exist
  for (const task of tasks) {
    for (const depId of (task.dependsOn || [])) {
      if (!ids.has(depId)) {
        errors.push(`task "${task.id}": dependsOn "${depId}" not found in graph`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
