import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the additive civic migration.");
const parsed = new URL(databaseUrl);
if (parsed.protocol !== "mysql:" || !parsed.hostname || !parsed.pathname.slice(1)) {
  throw new Error("Configured database URL is not valid for the civic migration.");
}
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
const localCivicDatabase = localHost && /^civica_(test|preview)_[a-z0-9_]+$/i.test(databaseName);
const migrationVersions = ["0002_civic_v1", "0003_optional_location_v1", "0004_claim_submission_timestamps_v1"];
const explicitlyAuthorizedRemote =
  process.env.CIVICA_ALLOW_SHARED_MIGRATION === "1" &&
  migrationVersions.includes(process.env.CIVICA_MIGRATION_CONFIRM ?? "");
if (!localCivicDatabase && !explicitlyAuthorizedRemote) {
  throw new Error("Migration blocked for shared database; use a local civica_test_/civica_preview_ database or the reviewed two-variable authorization.");
}

const migrations = [
  { version: "0002_civic_v1", file: "drizzle/0002_civic.sql" },
  { version: "0003_optional_location_v1", file: "drizzle/0003_optional_location.sql" },
  { version: "0004_claim_submission_timestamps_v1", file: "drizzle/0004_claim_submission_timestamps.sql" },
];

function splitStatements(sql) {
  return sql.split(";").map(statement => statement.trim()).filter(Boolean);
}

async function appliedVersions(pool) {
  const placeholders = migrations.map(() => "?").join(", ");
  try {
    const [rows] = await pool.query(
      `SELECT version FROM civica_civic_schema_migrations WHERE version IN (${placeholders})`,
      migrations.map(migration => migration.version)
    );
    return new Set(rows.map(row => String(row.version)));
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_TABLE_ERROR") return new Set();
    throw error;
  }
}

const pool = createPool(databaseUrl);
try {
  const applied = await appliedVersions(pool);
  const appliedNow = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const sql = await fs.readFile(path.join(root, migration.file), "utf8");
    for (const statement of splitStatements(sql)) await pool.query(statement);
    applied.add(migration.version);
    appliedNow.push(migration.version);
  }
  if (appliedNow.length === 0) {
    console.log("Cívica: 0002, 0003 e 0004 já estavam aplicadas; nenhuma alteração foi executada.");
  } else {
    console.log(`Cívica: migrações aplicadas: ${appliedNow.join(", ")}; nenhuma tabela existente foi removida.`);
  }
} finally {
  await pool.end();
}
