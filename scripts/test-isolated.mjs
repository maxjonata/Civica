import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: "C.UTF-8",
  TZ: "UTC",
  CI: "1",
  CIVICA_TEST_MODE: "1",
};
for (const key of ["TEST_DATABASE_URL", "TEST_RESTORE_DATABASE_URL"]) {
  if (!process.env[key]) continue;
  const url = new URL(process.env[key]);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/civica_test_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error(
      "Test database must be an explicitly named local temporary database"
    );
  env[key] = process.env[key];
}
// Invoke Vitest through Node directly. Besides avoiding a package-manager
// subprocess, this keeps the explicit test-only environment intact on Windows,
// where spawnSync("pnpm") cannot launch the pnpm.cmd shim without a shell.
const vitestCli = path.join(root, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitestCli, "run", "--config", "vitest.pilot.config.ts", ...process.argv.slice(2)],
  { cwd: root, env, stdio: "inherit" }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
