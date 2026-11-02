export const proposalKinds = ["public_work", "legislative_change", "public_service"] as const;
export type ProposalKind = (typeof proposalKinds)[number];
export type VoteChoice = "support" | "oppose" | "need_information";
export type ClaimRelation = "supports" | "challenges" | "context" | "unknown";
export type ClaimType = "participant_report" | "documented_fact" | "hypothesis" | "estimate" | "projection" | "missing_information";
export type ClaimCategory = "authority" | "contact" | "cost" | "timeline" | "legislation" | "jurisprudence" | "other";

export interface CivicSessionResponse {
  csrfToken: string;
  expiresAt: number;
  mode: "experimental";
}

export interface IbgeStateOption {
  id: number;
  sigla: string;
  nome: string;
}

export interface IbgeMunicipalityOption {
  id: number;
  nome: string;
}

export interface CivicRegionInput {
  municipalityCode?: string | null;
  municipality: string;
  state: string;
  areaLabel?: string;
  latitude?: number;
  longitude?: number;
  precision?: "municipality" | "approximate_area";
}

export interface CreateProposalInput {
  kind: ProposalKind;
  title: string;
  summary: string;
  description: string;
  desiredChange: string;
  region?: CivicRegionInput | null;
  initialClaims?: CreateClaimInput[];
  publicLocation?: string;
  pseudonym?: string;
  acceptPublicPreview: true;
}

export interface ProposalListItem {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  municipality: string | null;
  state: string | null;
  regionStatus: "user_provided_unverified" | "not_provided";
  publicLocation: string | null;
  createdAt: number;
  commentCount: number;
  relatedCount: number;
  result: PublicVoteResult;
}

export interface CivicComment {
  id: string;
  stance: "supporting_evidence" | "challenging_evidence" | "question" | "other";
  pseudonym: string;
  body: string;
  createdAt: number;
}

export interface DossierClaim {
  id: string;
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

export interface CivicMediaView {
  id: string;
  mediaType: "image/webp";
  altText: string;
  createdAt: number;
}

export interface ProposalDetail extends ProposalListItem {
  description: string;
  desiredChange: string;
  region: CivicRegionInput | null;
  claims: DossierClaim[];
  comments: CivicComment[];
  media: CivicMediaView[];
  related: RelatedProposal[];
}

export interface PublicVoteResult {
  visible: boolean;
  reason: "minimum_sample" | "small_choice_cell" | null;
  minimumSample: number;
  total: number | null;
  choices: Record<VoteChoice, number> | null;
}

export interface RelatedProposal {
  proposal: Pick<ProposalListItem, "id" | "title" | "kind" | "municipality" | "state">;
  score: number;
  sharedTerms: string[];
  explanation: string;
}

export interface CreateCommentInput {
  stance: CivicComment["stance"];
  pseudonym: string;
  body: string;
}

export interface CreateClaimInput {
  category: ClaimCategory;
  type: ClaimType;
  relation: ClaimRelation;
  statement: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceExcerpt?: string;
  jurisdiction?: string;
  sourceDate?: string;
}

export interface PublicAnalytics {
  proposalCount: number;
  byKind: Record<ProposalKind, number>;
  participationLabel: "experimental_sessions_not_unique_people";
  regions: Array<{ municipality: string; state: string; count: number | null; suppressed: boolean }>;
  updatedAt: number;
}

export interface PublicPolicyProfile {
  id: string;
  label: string;
  kind: "public_authority" | "voluntary_cohort";
  positionSources: Array<{ topic: string; sourceTitle: string; sourceUrl: string; sourceDate: string }>;
  positions: Record<string, number>;
  coverage: number;
}

export interface PublicGraph {
  methodVersion: string;
  methodDescription: string;
  minimumSharedDimensions: number;
  excludedProfileCount: number;
  nodes: Array<{ id: string; label: string; kind: PublicPolicyProfile["kind"]; x: number; y: number; z: number; coverage: number }>;
  edges: Array<{ source: string; target: string; distance: number; sharedDimensions: string[] }>;
  profiles: PublicPolicyProfile[];
  emptyReason: "no_verified_positions" | "insufficient_comparable_data" | null;
}

export interface LegislativeMatch {
  source: "Câmara dos Deputados";
  id: number;
  type: string;
  number: number;
  year: number;
  summary: string;
  presentedAt: string | null;
  officialUrl: string;
  matchNote: "keyword_match_requires_human_review";
}

export interface CivicApiError {
  error: string;
}

export interface CivicApi {
  session(): Promise<CivicSessionResponse>;
  states(): Promise<IbgeStateOption[]>;
  municipalities(uf: string): Promise<IbgeMunicipalityOption[]>;
  proposals(filters?: { kind?: ProposalKind; municipalityCode?: string; query?: string }): Promise<ProposalListItem[]>;
  proposal(id: string): Promise<ProposalDetail>;
  related(input: Pick<CreateProposalInput, "kind" | "title" | "summary" | "description" | "region">): Promise<RelatedProposal[]>;
  createProposal(input: CreateProposalInput): Promise<{ id: string }>;
  sessionVote(proposalId: string): Promise<{ choice: VoteChoice | null }>;
  vote(proposalId: string, choice: VoteChoice): Promise<void>;
  withdrawVote(proposalId: string): Promise<void>;
  comment(proposalId: string, input: CreateCommentInput): Promise<{ id: string }>;
  addClaim(proposalId: string, input: CreateClaimInput): Promise<{ id: string }>;
  uploadPhoto(proposalId: string, file: File, altText: string, publicConsent: true): Promise<{ id: string }>;
  deletePhoto(proposalId: string, mediaId: string): Promise<void>;
  analytics(): Promise<PublicAnalytics>;
  graph(): Promise<PublicGraph>;
  legislativeSearch(query: string): Promise<LegislativeMatch[]>;
}
