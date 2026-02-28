import { randomUUID } from 'node:crypto';

/**
 * GenUI Widgets — dynamic widget schema for Studio runtime rendering.
 *
 * Defines widget types and their data schemas so agents can
 * dynamically create UI components at runtime.
 */

/**
 * Supported widget types.
 */
export const WIDGET_TYPES = {
  progress: {
    description: 'Progress bar with current/total',
    requiredFields: ['current', 'total'],
  },
  status: {
    description: 'Status indicator (ok, warning, error)',
    requiredFields: ['status'],
  },
  table: {
    description: 'Data table with rows and columns',
    requiredFields: ['rows'],
  },
  chart: {
    description: 'Simple chart (bar, line)',
    requiredFields: ['values'],
  },
  metric: {
    description: 'Single metric with value and label',
    requiredFields: ['value'],
  },
  list: {
    description: 'List of items',
    requiredFields: ['items'],
  },
  text: {
    description: 'Rich text block',
    requiredFields: ['content'],
  },
  timeline: {
    description: 'Timeline of events',
    requiredFields: ['events'],
  },
};

/**
 * Create a widget descriptor.
 *
 * @param {object} opts
 * @param {string} opts.type - Widget type
 * @param {string} opts.title - Widget title
 * @param {object} opts.data - Widget data
 * @param {object} [opts.style] - Optional style overrides
 * @returns {{ id, type, title, data, style, createdAt }}
 * @throws If type is invalid
 */
export function createWidget({ type, title, data, style } = {}) {
  if (!WIDGET_TYPES[type]) {
    throw new Error(`Invalid widget type: ${type}. Valid types: ${Object.keys(WIDGET_TYPES).join(', ')}`);
  }

  return {
    id: randomUUID(),
    type,
    title: title || '',
    data: data || {},
    style: style || {},
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a dashboard layout from widgets.
 *
 * @param {object} opts
 * @param {Array} opts.widgets - Widget descriptors
 * @param {number} [opts.columns] - Grid columns (default 3)
 * @returns {{ grid, columns }}
 */
export function createDashboardLayout({ widgets, columns } = {}) {
  columns = columns || 3;

  const grid = [];
  for (let i = 0; i < widgets.length; i += columns) {
    grid.push(widgets.slice(i, i + columns));
  }

  return { grid, columns, widgetCount: widgets.length };
}

/**
 * Serialize widgets to JSON.
 */
export function serializeWidgets(widgets) {
  return JSON.stringify(widgets, null, 2);
}
