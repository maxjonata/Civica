import {
  createPool as createMysqlPool,
  type RowDataPacket,
} from "mysql2/promise";
import {
  emptyState,
  type PilotState,
  type StateRepository,
  type StateRepositoryTarget,
} from "../ports/pilot";
import { serializePilotState } from "./state";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface MysqlConnectionLike {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
  query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
}

export interface MysqlPoolLike {
  getConnection(): Promise<MysqlConnectionLike>;
  query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

export interface MysqlStateRepositoryOptions {
  pool?: MysqlPoolLike;
}

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS civica_pilot_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL
) ENGINE=InnoDB`;
const INSERT_SNAPSHOT =
  "INSERT IGNORE INTO civica_pilot_state (id, state_json) VALUES (1, ?)";
const SELECT_SNAPSHOT =
  "SELECT state_json FROM civica_pilot_state WHERE id = 1 FOR UPDATE";
const UPDATE_SNAPSHOT =
  "UPDATE civica_pilot_state SET state_json = ? WHERE id = 1";

export class MysqlStateRepository implements StateRepository {
  private readonly pool: MysqlPoolLike;
  readonly target: StateRepositoryTarget;
  private initialized = false;

  constructor(databaseUrl: string, options: MysqlStateRepositoryOptions = {}) {
    if (!databaseUrl) throw new Error("database_url_required");
    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
      const database = decodeURIComponent(parsed.pathname.slice(1));
      if (!parsed.hostname || !database) throw new Error("Invalid DSN");
      this.target = Object.freeze({
        kind: "mysql" as const,
        hostname: parsed.hostname,
        database,
      });
    } catch {
      throw new Error("database_url_required");
    }
    this.pool = options.pool ?? createMysqlPool(databaseUrl);
  }

  /** Additive and explicit; composition root or test setup must call this before transact(). */
  async init(): Promise<void> {
    await this.pool.query(CREATE_TABLE);
    await this.pool.query(INSERT_SNAPSHOT, [serializePilotState(emptyState())]);
    this.initialized = true;
  }

  async transact<T>(
    operation: (state: PilotState) => Promise<T> | T
  ): Promise<T> {
    if (!this.initialized) throw new Error("state_repository_not_initialized");
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    try {
      const [rows] = await connection.query(SELECT_SNAPSHOT);
      const row = (rows as RowDataPacket[])[0] as RowDataPacket | undefined;
      if (!row || row.state_json === undefined || row.state_json === null)
        throw new Error("state_snapshot_missing");
      const serialized = Buffer.isBuffer(row.state_json)
        ? row.state_json.toString("utf8")
        : String(row.state_json);
      const snapshot = JSON.parse(serialized) as PilotState;
      if (snapshot.version !== 1) throw new Error("state_snapshot_version");
      const working = clone(snapshot);
      const result = await operation(working);
      await connection.query(UPDATE_SNAPSHOT, [serializePilotState(working)]);
      await connection.commit();
      return clone(result);
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original operation/database error without exposing driver details.
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export { CREATE_TABLE, INSERT_SNAPSHOT, SELECT_SNAPSHOT, UPDATE_SNAPSHOT };
