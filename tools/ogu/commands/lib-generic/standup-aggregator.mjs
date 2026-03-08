/**
 * Standup Data Aggregator — aggregate agent activity for standup reports.
 */

/**
 * Create a standup aggregator.
 *
 * @returns {object} Aggregator with addActivity/getActivities/generateReport
 */
export function createStandupAggregator() {
  const activities = []; // { agentId, type, feature, detail, timestamp }

  function addActivity({ agentId, type, feature, detail }) {
    activities.push({
      agentId,
      type,
      feature,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  function getActivities(agentId) {
    return activities.filter(a => a.agentId === agentId);
  }

  function generateReport() {
    const byAgent = {};
    const byFeature = {};

    for (const a of activities) {
      // By agent
      if (!byAgent[a.agentId]) {
        byAgent[a.agentId] = { completed: 0, failed: 0, activities: [] };
      }
      byAgent[a.agentId].activities.push(a);
      if (a.type.includes('completed') || a.type.includes('passed')) {
        byAgent[a.agentId].completed++;
      } else if (a.type.includes('failed')) {
        byAgent[a.agentId].failed++;
      }

      // By feature
      if (!byFeature[a.feature]) {
        byFeature[a.feature] = { activities: 0, agents: new Set() };
      }
      byFeature[a.feature].activities++;
      byFeature[a.feature].agents.add(a.agentId);
    }

    // Serialize sets
    for (const f of Object.values(byFeature)) {
      f.agents = Array.from(f.agents);
    }

    return {
      byAgent,
      byFeature,
      summary: {
        totalActivities: activities.length,
        uniqueAgents: new Set(activities.map(a => a.agentId)).size,
        uniqueFeatures: new Set(activities.map(a => a.feature)).size,
      },
    };
  }

  return { addActivity, getActivities, generateReport };
}
