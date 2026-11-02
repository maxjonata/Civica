import type {
  ProposalKind,
  VoteChoice,
} from "@shared/civic/contracts";
import type { ClaimRecord, PolicyProfileRecord, ProposalRecord, PublicCell, RegionCell } from "../domain/types";

export interface CivicSessionRecord {
  tokenHash: string;
  csrfHash: string;
  createdAt: number;
  expiresAt: number;
  rateWindowStart: number;
  mutationCount: number;
}

export interface NewProposalRecord extends Omit<ProposalRecord, "pseudonym"> {
  ownerScopeHash: string;
  latitude: number | null;
  longitude: number | null;
  precision: "municipality" | "approximate_area" | "not_provided";
  pseudonym: string | null;
}

export interface NewCommentRecord {
  id: string;
  proposalId: string;
  stance: "supporting_evidence" | "challenging_evidence" | "question" | "other";
  pseudonym: string;
  body: string;
  createdAt: number;
}

export interface NewClaimRecord extends Omit<ClaimRecord, "status" | "checkedAt"> {
  status: "community_submitted";
}

export interface NewMediaRecord {
  id: string;
  proposalId: string;
  ownerScopeHash: string;
  bytes: Buffer;
  altText: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface MediaRecord {
  id: string;
  proposalId: string;
  bytes: Buffer;
  altText: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface NewRegionSubmission {
  proposalId: string;
  scopeHash: string;
  municipalityCode: string;
  municipality: string;
  state: string;
  createdAt: number;
}

export interface CivicRepository {
  ping(): Promise<void>;
  findSession(tokenHash: string, now: number): Promise<CivicSessionRecord | null>;
  createSession(session: CivicSessionRecord): Promise<void>;
  rotateCsrfHash(tokenHash: string, csrfHash: string, now: number): Promise<void>;
  incrementMutation(tokenHash: string, now: number, maxPerWindow: number, windowMs: number): Promise<boolean>;
  createProposal(proposal: NewProposalRecord, initialClaims?: NewClaimRecord[]): Promise<void>;
  findProposal(id: string): Promise<ProposalRecord | null>;
  findRecentProposals(limit: number, filters?: { kind?: ProposalKind; municipalityCode?: string }): Promise<ProposalRecord[]>;
  findProposals(filters: { kind?: ProposalKind; municipalityCode?: string; query?: string }, limit: number): Promise<ProposalRecord[]>;
  recordVote(proposalId: string, voterScopeHash: string, choice: VoteChoice, now: number): Promise<void>;
  findVote(proposalId: string, voterScopeHash: string): Promise<VoteChoice | null>;
  removeVote(proposalId: string, voterScopeHash: string): Promise<void>;
  voteCounts(proposalId: string): Promise<Record<VoteChoice, number>>;
  voteCount(proposalId: string): Promise<number>;
  listRegionCells(proposalId?: string): Promise<RegionCell[]>;
  recordRegion(submission: NewRegionSubmission): Promise<boolean>;
  addComment(comment: NewCommentRecord): Promise<void>;
  listComments(proposalId: string, limit: number): Promise<NewCommentRecord[]>;
  countComments(proposalId: string): Promise<number>;
  addClaim(claim: NewClaimRecord): Promise<void>;
  listClaims(proposalId: string): Promise<ClaimRecord[]>;
  addMedia(media: NewMediaRecord): Promise<void>;
  findMedia(id: string): Promise<MediaRecord | null>;
  removeMedia(id: string, proposalId: string, ownerScopeHash: string): Promise<boolean>;
  listMedia(proposalId: string): Promise<Array<Omit<MediaRecord, "bytes">>>;
  publicProposalCount(): Promise<number>;
  proposalCountsByKind(): Promise<Record<ProposalKind, number>>;
  listVerifiedProfiles(): Promise<PolicyProfileRecord[]>;
  saveProfileSubmission(scopeHash: string, answers: Record<string, number>, now: number): Promise<boolean>;
  publicProfileCohorts(minimumSample: number): Promise<PolicyProfileRecord[]>;
  close?(): Promise<void>;
}

export interface SuppressedRegionCell extends PublicCell {}
