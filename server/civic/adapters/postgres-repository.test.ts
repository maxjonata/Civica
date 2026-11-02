import { describe, expect, it, vi } from "vitest";
import type { PgPoolLike } from "./postgres-repository";
import { PostgresCivicRepository } from "./postgres-repository";

function makePool(query: PgPoolLike["query"] = vi.fn(async () => ({ rows: [], rowCount: 1 }))) {
  const pool = { query, connect: vi.fn(), end: vi.fn(async () => undefined) } as unknown as PgPoolLike;
  return { pool, query };
}

describe("civic Postgres repository", () => {
  it("checks the deployed Supabase schema version", async () => {
    const query = vi.fn(async () => ({ rows: [{ version: "0004_claim_submission_timestamps_v1" }], rowCount: 1 }));
    const { pool } = makePool(query);
    const repository = new PostgresCivicRepository(pool);
    await expect(repository.ping()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      "SELECT version FROM civica.civica_civic_schema_migrations WHERE version = $1 LIMIT 1",
      ["0004_claim_submission_timestamps_v1"],
    );
  });

  it("upserts only the scoped vote row", async () => {
    const { pool, query } = makePool();
    const repository = new PostgresCivicRepository(pool);
    await repository.recordVote("00000000-0000-4000-8000-000000000001", "scoped-hash", "support", 123);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (proposal_id, voter_scope_hash) DO UPDATE"),
      ["00000000-0000-4000-8000-000000000001", "scoped-hash", "support", 123],
    );
  });

  it("reports a duplicate region as an idempotent no-op", async () => {
    const { pool } = makePool(vi.fn(async () => ({ rows: [], rowCount: 0 })));
    const repository = new PostgresCivicRepository(pool);
    await expect(repository.recordRegion({
      proposalId: "00000000-0000-4000-8000-000000000001", scopeHash: "region-hash",
      municipalityCode: "3304557", municipality: "Rio de Janeiro", state: "RJ", createdAt: 100,
    })).resolves.toBe(false);
  });

  it("keeps proposal and initial claims in one transaction", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const release = vi.fn();
    const client = { query, release };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client), end: vi.fn() } as unknown as PgPoolLike;
    const repository = new PostgresCivicRepository(pool);
    await repository.createProposal({
      id: "00000000-0000-4000-8000-000000000001", kind: "public_work", title: "Proposta pública",
      summary: "Resumo descritivo suficientemente longo", description: "Descrição da proposta para persistir.",
      desiredChange: "Executar a mudança descrita", municipalityCode: null, municipality: null, state: null,
      publicLocation: null, latitude: null, longitude: null, precision: "not_provided", pseudonym: null,
      ownerScopeHash: "owner-scope", createdAt: 100,
    }, [{
      id: "00000000-0000-4000-8000-000000000002", proposalId: "00000000-0000-4000-8000-000000000001",
      category: "authority", type: "participant_report", relation: "supports", statement: "Relato inicial.",
      sourceTitle: null, sourceUrl: null, sourceExcerpt: null, jurisdiction: null, sourceDate: null,
      submittedAt: 101, status: "community_submitted",
    }]);
    expect(query.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(query).toHaveBeenCalledTimes(4);
    expect(release).toHaveBeenCalledOnce();
  });
});
