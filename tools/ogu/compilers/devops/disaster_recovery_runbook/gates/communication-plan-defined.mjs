/**
 * Gate: communication-plan-defined (DR005)
 * Validates the communication plan when declared. During a disaster, the
 * communication plan is as critical as the technical runbook — who commands,
 * who to escalate to, and where to post status updates determines whether
 * stakeholders panic or stay informed.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));

  if (spec.skipCommunicationPlan) {
    return { pass: true, code: 'DR005', message: 'skipCommunicationPlan=true — check skipped', skipped: true };
  }

  if (!spec.communicationPlan) {
    return {
      pass: false, code: 'DR005',
      message: 'communicationPlan not defined — DR runbook must include communication procedures',
      detail: { hint: 'Add a communicationPlan with incidentCommander, escalationPath, and statusPageUrl/statusChannel. Set skipCommunicationPlan: true for exemption.' },
    };
  }

  const cp         = spec.communicationPlan;
  const violations = [];

  if (!cp.incidentCommander) {
    violations.push({ field: 'communicationPlan.incidentCommander', reason: 'incidentCommander is required — without a named commander, the incident response is leaderless' });
  }
  if (!cp.escalationPath || cp.escalationPath.length === 0) {
    violations.push({ field: 'communicationPlan.escalationPath', reason: 'escalationPath must have at least one contact — if the incident commander is unavailable, there is no one to escalate to' });
  }
  if (!cp.statusPageUrl && !cp.statusChannel) {
    violations.push({ field: 'communicationPlan', reason: 'Neither statusPageUrl nor statusChannel is defined — stakeholders have no channel to receive status updates during the incident', hint: 'Add statusPageUrl: "https://status.example.com" or statusChannel: "#incidents"' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DR005',
      message: `${violations.length} communication plan issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DR005', message: 'Communication plan defined' };
}
