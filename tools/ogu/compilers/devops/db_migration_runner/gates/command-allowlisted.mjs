/**
 * Gate: command-allowlisted (MR003)
 * Validates that the migration command is a recognised, allowlisted migration
 * tool. Arbitrary shell commands in the migration spec create a code execution
 * risk in a highly privileged database context. The allowlist ensures only
 * well-understood migration frameworks are used.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_COMMANDS = [
  'prisma migrate deploy',
  'drizzle-kit migrate',
  'knex migrate:latest',
  'db-migrate up',
  'flyway migrate',
  'liquibase update',
  'migrate',
  'npx prisma',
  'python manage.py migrate',
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8'));
  const cmd  = spec.command || '';

  if (!ALLOWED_COMMANDS.some(a => cmd.includes(a))) {
    return {
      pass: false, code: 'MR003',
      message: `Migration command not allowlisted: "${cmd}"`,
      detail: {
        received: cmd,
        allowed:  ALLOWED_COMMANDS,
        hint:     'Use a recognised migration framework. To add a new tool, update the allowlist in this gate.',
      },
    };
  }

  return { pass: true, code: 'MR003', message: `Command allowlisted: ${cmd}` };
}
