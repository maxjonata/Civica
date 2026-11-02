import { createPool, type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import type { ProposalKind, VoteChoice } from "@shared/civic/contracts";
import type { ClaimRecord, PolicyProfileRecord, ProposalRecord, RegionCell } from "../domain/types";
import type {
  CivicRepository,
  CivicSessionRecord,
  MediaRecord,
  NewClaimRecord,
  NewCommentRecord,
  NewMediaRecord,
  NewProposalRecord,
  NewRegionSubmission,
} from "../ports/repository";
import { CivicApplicationError } from "../application/service";

function number(value: unknown): number {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function proposalPrecision(value: unknown): NonNullable<ProposalRecord["precision"]> {
  const precision = nullableString(value);
  return precision === "municipality" || precision === "approximate_area" || precision === "not_provided"
    ? precision
    : "not_provided";
}

function proposalFromRow(row: RowDataPacket): ProposalRecord {
  return {
    id: String(row.id),
    kind: row.kind as ProposalKind,
    title: String(row.title),
    summary: String(row.summary),
    description: String(row.description),
    desiredChange: String(row.desired_change),
    municipalityCode: nullableString(row.municipality_code),
    municipality: nullableString(row.municipality),
    state: nullableString(row.state),
    areaLabel: nullableString(row.area_label),
    publicLocation: nullableString(row.public_location),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    precision: proposalPrecision(row.location_precision),
    pseudonym: row.pseudonym === null ? undefined : String(row.pseudonym),
    createdAt: number(row.created_at),
  };
}

export class MysqlCivicRepository implements CivicRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string, pool?: Pool) {
    if (!databaseUrl) throw new Error("database_url_required");
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "mysql:" || !parsed.hostname || !parsed.pathname.slice(1)) throw new Error("database_url_invalid");
    this.pool = pool ?? createPool(databaseUrl);
  }

  async ping(): Promise<void> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT version FROM civica_civic_schema_migrations WHERE version = ? LIMIT 1",
      ["0004_claim_submission_timestamps_v1"]
    );
    if (!rows[0]) throw new Error("civic_schema_not_ready");
  }

  async findSession(tokenHash: string, now: number): Promise<CivicSessionRecord | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT token_hash, csrf_hash, created_at, expires_at, rate_window_start, mutation_count FROM civica_civic_sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1",
      [tokenHash, now]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      tokenHash: String(row.token_hash),
      csrfHash: String(row.csrf_hash),
      createdAt: number(row.created_at),
      expiresAt: number(row.expires_at),
      rateWindowStart: number(row.rate_window_start),
      mutationCount: number(row.mutation_count),
    };
  }

  async createSession(session: CivicSessionRecord): Promise<void> {
    await this.pool.execute(
      "INSERT INTO civica_civic_sessions (token_hash, csrf_hash, created_at, expires_at, rate_window_start, mutation_count) VALUES (?, ?, ?, ?, ?, 0)",
      [session.tokenHash, session.csrfHash, session.createdAt, session.expiresAt, session.rateWindowStart]
    );
  }

  async rotateCsrfHash(tokenHash: string, csrfHash: string, now: number): Promise<void> {
    await this.pool.execute(
      "UPDATE civica_civic_sessions SET csrf_hash = ? WHERE token_hash = ? AND expires_at > ?",
      [csrfHash, tokenHash, now]
    );
  }

  async incrementMutation(tokenHash: string, now: number, maxPerWindow: number, windowMs: number): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT rate_window_start, mutation_count FROM civica_civic_sessions WHERE token_hash = ? AND expires_at > ? FOR UPDATE",
        [tokenHash, now]
      );
      const row = rows[0];
      if (!row) {
        await connection.rollback();
        return false;
      }
      const start = number(row.rate_window_start);
      const count = number(row.mutation_count);
      if (now - start >= windowMs) {
        await connection.execute(
          "UPDATE civica_civic_sessions SET rate_window_start = ?, mutation_count = 1 WHERE token_hash = ?",
          [now, tokenHash]
        );
        await connection.commit();
        return true;
      }
      if (count >= maxPerWindow) {
        await connection.rollback();
        return false;
      }
      await connection.execute(
        "UPDATE civica_civic_sessions SET mutation_count = mutation_count + 1 WHERE token_hash = ?",
        [tokenHash]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createProposal(proposal: NewProposalRecord, initialClaims: NewClaimRecord[] = []): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT INTO civica_civic_proposals (id, kind, title, summary, description, desired_change, municipality_code, municipality, state, area_label, public_location, latitude, longitude, location_precision, pseudonym, owner_scope_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [proposal.id, proposal.kind, proposal.title, proposal.summary, proposal.description, proposal.desiredChange, proposal.municipalityCode, proposal.municipality, proposal.state, proposal.areaLabel ?? null, proposal.publicLocation, proposal.latitude, proposal.longitude, proposal.precision, proposal.pseudonym, proposal.ownerScopeHash, proposal.createdAt, proposal.createdAt]
      );
      for (const claim of initialClaims) {
        await connection.execute(
          "INSERT INTO civica_civic_claims (id, proposal_id, category, claim_type, relation_label, statement_text, source_title, source_url, source_excerpt, jurisdiction, source_date, checked_at, submitted_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [claim.id, proposal.id, claim.category, claim.type, claim.relation, claim.statement, claim.sourceTitle, claim.sourceUrl, claim.sourceExcerpt, claim.jurisdiction, claim.sourceDate, null, claim.submittedAt, "community_submitted"]
        );
      }
      await connection.commit();
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original insert/commit error even if rollback also fails.
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async findProposal(id: string): Promise<ProposalRecord | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, kind, title, summary, description, desired_change, municipality_code, municipality, state, area_label, public_location, latitude, longitude, location_precision, pseudonym, created_at FROM civica_civic_proposals WHERE id = ? AND status = 'published' LIMIT 1",
      [id]
    );
    return rows[0] ? proposalFromRow(rows[0]) : null;
  }

  async findRecentProposals(limit: number, filters: { kind?: ProposalKind; municipalityCode?: string } = {}): Promise<ProposalRecord[]> {
    const where = ["status = 'published'"];
    const params: Array<string | number> = [];
    if (filters.kind) { where.push("kind = ?"); params.push(filters.kind); }
    if (filters.municipalityCode) { where.push("municipality_code = ?"); params.push(filters.municipalityCode); }
    params.push(Math.max(1, Math.min(100, Math.floor(limit))));
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, kind, title, summary, description, desired_change, municipality_code, municipality, state, area_label, public_location, latitude, longitude, location_precision, pseudonym, created_at FROM civica_civic_proposals WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
      params
    );
    return rows.map(proposalFromRow);
  }

  async findProposals(filters: { kind?: ProposalKind; municipalityCode?: string; query?: string }, limit: number): Promise<ProposalRecord[]> {
    const where = ["status = 'published'"];
    const params: Array<string | number> = [];
    if (filters.kind) { where.push("kind = ?"); params.push(filters.kind); }
    if (filters.municipalityCode) { where.push("municipality_code = ?"); params.push(filters.municipalityCode); }
    if (filters.query) {
      const escaped = filters.query.slice(0, 120).replace(/[\\%_]/g, "\\$&");
      where.push("(title LIKE ? ESCAPE '\\\\' OR summary LIKE ? ESCAPE '\\\\' OR description LIKE ? ESCAPE '\\\\')");
      const like = `%${escaped}%`;
      params.push(like, like, like);
    }
    params.push(Math.max(1, Math.min(50, Math.floor(limit))));
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, kind, title, summary, description, desired_change, municipality_code, municipality, state, area_label, public_location, latitude, longitude, location_precision, pseudonym, created_at FROM civica_civic_proposals WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
      params
    );
    return rows.map(proposalFromRow);
  }

  async recordVote(proposalId: string, voterScopeHash: string, choice: VoteChoice, now: number): Promise<void> {
    await this.pool.execute(
      "INSERT INTO civica_civic_votes (proposal_id, voter_scope_hash, choice, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = VALUES(updated_at)",
      [proposalId, voterScopeHash, choice, now, now]
    );
  }

  async findVote(proposalId: string, voterScopeHash: string): Promise<VoteChoice | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT choice FROM civica_civic_votes WHERE proposal_id = ? AND voter_scope_hash = ? LIMIT 1",
      [proposalId, voterScopeHash]
    );
    const choice = rows[0]?.choice;
    return choice === "support" || choice === "oppose" || choice === "need_information"
      ? choice
      : null;
  }

  async removeVote(proposalId: string, voterScopeHash: string): Promise<void> {
    await this.pool.execute("DELETE FROM civica_civic_votes WHERE proposal_id = ? AND voter_scope_hash = ?", [proposalId, voterScopeHash]);
  }

  async voteCounts(proposalId: string): Promise<Record<VoteChoice, number>> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT choice, COUNT(*) AS total FROM civica_civic_votes WHERE proposal_id = ? GROUP BY choice",
      [proposalId]
    );
    const counts: Record<VoteChoice, number> = { support: 0, oppose: 0, need_information: 0 };
    for (const row of rows) {
      if (row.choice in counts) counts[row.choice as VoteChoice] = number(row.total);
    }
    return counts;
  }

  async voteCount(proposalId: string): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM civica_civic_votes WHERE proposal_id = ?", [proposalId]);
    return number(rows[0]?.total);
  }

  async listRegionCells(proposalId?: string): Promise<RegionCell[]> {
    const where = proposalId ? "WHERE proposal_id = ?" : "";
    const params = proposalId ? [proposalId] : [];
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT municipality_code, municipality, state, COUNT(*) AS total FROM civica_civic_region_submissions ${where} GROUP BY municipality_code, municipality, state ORDER BY total DESC, municipality_code`,
      params
    );
    return rows.map(row => ({ key: String(row.municipality_code), municipalityCode: String(row.municipality_code), municipality: String(row.municipality), state: String(row.state), count: number(row.total) }));
  }

  async recordRegion(submission: NewRegionSubmission): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO civica_civic_region_submissions (proposal_id, region_scope_hash, municipality_code, municipality, state, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [submission.proposalId, submission.scopeHash, submission.municipalityCode, submission.municipality, submission.state, submission.createdAt]
    );
    return result.affectedRows === 1;
  }

  async addComment(comment: NewCommentRecord): Promise<void> {
    await this.pool.execute(
      "INSERT INTO civica_civic_comments (id, proposal_id, stance, pseudonym, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [comment.id, comment.proposalId, comment.stance, comment.pseudonym, comment.body, comment.createdAt]
    );
  }

  async listComments(proposalId: string, limit: number): Promise<NewCommentRecord[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, proposal_id, stance, pseudonym, body, created_at FROM civica_civic_comments WHERE proposal_id = ? AND status = 'published' ORDER BY created_at ASC LIMIT ?",
      [proposalId, Math.max(1, Math.min(100, Math.floor(limit)))]
    );
    return rows.map(row => ({ id: String(row.id), proposalId: String(row.proposal_id), stance: row.stance as NewCommentRecord["stance"], pseudonym: String(row.pseudonym), body: String(row.body), createdAt: number(row.created_at) }));
  }

  async countComments(proposalId: string): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM civica_civic_comments WHERE proposal_id = ? AND status = 'published'", [proposalId]);
    return number(rows[0]?.total);
  }

  async addClaim(claim: NewClaimRecord): Promise<void> {
    await this.pool.execute(
      "INSERT INTO civica_civic_claims (id, proposal_id, category, claim_type, relation_label, statement_text, source_title, source_url, source_excerpt, jurisdiction, source_date, checked_at, submitted_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [claim.id, claim.proposalId, claim.category, claim.type, claim.relation, claim.statement, claim.sourceTitle, claim.sourceUrl, claim.sourceExcerpt, claim.jurisdiction, claim.sourceDate, null, claim.submittedAt, "community_submitted"]
    );
  }

  async listClaims(proposalId: string): Promise<ClaimRecord[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, proposal_id, category, claim_type, relation_label, statement_text, source_title, source_url, source_excerpt, jurisdiction, source_date, checked_at, submitted_at, status FROM civica_civic_claims WHERE proposal_id = ? ORDER BY submitted_at DESC",
      [proposalId]
    );
    return rows.map(row => ({ id: String(row.id), proposalId: String(row.proposal_id), category: row.category as ClaimRecord["category"], type: row.claim_type as ClaimRecord["type"], relation: row.relation_label as ClaimRecord["relation"], statement: String(row.statement_text), sourceTitle: row.source_title === null ? null : String(row.source_title), sourceUrl: row.source_url === null ? null : String(row.source_url), sourceExcerpt: row.source_excerpt === null ? null : String(row.source_excerpt), jurisdiction: row.jurisdiction === null ? null : String(row.jurisdiction), sourceDate: row.source_date === null ? null : String(row.source_date), submittedAt: number(row.submitted_at), checkedAt: row.checked_at === null ? null : number(row.checked_at), status: row.status as ClaimRecord["status"] }));
  }

  async addMedia(media: NewMediaRecord): Promise<void> {
    await this.pool.execute(
      "INSERT INTO civica_civic_media (id, proposal_id, owner_scope_hash, webp_bytes, alt_text, width_px, height_px, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [media.id, media.proposalId, media.ownerScopeHash, media.bytes, media.altText, media.width, media.height, media.createdAt]
    );
  }

  async findMedia(id: string): Promise<MediaRecord | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, proposal_id, webp_bytes, alt_text, width_px, height_px, created_at FROM civica_civic_media WHERE id = ? AND status = 'published' LIMIT 1",
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return { id: String(row.id), proposalId: String(row.proposal_id), bytes: Buffer.from(row.webp_bytes as Buffer), altText: String(row.alt_text), width: number(row.width_px), height: number(row.height_px), createdAt: number(row.created_at) };
  }

  async removeMedia(id: string, proposalId: string, ownerScopeHash: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      "DELETE FROM civica_civic_media WHERE id = ? AND proposal_id = ? AND owner_scope_hash = ?",
      [id, proposalId, ownerScopeHash]
    );
    return result.affectedRows === 1;
  }

  async listMedia(proposalId: string): Promise<Array<Omit<MediaRecord, "bytes">>> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, proposal_id, alt_text, width_px, height_px, created_at FROM civica_civic_media WHERE proposal_id = ? AND status = 'published' ORDER BY created_at ASC",
      [proposalId]
    );
    return rows.map(row => ({ id: String(row.id), proposalId: String(row.proposal_id), altText: String(row.alt_text), width: number(row.width_px), height: number(row.height_px), createdAt: number(row.created_at) }));
  }

  async publicProposalCount(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM civica_civic_proposals WHERE status = 'published'");
    return number(rows[0]?.total);
  }

  async proposalCountsByKind(): Promise<Record<ProposalKind, number>> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT kind, COUNT(*) AS total FROM civica_civic_proposals WHERE status = 'published' GROUP BY kind");
    const counts: Record<ProposalKind, number> = { public_work: 0, legislative_change: 0, public_service: 0 };
    for (const row of rows) if (row.kind in counts) counts[row.kind as ProposalKind] = number(row.total);
    return counts;
  }

  async listVerifiedProfiles(): Promise<PolicyProfileRecord[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT actor_label, actor_role, topic, position_value, source_title, source_url, source_date FROM civica_civic_public_positions WHERE verification_status = 'verified' ORDER BY actor_label, topic LIMIT 500"
    );
    const grouped = new Map<string, PolicyProfileRecord>();
    for (const row of rows) {
      const label = String(row.actor_label);
      const id = `public:${label}`;
      const profile = grouped.get(id) ?? { id, label: `${label} — ${String(row.actor_role)}`, kind: "public_authority" as const, verified: true, positions: [] };
      profile.positions.push({ topic: String(row.topic), value: number(row.position_value), sourceTitle: String(row.source_title), sourceUrl: String(row.source_url), sourceDate: String(row.source_date) });
      grouped.set(id, profile);
    }
    return [...grouped.values()];
  }

  async saveProfileSubmission(_scopeHash: string, _answers: Record<string, number>, _now: number): Promise<boolean> {
    throw new CivicApplicationError("profile_survey_not_enabled", 503);
  }

  async publicProfileCohorts(_minimumSample: number): Promise<PolicyProfileRecord[]> {
    return [];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
