import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import type { NewClaimRecord, NewProposalRecord } from "../ports/repository";
import { MysqlCivicRepository } from "./mysql-repository";

function repositoryFor(rows: Array<{ version: string }>) {
  const execute = vi.fn(async () => [rows, []]);
  const pool = { execute } as unknown as Pool;
  return { repository: new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_ping", pool), execute };
}

const proposal: NewProposalRecord = {
  id: "proposal-id",
  kind: "public_work",
  title: "Uma proposta pública",
  summary: "Resumo suficiente para o teste",
  description: "Descrição suficiente para o teste de persistência.",
  desiredChange: "Realizar a mudança descrita",
  municipalityCode: null,
  municipality: null,
  state: null,
  areaLabel: null,
  publicLocation: null,
  latitude: null,
  longitude: null,
  precision: "not_provided",
  pseudonym: null,
  ownerScopeHash: "owner-scope",
  createdAt: 1000,
};

const claim: NewClaimRecord = {
  id: "claim-id",
  proposalId: proposal.id,
  category: "authority",
  type: "participant_report",
  relation: "supports",
  statement: "A comunidade relata este fato.",
  sourceTitle: null,
  sourceUrl: null,
  sourceExcerpt: null,
  jurisdiction: null,
  sourceDate: null,
  submittedAt: 1001,
  status: "community_submitted",
};

describe("civic MySQL readiness marker", () => {
  it("is not ready when the current migration marker is missing", async () => {
    const { repository, execute } = repositoryFor([]);
    await expect(repository.ping()).rejects.toThrow("civic_schema_not_ready");
    expect(execute).toHaveBeenCalledWith(
      "SELECT version FROM civica_civic_schema_migrations WHERE version = ? LIMIT 1",
      ["0004_claim_submission_timestamps_v1"],
    );
  });

  it("is ready only after the current migration marker is present", async () => {
    const { repository } = repositoryFor([{ version: "0004_claim_submission_timestamps_v1" }]);
    await expect(repository.ping()).resolves.toBeUndefined();
  });
});

describe("civic MySQL proposal and claim persistence", () => {
  it("looks up a vote only by proposal and session-scoped hash", async () => {
    const execute = vi.fn(async () => [[{ choice: "need_information" }], []]);
    const pool = { execute } as unknown as Pool;
    const repository = new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_private_vote", pool);

    await expect(repository.findVote(proposal.id, "session-proposal-scope")).resolves.toBe("need_information");
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE proposal_id = ? AND voter_scope_hash = ? LIMIT 1"),
      [proposal.id, "session-proposal-scope"],
    );
  });

  it("commits the proposal and initial claims atomically", async () => {
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      execute: vi.fn(async (_sql: string, _params: unknown[]) => [[], []]),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
    };
    const pool = {
      getConnection: vi.fn(async () => connection),
      execute: vi.fn(),
    } as unknown as Pool;
    const repository = new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_atomic", pool);

    await repository.createProposal(proposal, [claim]);

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute.mock.calls[0][0]).toContain("INSERT INTO civica_civic_proposals");
    expect(connection.execute.mock.calls[1][0]).toContain("checked_at, submitted_at, status");
    expect(connection.execute.mock.calls[1][1]).toEqual([
      claim.id,
      proposal.id,
      claim.category,
      claim.type,
      claim.relation,
      claim.statement,
      claim.sourceTitle,
      claim.sourceUrl,
      claim.sourceExcerpt,
      claim.jurisdiction,
      claim.sourceDate,
      null,
      claim.submittedAt,
      "community_submitted",
    ]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("rolls back and rethrows when an initial claim insert fails", async () => {
    const failure = new Error("claim_insert_failed");
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      execute: vi.fn(async (sql: string) => {
        if (sql.includes("civica_civic_claims")) throw failure;
        return [[], []];
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
    };
    const pool = { getConnection: vi.fn(async () => connection) } as unknown as Pool;
    const repository = new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_rollback", pool);

    await expect(repository.createProposal(proposal, [claim])).rejects.toBe(failure);

    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("persists a newly added claim as community-submitted and unchecked", async () => {
    const execute = vi.fn(async () => [[], []]);
    const pool = { execute } as unknown as Pool;
    const repository = new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_add_claim", pool);
    const submittedClaim = { ...claim, submittedAt: 2002 };

    await repository.addClaim(submittedClaim);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("checked_at, submitted_at, status"),
      expect.arrayContaining([null, submittedClaim.submittedAt, "community_submitted"]),
    );
  });

  it("returns both timestamps honestly and orders by submission time", async () => {
    const row = {
      id: claim.id,
      proposal_id: proposal.id,
      category: claim.category,
      claim_type: claim.type,
      relation_label: claim.relation,
      statement_text: claim.statement,
      source_title: null,
      source_url: null,
      source_excerpt: null,
      jurisdiction: null,
      source_date: null,
      checked_at: null,
      submitted_at: claim.submittedAt,
      status: "community_submitted",
    };
    const execute = vi.fn(async () => [[row], []]);
    const pool = { execute } as unknown as Pool;
    const repository = new MysqlCivicRepository("mysql://test:test@127.0.0.1/civica_test_list_claims", pool);

    await expect(repository.listClaims(proposal.id)).resolves.toEqual([
      {
        id: claim.id,
        proposalId: proposal.id,
        category: claim.category,
        type: claim.type,
        relation: claim.relation,
        statement: claim.statement,
        sourceTitle: null,
        sourceUrl: null,
        sourceExcerpt: null,
        jurisdiction: null,
        sourceDate: null,
        submittedAt: claim.submittedAt,
        checkedAt: null,
        status: "community_submitted",
      },
    ]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("ORDER BY submitted_at DESC"), [proposal.id]);
  });
});
