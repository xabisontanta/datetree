import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectLabel = 'com.supabase.cli.project';
const testImage = 'public.ecr.aws/supabase/pg_prove:3.36';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function localProjectId(config) {
  const rootConfig = config.split(/^\s*\[/m)[0];
  const matches = [...rootConfig.matchAll(/^project_id\s*=\s*"([^"]+)"\s*(?:#.*)?$/gm)];
  if (matches.length !== 1 || !/^[a-zA-Z0-9_-]{1,48}$/.test(matches[0][1])) {
    throw new Error('supabase/config.toml needs one safe local project_id.');
  }
  return matches[0][1];
}

export function assertLocalDockerEndpoint(endpoint, dockerHost) {
  if (typeof endpoint !== 'string' || !endpoint) {
    throw new Error('Docker did not identify a local socket.');
  }
  for (const host of [endpoint, dockerHost].filter(Boolean)) {
    if (!/^(?:npipe|unix):\/\//.test(host)) {
      throw new Error(
        'Database tests require a local Docker socket, not a remote daemon.',
      );
    }
  }
}

export function assertLocalTargets(projectId, database, network) {
  const databaseName = `supabase_db_${projectId}`;
  const networkName = `supabase_network_${projectId}`;
  if (
    database.Name !== `/${databaseName}` ||
    database.Config?.Labels?.[projectLabel] !== projectId ||
    database.State?.Running !== true ||
    database.State?.Health?.Status !== 'healthy' ||
    !database.NetworkSettings?.Networks?.[networkName] ||
    network.Name !== networkName ||
    network.Labels?.[projectLabel] !== projectId
  ) {
    throw new Error(`Start the healthy local Supabase stack for ${projectId} first.`);
  }
  return { databaseName, networkName };
}

export function assertMigrationVersions(files, appliedText) {
  const expected = files
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = /^(\d{14})_[a-zA-Z0-9_-]+\.sql$/.exec(file);
      if (!match) throw new Error(`Invalid migration filename: ${file}`);
      return match[1];
    })
    .sort();
  const applied = appliedText.trim().split(/\s+/).filter(Boolean).sort();
  if (
    expected.length === 0 ||
    expected.length !== new Set(expected).size ||
    expected.join(',') !== applied.join(',')
  ) {
    throw new Error(
      'Local migration history differs from this checkout. Apply pending local migrations ' +
        'or verify a fresh isolated local stack; this runner never resets or migrates data.',
    );
  }
}

/** Only local Docker targets are accepted; this never reads linked-project credentials. */
export async function runDatabaseTests({
  root = repositoryRoot,
  execute,
  dockerHost = process.env.DOCKER_HOST,
  runId = randomUUID(),
}) {
  if (!/^[a-zA-Z0-9-]{1,48}$/.test(runId)) throw new Error('Invalid test run ID.');
  const projectId = localProjectId(
    await readFile(path.join(root, 'supabase', 'config.toml'), 'utf8'),
  );
  const context = JSON.parse(
    await execute([
      'context',
      'inspect',
      '--format',
      '{{json .Endpoints.docker.Host}}',
    ]),
  );
  assertLocalDockerEndpoint(context, dockerHost);
  const database = JSON.parse(
    await execute(['inspect', `supabase_db_${projectId}`]),
  )[0];
  const network = JSON.parse(
    await execute(['network', 'inspect', `supabase_network_${projectId}`]),
  )[0];
  const { databaseName, networkName } = assertLocalTargets(
    projectId,
    database,
    network,
  );
  console.info(
    `Testing local Supabase ${projectId}; no linked or remote database is used.`,
  );
  const applied = await execute([
    'exec',
    databaseName,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'select version from supabase_migrations.schema_migrations order by version',
  ]);
  assertMigrationVersions(
    await readdir(path.join(root, 'supabase', 'migrations')),
    applied,
  );
  const testDirectory = path.join(root, 'supabase', 'tests');
  if (!(await readdir(testDirectory)).some((file) => file.endsWith('.test.sql'))) {
    throw new Error('No local pgTAP test files found.');
  }

  let helperId;
  try {
    const created = await execute([
      'create',
      '--rm',
      '--name',
      `dt-db-tests-${runId}`,
      '--network',
      networkName,
      '--label',
      'date-tree.pgtap-helper=true',
      '--entrypoint',
      'sleep',
      testImage,
      'infinity',
    ]);
    helperId = created.trim();
    if (!/^[a-f0-9]{64}$/.test(helperId)) {
      helperId = undefined;
      throw new Error('Docker did not return an identifiable test helper.');
    }
    await execute(['start', helperId]);
    // Docker Desktop can copy Windows worktree files without a shared bind mount.
    await execute(['cp', testDirectory, `${helperId}:/tests`]);
    await execute(
      [
        'exec',
        '-e',
        'PGPASSWORD=postgres',
        helperId,
        'pg_prove',
        '-h',
        databaseName,
        '-p',
        '5432',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '--ext',
        '.sql',
        '-r',
        '/tests',
      ],
      { inherit: true },
    );
  } finally {
    if (helperId) {
      // Remove only the opaque container ID returned by this run, never the database.
      await execute(['rm', '--force', helperId], { cleanup: true });
    }
  }
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error(
      'test:db accepts no remote URLs, linked projects or additional flags.',
    );
  }
  let interrupted;
  let activeChild;
  const onInterrupt = (signal) => {
    interrupted = signal;
    // Let create/copy finish so the helper ID is known and cleanup remains possible.
    if (activeChild?.inherited) activeChild.child.kill(signal);
  };
  const sigint = () => onInterrupt('SIGINT');
  const sigterm = () => onInterrupt('SIGTERM');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);

  const execute = (args, { inherit = false, cleanup = false } = {}) => {
    if (interrupted && !cleanup)
      return Promise.reject(new Error('Database tests interrupted.'));
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, {
        cwd: repositoryRoot,
        shell: false,
        stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      });
      activeChild = { child, inherited: inherit };
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code, signal) => {
        activeChild = undefined;
        if (code === 0) resolve(stdout);
        else
          reject(
            new Error(
              `Local Docker ${args[0]} failed (${code ?? signal}). ${stderr.trim()}`,
            ),
          );
      });
    });
  };

  try {
    await runDatabaseTests({ execute });
  } finally {
    process.off('SIGINT', sigint);
    process.off('SIGTERM', sigterm);
    if (interrupted) process.exitCode = interrupted === 'SIGINT' ? 130 : 143;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode ||= 1;
  });
}
