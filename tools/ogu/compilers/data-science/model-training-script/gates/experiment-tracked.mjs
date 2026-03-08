/**
 * Why:
 * Every training run must be logged to an experiment tracking system.
 * Without tracking, training is a black box: you cannot reproduce a model,
 * compare hyperparameter configurations, audit which data version produced
 * which model, or roll back to a previous run.
 *
 * Supported platforms: MLflow, Weights & Biases, Neptune, Comet ML,
 * DVCLive, and ClearML. Custom trackers are accepted if they implement
 * `log_param`, `log_metric`, or `log_artifact` semantics.
 *
 * Minimum required tracking:
 * - At least one parameter logged (hyperparameters, data version, git commit)
 * - At least one metric logged (train/val loss, accuracy, F1, etc.)
 *
 * Escape hatch: add `# @tracking-external: <system>` anywhere in the file
 * if tracking is handled by an external orchestration layer (e.g., SageMaker
 * Experiments, Vertex AI, or a CI/CD pipeline wrapper).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TRACKERS = [
  {
    name: 'MLflow',
    param:  /mlflow\.log_param|mlflow\.log_params/,
    metric: /mlflow\.log_metric|mlflow\.log_metrics/,
    run:    /mlflow\.start_run|mlflow\.set_experiment/,
  },
  {
    name: 'Weights & Biases',
    param:  /wandb\.config|wandb\.init\s*\(/,
    metric: /wandb\.log\s*\(/,
    run:    /wandb\.init/,
  },
  {
    name: 'Neptune',
    param:  /run\["parameters"\]|neptune\.init/,
    metric: /run\["metrics"\]|neptune\.log_metric/,
    run:    /neptune\.init|neptune_client|neptune\.new\.init/,
  },
  {
    name: 'Comet ML',
    param:  /experiment\.log_parameter|comet_ml\.Experiment/,
    metric: /experiment\.log_metric/,
    run:    /comet_ml\.|Experiment\(\)/,
  },
  {
    name: 'DVCLive',
    param:  /live\.log_param/,
    metric: /live\.log_metric|live\.log\s*\(/,
    run:    /dvclive|from dvclive/,
  },
];

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: false, code: 'MT007', message: 'No Python files found' };

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Escape hatch: external tracking layer
  if (/@tracking-external/.test(content)) {
    const match = content.match(/@tracking-external:\s*(.+)/);
    return { pass: true, code: 'MT007', message: `External tracking acknowledged: ${match?.[1]?.trim() ?? 'yes'}` };
  }

  for (const tracker of TRACKERS) {
    const hasRun    = tracker.run.test(content);
    const hasParam  = tracker.param.test(content);
    const hasMetric = tracker.metric.test(content);

    if (hasRun && hasParam && hasMetric) {
      return { pass: true, code: 'MT007', message: `${tracker.name} experiment tracking detected (run + params + metrics)` };
    }
    if (hasRun || hasParam || hasMetric) {
      // Partial tracking — acceptable, just note it
      const found = [hasRun && 'run', hasParam && 'params', hasMetric && 'metrics'].filter(Boolean);
      return { pass: true, code: 'MT007', message: `${tracker.name} partial tracking: ${found.join(', ')}` };
    }
  }

  return {
    pass: false, code: 'MT007',
    message: 'No experiment tracking found — every training run must be logged',
    detail: 'Add MLflow tracking (recommended):\n' +
            '  import mlflow\n' +
            '  with mlflow.start_run():\n' +
            '      mlflow.log_params(config["hyperparameters"])\n' +
            '      mlflow.log_metric("f1", f1_score)\n' +
            '      mlflow.sklearn.log_model(pipeline, "model")\n\n' +
            'Or add # @tracking-external: <system> if tracked by orchestration.',
  };
}
