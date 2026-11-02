import { describe, expect, it } from "vitest";
import { emptyState, type PilotState } from "../ports/pilot";
import {
  MysqlStateRepository,
  type MysqlPoolLike,
  type MysqlConnectionLike,
} from "./mysql-state";

class FakeConnection implements MysqlConnectionLike {
  state: PilotState = emptyState();
  committed = false;
  rolledBack = false;
  released = false;

  async beginTransaction(): Promise<void> {}
  async commit(): Promise<void> {
    this.committed = true;
  }
  async rollback(): Promise<void> {
    this.rolledBack = true;
  }
  release(): void {
    this.released = true;
  }
  async query(sql: string, params?: unknown[]): Promise<[unknown, unknown]> {
    if (sql.startsWith("SELECT"))
      return [[{ state_json: JSON.stringify(this.state) }], []];
    if (sql.startsWith("UPDATE")) {
      this.state = JSON.parse(String(params?.[0])) as PilotState;
      return [[], []];
    }
    return [[], []];
  }
}

class FakePool implements MysqlPoolLike {
  connection = new FakeConnection();
  async getConnection(): Promise<MysqlConnectionLike> {
    return this.connection;
  }
  async query(): Promise<[unknown, unknown]> {
    return [[], []];
  }
  async end(): Promise<void> {}
}

describe("MysqlStateRepository", () => {
  it("requires an explicit URL and does not read production environment implicitly", () => {
    expect(() => new MysqlStateRepository("")).toThrow("database_url_required");
  });

  it("commits a deep-cloned snapshot and rolls back callback failures", async () => {
    const pool = new FakePool();
    const repo = new MysqlStateRepository(
      "mysql://localhost/civica_test_unit",
      { pool }
    );
    expect(repo.target).toEqual({
      kind: "mysql",
      hostname: "localhost",
      database: "civica_test_unit",
    });
    expect(JSON.stringify(repo.target)).not.toContain("password");
    await repo.init();

    const result = await repo.transact(state => {
      state.accounts.push({
        id: "a",
        nickname: "Pessoa",
        role: "member",
        createdAt: 1,
      });
      return state.accounts[0]!;
    });
    result.nickname = "mutado fora";
    expect(pool.connection.committed).toBe(true);
    expect(pool.connection.rolledBack).toBe(false);
    await expect(
      repo.transact(state => state.accounts[0]!.nickname)
    ).resolves.toBe("Pessoa");

    await expect(
      repo.transact(state => {
        state.accounts[0]!.nickname = "não commitado";
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(pool.connection.rolledBack).toBe(true);
    await expect(
      repo.transact(state => state.accounts[0]!.nickname)
    ).resolves.toBe("Pessoa");
  });
});
