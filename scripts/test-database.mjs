import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const name = "civica_test_" + randomBytes(8).toString("hex");
const restore = "civica_test_restore_" + randomBytes(8).toString("hex");
const user = "ct_" + randomBytes(6).toString("hex");
const password = randomBytes(24).toString("hex");
const sql = `CREATE DATABASE ${name}; CREATE DATABASE ${restore}; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL ON ${name}.* TO '${user}'@'127.0.0.1'; GRANT ALL ON ${restore}.* TO '${user}'@'127.0.0.1';`;
const setup = spawnSync("sudo", ["mariadb", "--batch"], {
  input: sql,
  encoding: "utf8",
});
if (setup.status !== 0)
  throw new Error(
    "Unable to prepare local test databases; no remote fallback is allowed"
  );
console.log(
  "Running SQL and restoration tests in local isolated databases, without production credentials."
);
const result = spawnSync(
  process.execPath,
  ["scripts/test-isolated.mjs", "tests/mysql-live.test.ts"],
  {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TEST_DATABASE_URL: `mysql://${user}:${password}@127.0.0.1/${name}`,
      TEST_RESTORE_DATABASE_URL: `mysql://${user}:${password}@127.0.0.1/${restore}`,
    },
    stdio: "inherit",
  }
);
console.log(
  "Isolated non-personal databases retained locally; no DROP or production mutation was executed."
);
process.exitCode = result.status ?? 1;
