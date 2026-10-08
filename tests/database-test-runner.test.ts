import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLocalDockerEndpoint,
  assertLocalTargets,
  assertMigrationVersions,
  localProjectId,
  runDatabaseTests,
  type Execute,
} from '../scripts/test-db.mjs';

const projectId = 'date_tree';
const helperId = 'a'.repeat(64);
const database = {
  Name: '/supabase_db_date_tree',
  Config: { Labels: { 'com.supabase.cli.project': projectId } },
  State: { Running: true, Health: { Status: 'healthy' } },
  NetworkSettings: { Networks: { supabase_network_date_tree: {} } },
};
const network = {
  Name: 'supabase_network_date_tree',
  Labels: { 'com.supabase.cli.project': projectId },
};

describe('local database test safety', () => {
  it('reads only a single safe root project_id', () => {
    expect(localProjectId('# local\nproject_id = "date_tree"\n[db]\nport=54322')).toBe(
      projectId,
    );
    for (const config of [
      'project_id = "remote;command"',
      '[db]\nproject_id = "date_tree"',
      'project_id = "one"\nproject_id = "two"',
      'project_id = "../outside"',
    ])
      expect(() => localProjectId(config)).toThrow();
  });

  it('refuses remote Docker endpoints and overrides', () => {
    assertLocalDockerEndpoint('npipe:////./pipe/dockerDesktopLinuxEngine');
    assertLocalDockerEndpoint('unix:///var/run/docker.sock');
    expect(() => assertLocalDockerEndpoint('ssh://server')).toThrow();
    expect(() => assertLocalDockerEndpoint('')).toThrow();
    expect(() =>
      assertLocalDockerEndpoint('unix:///var/run/docker.sock', 'tcp://server:2375'),
    ).toThrow();
  });

  it('requires a healthy database and matching Supabase project labels/network', () => {
    expect(assertLocalTargets(projectId, database, network).databaseName).toBe(
      'supabase_db_date_tree',
    );
    expect(() => assertLocalTargets('other', database, network)).toThrow();
    expect(() =>
      assertLocalTargets(
        projectId,
        { ...database, State: { Running: false } },
        network,
      ),
    ).toThrow();
    expect(() =>
      assertLocalTargets(projectId, database, { ...network, Labels: {} }),
    ).toThrow();
    expect(() =>
      assertLocalTargets(
        projectId,
        { ...database, NetworkSettings: { Networks: {} } },
        network,
      ),
    ).toThrow();
  });

  it('refuses missing, unexpected and duplicate migration versions', () => {
    const migrations = [
      '20261007105222_notifications.sql',
      '20260908195501_profiles.sql',
    ];
    assertMigrationVersions(migrations, '20260908195501\n20261007105222\n');
    expect(() => assertMigrationVersions(migrations, '20260908195501')).toThrow();
    expect(() =>
      assertMigrationVersions(
        migrations,
        '20260908195501\n20261007105222\n99999999999999',
      ),
    ).toThrow();
    expect(() =>
      assertMigrationVersions(
        [...migrations, migrations[0]],
        '20260908195501\n20261007105222',
      ),
    ).toThrow();
    expect(() => assertMigrationVersions(['invalid.sql'], '')).toThrow();
  });
});

async function fakeDocker(failingCommand?: string) {
  const root = path.resolve(import.meta.dirname, '..');
  const versions = (await readdir(path.join(root, 'supabase', 'migrations')))
    .filter((file) => file.endsWith('.sql'))
    .map((file) => file.split('_')[0])
    .join('\n');
  const calls: { args: string[]; options?: Parameters<Execute>[1] }[] = [];
  const execute: Execute = async (args, options) => {
    calls.push({ args, options });
    if (
      args[0] === failingCommand ||
      (failingCommand === 'prove' && args.includes('pg_prove'))
    ) {
      throw new Error('Simulated failure');
    }
    if (args[0] === 'context') return JSON.stringify('unix:///var/run/docker.sock');
    if (args[0] === 'inspect') return JSON.stringify([database]);
    if (args[0] === 'network') return JSON.stringify([network]);
    if (args.includes('psql')) return versions;
    if (args[0] === 'create') return helperId;
    return '';
  };
  return { root, calls, execute };
}

describe('copy-based pgTAP runner', () => {
  it('copies tests without bind mounts and removes only its own helper', async () => {
    const fake = await fakeDocker();
    await runDatabaseTests({ ...fake, dockerHost: '', runId: 'unit-test' });
    const create = fake.calls.find((call) => call.args[0] === 'create')!.args;
    expect(create).toContain('supabase_network_date_tree');
    expect(create).not.toContain('--mount');
    expect(create).not.toContain('-v');
    expect(fake.calls.find((call) => call.args[0] === 'cp')!.args[2]).toBe(
      `${helperId}:/tests`,
    );
    expect(fake.calls.at(-1)).toEqual({
      args: ['rm', '--force', helperId],
      options: { cleanup: true },
    });
    expect(fake.calls.find((call) => call.args.includes('pg_prove'))!.args).toContain(
      'supabase_db_date_tree',
    );
    expect(
      fake.calls.every(
        (call) => !call.args.includes('--linked') && !call.args.includes('--db-url'),
      ),
    ).toBe(true);
  });

  it.each(['start', 'cp', 'prove'])(
    'removes the owned helper after %s fails',
    async (command) => {
      const fake = await fakeDocker(command);
      await expect(
        runDatabaseTests({ ...fake, dockerHost: '', runId: 'unit-test' }),
      ).rejects.toThrow('Simulated failure');
      expect(fake.calls.at(-1)!.args).toEqual(['rm', '--force', helperId]);
    },
  );

  it('does not remove other containers when creation fails', async () => {
    const fake = await fakeDocker('create');
    await expect(
      runDatabaseTests({ ...fake, dockerHost: '', runId: 'unit-test' }),
    ).rejects.toThrow();
    expect(fake.calls.some((call) => call.args[0] === 'rm')).toBe(false);
  });

  it('refuses unsafe helper IDs before any Docker command', async () => {
    const fake = await fakeDocker();
    await expect(
      runDatabaseTests({ ...fake, runId: 'bad; command' }),
    ).rejects.toThrow();
    expect(fake.calls).toHaveLength(0);
  });

  it('does not create a helper when the local database is stale', async () => {
    const fake = await fakeDocker();
    const execute: Execute = (args, options) =>
      args.includes('psql')
        ? Promise.resolve('20260908195501')
        : fake.execute(args, options);
    await expect(
      runDatabaseTests({ ...fake, execute, dockerHost: '' }),
    ).rejects.toThrow('migration history differs');
    expect(fake.calls.some((call) => call.args[0] === 'create')).toBe(false);
  });

  it('does not inspect or modify database containers through a remote daemon', async () => {
    const fake = await fakeDocker();
    await expect(
      runDatabaseTests({ ...fake, dockerHost: 'ssh://server' }),
    ).rejects.toThrow('local Docker socket');
    expect(fake.calls.map((call) => call.args[0])).toEqual(['context']);
  });
});
