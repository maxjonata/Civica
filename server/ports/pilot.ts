export type AccountRole = "member" | "admin";
export interface Account {
  id: string;
  nickname: string;
  role: AccountRole;
  createdAt: number;
}
export interface Passkey {
  id: string;
  accountId: string;
  label: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}
export interface Session {
  hash: string;
  accountId: string;
  credentialId: string;
  authAt: number;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revokedAt: number | null;
}
export interface BrowserContext {
  hash: string;
  csrf: string;
  expiresAt: number;
}
export interface AuthChallenge {
  id: string;
  contextHash: string;
  kind: "register" | "login" | "add" | "reauth";
  accountId: string | null;
  options: unknown;
  nickname?: string;
  inviteHash?: string;
  label?: string;
  expiresAt: number;
  usedAt: number | null;
}
export interface Invite {
  hash: string;
  expiresAt: number;
  usedAt: number | null;
  accountId: string | null;
}
export interface Envelope {
  version: "aes-256-gcm-v1";
  keyId: string;
  nonce: string;
  tag: string;
  ciphertext: string;
}
export type EnrollmentStatus = "issued" | "submitted" | "approved" | "rejected";
export interface ReviewRecord {
  operatorId: string;
  reviewedAt: number;
  sha256: string;
  compliance: "valid" | "invalid" | "indeterminate";
  trustAnchor: "govbr" | "icpbrasil" | null;
  signedContentConfirmed: boolean;
  identityConfirmed: boolean;
  civilUniqueness: boolean;
  independentReview: boolean;
  reportReference: string | null;
}
export interface Enrollment {
  id: string;
  accountId: string;
  credentialId: string;
  keyDigest: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  status: EnrollmentStatus;
  evidenceHash: string | null;
  evidence: Envelope | null;
  submittedAt: number | null;
  discardAfter: number | null;
  discardedAt: number | null;
  review: ReviewRecord | null;
  cpfIndex: string | null;
}
export interface RateBucket {
  key: string;
  start: number;
  count: number;
}
export interface PilotState {
  version: 1;
  accounts: Account[];
  passkeys: Passkey[];
  sessions: Session[];
  contexts: BrowserContext[];
  challenges: AuthChallenge[];
  invites: Invite[];
  enrollments: Enrollment[];
  rates: RateBucket[];
  adminBootstrapped: boolean;
  cryptoFingerprints?: { document: string | null; cpf: string | null };
}
export function emptyState(): PilotState {
  return {
    version: 1,
    accounts: [],
    passkeys: [],
    sessions: [],
    contexts: [],
    challenges: [],
    invites: [],
    enrollments: [],
    rates: [],
    adminBootstrapped: false,
  };
}
export type StateRepositoryTarget =
  | { readonly kind: "testmemory" }
  | {
      readonly kind: "mysql";
      readonly hostname: string;
      readonly database: string;
    };
export interface StateRepository {
  /** Atomic serialized transaction; implementations must rollback exceptions and never leak mutable state outside the transaction. */
  transact<T>(operation: (state: PilotState) => Promise<T> | T): Promise<T>;
  readonly target?: StateRepositoryTarget;
  close?(): Promise<void>;
}
export interface Clock {
  now(): number;
}
export interface RandomSource {
  token(bytes?: number): string;
}
export interface CryptoPort {
  sha256(bytes: Uint8Array | string): string;
  encrypt(bytes: Uint8Array, aad: string): Envelope;
  decrypt(envelope: Envelope, aad: string): Uint8Array;
  cpfIndex(cpf: string): string;
  readonly encryptionReady: boolean;
  readonly cpfReady: boolean;
  readonly fingerprints: { document: string | null; cpf: string | null };
}
export interface DocumentPort {
  create(enrollment: Enrollment, nickname: string): Promise<Uint8Array>;
}
export interface RuntimeConfig {
  rpID: string;
  origins: string[];
  primaryOrigin: string;
  secureCookies: boolean;
  sessionLifetimeMs: number;
  sessionIdleMs: number;
  recentAuthMs: number;
  maxAccounts: number;
  configured: boolean;
}
export interface RequestIdentity {
  contextHash: string;
  sessionHash: string | null;
}
export class PilotError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400
  ) {
    super(code);
    this.name = "PilotError";
  }
}
