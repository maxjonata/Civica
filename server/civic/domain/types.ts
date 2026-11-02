import type { ClaimCategory, ClaimRelation, ClaimType, ProposalKind, VoteChoice } from "@shared/civic/contracts";

export interface ProposalRecord {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  description: string;
  desiredChange: string;
  municipalityCode: string | null;
  municipality: string | null;
  state: string | null;
  areaLabel?: string | null;
  publicLocation: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precision?: "municipality" | "approximate_area" | "not_provided";
  pseudonym?: string | null;
  createdAt: number;
}

export interface VoteRecord {
  choice: VoteChoice;
}

export interface RegionCell {
  key: string;
  municipalityCode: string;
  municipality: string;
  state: string;
  count: number;
}

export interface PublicCell {
  key: string;
  count: number | null;
  suppressed: boolean;
}

export interface PolicyPositionRecord {
  topic: string;
  value: number;
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
}

export interface PolicyProfileRecord {
  id: string;
  label: string;
  kind: "public_authority" | "voluntary_cohort";
  verified: boolean;
  positions: PolicyPositionRecord[];
}

export interface RelatedCandidateInput {
  kind: ProposalKind;
  title: string;
  summary: string;
  description: string;
  municipalityCode: string | null;
  municipality: string | null;
  state: string | null;
}

export interface ClaimRecord {
  id: string;
  proposalId: string;
  category: ClaimCategory;
  type: ClaimType;
  relation: ClaimRelation;
  statement: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceExcerpt: string | null;
  jurisdiction: string | null;
  sourceDate: string | null;
  submittedAt: number;
  checkedAt: number | null;
  status: "community_submitted" | "source_checked";
}
