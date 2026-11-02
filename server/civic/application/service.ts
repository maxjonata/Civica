import { randomUUID } from "node:crypto";
import type {
  CreateClaimInput,
  CreateCommentInput,
  CreateProposalInput,
  PublicAnalytics,
  ProposalDetail,
  ProposalListItem,
  RelatedProposal,
  VoteChoice,
} from "@shared/civic/contracts";
import { findRelatedProposals } from "../domain/related";
import { publicVoteResultFromCounts, suppressSmallCells } from "../domain/analytics";
import { projectGraph3d } from "../domain/graph";
import { deriveScopedHash } from "../domain/privacy";
import type { ProposalRecord, RelatedCandidateInput } from "../domain/types";
import {
  validateClaimInput,
  validateCommentInput,
  validateProposalInput,
} from "../domain/validation";
import type { CivicRepository, NewClaimRecord, NewCommentRecord, NewProposalRecord } from "../ports/repository";

export class CivicApplicationError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = "CivicApplicationError";
  }
}

export interface CivicServiceOptions {
  repository: CivicRepository;
  now?: () => number;
  newId?: () => string;
  minimumSample?: number;
}

export class CivicService {
  private readonly repo: CivicRepository;
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly minimumSample: number;

  constructor(options: CivicServiceOptions) {
    this.repo = options.repository;
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? randomUUID;
    this.minimumSample = options.minimumSample ?? 10;
  }

  private async summary(proposal: ProposalRecord): Promise<ProposalListItem> {
    const [counts, commentCount, candidates] = await Promise.all([
      this.repo.voteCounts(proposal.id),
      this.repo.countComments(proposal.id),
      this.repo.findRecentProposals(100, {
        kind: proposal.kind,
        ...(proposal.municipalityCode ? { municipalityCode: proposal.municipalityCode } : {}),
      }),
    ]);
    const relatedCount = findRelatedProposals(proposal as RelatedCandidateInput, candidates.filter(item => item.id !== proposal.id)).length;
    return {
      id: proposal.id,
      kind: proposal.kind,
      title: proposal.title,
      summary: proposal.summary,
      municipality: proposal.municipality,
      state: proposal.state,
      regionStatus: proposal.municipality && proposal.state
        ? "user_provided_unverified"
        : "not_provided",
      publicLocation: proposal.publicLocation,
      createdAt: proposal.createdAt,
      commentCount,
      relatedCount,
      result: publicVoteResultFromCounts(counts, this.minimumSample),
    };
  }

  async listProposals(filters: { kind?: string; municipalityCode?: string; query?: string } = {}): Promise<ProposalListItem[]> {
    const normalized = {
      ...(filters.kind ? { kind: filters.kind as CreateProposalInput["kind"] } : {}),
      ...(filters.municipalityCode ? { municipalityCode: filters.municipalityCode } : {}),
      ...(filters.query ? { query: filters.query.slice(0, 120) } : {}),
    };
    const proposals = await this.repo.findProposals(normalized, 50);
    return Promise.all(proposals.map(proposal => this.summary(proposal)));
  }

  async related(candidate: RelatedCandidateInput): Promise<RelatedProposal[]> {
    const matches = await this.repo.findRecentProposals(100, {
      kind: candidate.kind,
      ...(candidate.municipalityCode ? { municipalityCode: candidate.municipalityCode } : {}),
    });
    return findRelatedProposals(candidate, matches);
  }

  async createProposal(input: unknown, rawSessionToken: string): Promise<{ id: string }> {
    const parsed = validateProposalInput(input);
    const id = this.newId();
    const at = this.now();
    const region = parsed.region ?? null;
    const precision = region?.precision ?? (region ? (region.latitude === undefined ? "municipality" : "approximate_area") : "not_provided");
    const record: NewProposalRecord = {
      id,
      kind: parsed.kind,
      title: parsed.title,
      summary: parsed.summary,
      description: parsed.description,
      desiredChange: parsed.desiredChange,
      municipalityCode: region?.municipalityCode ?? null,
      municipality: region?.municipality ?? null,
      state: region?.state ?? null,
      areaLabel: region?.areaLabel,
      publicLocation: region ? (parsed.publicLocation ?? null) : null,
      latitude: region?.latitude ?? null,
      longitude: region?.longitude ?? null,
      precision,
      pseudonym: parsed.pseudonym ?? null,
      ownerScopeHash: deriveScopedHash(rawSessionToken, "proposal-owner", id),
      createdAt: at,
    };
    const initialClaims: NewClaimRecord[] = (parsed.initialClaims ?? []).map(claim => ({
      id: this.newId(),
      proposalId: id,
      category: claim.category,
      type: claim.type,
      relation: claim.relation,
      statement: claim.statement,
      sourceTitle: claim.sourceTitle ?? null,
      sourceUrl: claim.sourceUrl ?? null,
      sourceExcerpt: claim.sourceExcerpt ?? null,
      jurisdiction: claim.jurisdiction ?? null,
      sourceDate: claim.sourceDate ?? null,
      submittedAt: at,
      status: "community_submitted",
    }));
    await this.repo.createProposal(record, initialClaims);
    return { id };
  }

  async proposal(id: string): Promise<ProposalDetail> {
    const record = await this.repo.findProposal(id);
    if (!record) throw new CivicApplicationError("proposal_not_found", 404);
    const [base, claims, comments, media, candidates] = await Promise.all([
      this.summary(record),
      this.repo.listClaims(id),
      this.repo.listComments(id, 100),
      this.repo.listMedia(id),
      this.repo.findRecentProposals(100, {
        kind: record.kind,
        ...(record.municipalityCode ? { municipalityCode: record.municipalityCode } : {}),
      }),
    ]);
    const related = findRelatedProposals(record as RelatedCandidateInput, candidates.filter(item => item.id !== id));
    return {
      ...base,
      description: record.description,
      desiredChange: record.desiredChange,
      region: record.municipality && record.state
        ? {
            ...(record.municipalityCode ? { municipalityCode: record.municipalityCode } : {}),
            municipality: record.municipality,
            state: record.state,
            ...(record.areaLabel ? { areaLabel: record.areaLabel } : {}),
            ...(record.latitude === null || record.latitude === undefined ? {} : { latitude: record.latitude }),
            ...(record.longitude === null || record.longitude === undefined ? {} : { longitude: record.longitude }),
            ...(record.precision && record.precision !== "not_provided" ? { precision: record.precision } : {}),
          }
        : null,
      claims,
      comments,
      media: media.map(item => ({ id: item.id, mediaType: "image/webp", altText: item.altText, createdAt: item.createdAt })),
      related,
    };
  }

  async vote(proposalId: string, token: string, choice: VoteChoice): Promise<void> {
    if (!["support", "oppose", "need_information"].includes(choice)) throw new CivicApplicationError("invalid_vote_choice");
    if (!(await this.repo.findProposal(proposalId))) throw new CivicApplicationError("proposal_not_found", 404);
    const scopeHash = deriveScopedHash(token, "vote", proposalId);
    await this.repo.recordVote(proposalId, scopeHash, choice, this.now());
  }

  async sessionVote(proposalId: string, token: string): Promise<VoteChoice | null> {
    if (!(await this.repo.findProposal(proposalId))) throw new CivicApplicationError("proposal_not_found", 404);
    return this.repo.findVote(proposalId, deriveScopedHash(token, "vote", proposalId));
  }

  async withdrawVote(proposalId: string, token: string): Promise<void> {
    const scopeHash = deriveScopedHash(token, "vote", proposalId);
    await this.repo.removeVote(proposalId, scopeHash);
  }

  async submitRegion(proposalId: string, token: string, input: unknown): Promise<{ recorded: boolean }> {
    if (!(await this.repo.findProposal(proposalId))) throw new CivicApplicationError("proposal_not_found", 404);
    if (!input || typeof input !== "object" || (input as { consent?: unknown }).consent !== true) throw new CivicApplicationError("region_consent_required", 400);
    const region = (input as { region?: unknown }).region;
    if (!region || typeof region !== "object") throw new CivicApplicationError("invalid_region", 400);
    const value = region as Record<string, unknown>;
    if (typeof value.municipalityCode !== "string" || !/^\d{7}$/.test(value.municipalityCode) || typeof value.municipality !== "string" || value.municipality.length < 2 || value.municipality.length > 120 || typeof value.state !== "string" || !/^[A-Z]{2}$/.test(value.state)) throw new CivicApplicationError("invalid_region", 400);
    const recorded = await this.repo.recordRegion({
      proposalId,
      scopeHash: deriveScopedHash(token, "region", proposalId),
      municipalityCode: value.municipalityCode,
      municipality: value.municipality.trim(),
      state: value.state,
      createdAt: this.now(),
    });
    return { recorded };
  }

  async comment(proposalId: string, input: unknown): Promise<{ id: string }> {
    if (!(await this.repo.findProposal(proposalId))) throw new CivicApplicationError("proposal_not_found", 404);
    const parsed: CreateCommentInput = validateCommentInput(input);
    const comment: NewCommentRecord = {
      id: this.newId(),
      proposalId,
      stance: parsed.stance,
      pseudonym: parsed.pseudonym,
      body: parsed.body,
      createdAt: this.now(),
    };
    await this.repo.addComment(comment);
    return { id: comment.id };
  }

  async addClaim(proposalId: string, input: unknown): Promise<{ id: string }> {
    if (!(await this.repo.findProposal(proposalId))) throw new CivicApplicationError("proposal_not_found", 404);
    const parsed: CreateClaimInput = validateClaimInput(input);
    const submittedAt = this.now();
    const claim: NewClaimRecord = {
      id: this.newId(),
      proposalId,
      category: parsed.category,
      type: parsed.type,
      relation: parsed.relation,
      statement: parsed.statement,
      sourceTitle: parsed.sourceTitle ?? null,
      sourceUrl: parsed.sourceUrl ?? null,
      sourceExcerpt: parsed.sourceExcerpt ?? null,
      jurisdiction: parsed.jurisdiction ?? null,
      sourceDate: parsed.sourceDate ?? null,
      submittedAt,
      status: "community_submitted",
    };
    await this.repo.addClaim(claim);
    return { id: claim.id };
  }

  async uploadMedia(proposalId: string, token: string, bytes: Buffer, declaredMime: string, altText: string, normalizer: (input: Buffer, mime: string) => Promise<{ bytes: Buffer; width: number; height: number }>): Promise<{ id: string }> {
    const proposal = await this.repo.findProposal(proposalId);
    if (!proposal) throw new CivicApplicationError("proposal_not_found", 404);
    const text = altText.trim();
    if (text.length < 5 || text.length > 300 || /<\/?[a-z][^>]*>/i.test(text)) throw new CivicApplicationError("invalid_alt_text", 400);
    let image: { bytes: Buffer; width: number; height: number };
    try {
      image = await normalizer(bytes, declaredMime);
    } catch (error) {
      if (error instanceof CivicApplicationError) throw error;
      throw new CivicApplicationError("photo_invalid", 415);
    }
    const id = this.newId();
    await this.repo.addMedia({
      id,
      proposalId,
      ownerScopeHash: deriveScopedHash(token, "proposal-owner", proposalId),
      bytes: image.bytes,
      altText: text,
      width: image.width,
      height: image.height,
      createdAt: this.now(),
    });
    return { id };
  }

  async deleteMedia(proposalId: string, mediaId: string, token: string): Promise<boolean> {
    return this.repo.removeMedia(mediaId, proposalId, deriveScopedHash(token, "proposal-owner", proposalId));
  }

  async media(id: string) {
    return this.repo.findMedia(id);
  }

  async analytics(): Promise<PublicAnalytics> {
    const [proposalCount, byKind, rawRegions] = await Promise.all([
      this.repo.publicProposalCount(),
      this.repo.proposalCountsByKind(),
      this.repo.listRegionCells(),
    ]);
    const hidden = suppressSmallCells(rawRegions, this.minimumSample);
    const labels = new Map(rawRegions.map(cell => [cell.key, cell]));
    return {
      proposalCount,
      byKind,
      participationLabel: "experimental_sessions_not_unique_people",
      regions: hidden.map(cell => {
        const original = labels.get(cell.key);
        return { municipality: original?.municipality ?? "Localidade não identificada", state: original?.state ?? "", count: cell.count, suppressed: cell.suppressed };
      }),
      updatedAt: this.now(),
    };
  }

  async graph() {
    const [verified, cohorts] = await Promise.all([
      this.repo.listVerifiedProfiles(),
      this.repo.publicProfileCohorts(this.minimumSample),
    ]);
    return projectGraph3d([...verified, ...cohorts], 3);
  }
}
