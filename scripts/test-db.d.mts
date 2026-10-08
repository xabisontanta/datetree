export function localProjectId(config: string): string;
export function assertLocalDockerEndpoint(endpoint: string, dockerHost?: string): void;
export function assertLocalTargets(
  projectId: string,
  database: unknown,
  network: unknown,
): { databaseName: string; networkName: string };
export function assertMigrationVersions(files: string[], appliedText: string): void;
export type Execute = (
  args: string[],
  options?: { inherit?: boolean; cleanup?: boolean },
) => Promise<string>;
export function runDatabaseTests(options: {
  root?: string;
  execute: Execute;
  dockerHost?: string;
  runId?: string;
}): Promise<void>;
