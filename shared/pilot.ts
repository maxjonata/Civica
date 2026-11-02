export interface CredentialView {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
  isCurrent: boolean;
  boundToDocument: boolean;
}
export interface IdentityView {
  id: string;
  status: "issued" | "submitted" | "approved" | "rejected";
  issuedAt: number;
  expiresAt: number;
  sha256: string | null;
  discardedAt: number | null;
  signatureChecked: boolean;
  identityIdentified: boolean;
  civilUniqueness: boolean;
  independentReview: boolean;
  discardAfter: number | null;
}
export interface SessionView {
  account: {
    id: string;
    nickname: string;
    role: "member" | "admin";
    createdAt: number;
  } | null;
  credentials: CredentialView[];
  csrfToken: string;
  recentAuth: boolean;
  identity: IdentityView | null;
  configuration: {
    ready: boolean;
    origin: string;
    rpID: string;
    documentProtectionReady: boolean;
    cpfUniquenessReady: boolean;
    requiresInvite: true;
    maxPdfBytes: number;
  };
}
export interface ReviewView extends IdentityView {
  accountId: string;
  nickname: string;
  expectedChallenge: string;
  expectedKeyDigest: string;
  expectedCredentialId: string;
}
export interface ReviewDecision {
  decision: "approve" | "reject";
  expectedSha256: string;
  compliance: "valid" | "invalid" | "indeterminate";
  trustAnchor: "govbr" | "icpbrasil" | null;
  signedContentConfirmed: boolean;
  identityConfirmed: boolean;
  cpf?: string;
  reviewerDifferentPersonConfirmed: boolean;
  reportReference?: string;
}
/** REST API: GET /api/session; POST /api/auth/{register,login,reauth,credentials}/{options,verify}; POST /api/auth/logout; DELETE /api/auth/credentials/:id; POST /api/identity/document; GET /api/identity/document/:id; POST /api/identity/:id/evidence (raw application/pdf, X-Evidence-Consent: accepted); GET /api/admin/reviews; GET /api/admin/reviews/:id/evidence; POST /api/admin/reviews/:id/decision; POST /api/admin/reviews/:id/discard. Every mutation requires Origin and X-CSRF-Token. Options/verify return SimpleWebAuthn JSON directly/options and {ok:true} on verification. Document creation returns {id}. */
