import { z } from "zod";
import { PilotError, type Envelope, type PilotState } from "../ports/pilot";

export const BACKUP_MAX_PLAINTEXT_BYTES = 9 * 1024 * 1024;
export const BACKUP_MAX_CIPHERTEXT_BYTES = BACKUP_MAX_PLAINTEXT_BYTES;
export const BACKUP_MAX_CIPHERTEXT_BASE64_LENGTH =
  4 * Math.ceil(BACKUP_MAX_CIPHERTEXT_BYTES / 3);
export const BACKUP_MAX_ENVELOPE_FILE_BYTES =
  BACKUP_MAX_CIPHERTEXT_BASE64_LENGTH + 4096;

const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const text = z.string().min(1).max(4096);
const optionalText = z.string().max(4096);
const safeInteger = z
  .number()
  .refine(value => Number.isSafeInteger(value) && value >= 0);
const nonNegativeInteger = safeInteger;
const arrayLimit = 100_000;

function base64(maxBytes: number) {
  const maxChars = 4 * Math.ceil(maxBytes / 3);
  return z.string().superRefine((value, context) => {
    if (value.length > maxChars) {
      context.addIssue({ code: "custom", message: "base64_too_large" });
      return;
    }
    if (!BASE64.test(value)) {
      context.addIssue({ code: "custom", message: "invalid_base64" });
      return;
    }
    if (Buffer.from(value, "base64").byteLength > maxBytes)
      context.addIssue({ code: "custom", message: "base64_too_large" });
  });
}

const nonce = base64(12)
  .refine(value => Buffer.from(value, "base64").byteLength === 12)
  .describe("AES-GCM nonce");
const tag = base64(16)
  .refine(value => Buffer.from(value, "base64").byteLength === 16)
  .describe("AES-GCM authentication tag");
const ciphertext = base64(BACKUP_MAX_CIPHERTEXT_BYTES).describe(
  "bounded AES-GCM ciphertext"
);

export const backupEnvelopeSchema = z
  .object({
    version: z.literal("aes-256-gcm-v1"),
    keyId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    nonce,
    tag,
    ciphertext,
  })
  .strict();

const accountSchema = z
  .object({
    id: text.max(256),
    nickname: optionalText.max(256),
    role: z.enum(["member", "admin"]),
    createdAt: safeInteger,
  })
  .strict();

const passkeySchema = z
  .object({
    id: text.max(256),
    accountId: text.max(256),
    label: optionalText.max(256),
    publicKey: base64(64 * 1024),
    counter: nonNegativeInteger,
    transports: z.array(z.string().max(64)).max(32),
    deviceType: text.max(128),
    backedUp: z.boolean(),
    createdAt: safeInteger,
    lastUsedAt: safeInteger.nullable(),
  })
  .strict();

const sessionSchema = z
  .object({
    hash: text.max(256),
    accountId: text.max(256),
    credentialId: text.max(256),
    authAt: safeInteger,
    createdAt: safeInteger,
    lastSeenAt: safeInteger,
    expiresAt: safeInteger,
    revokedAt: safeInteger.nullable(),
  })
  .strict();

const contextSchema = z
  .object({
    hash: text.max(256),
    csrf: text.max(256),
    expiresAt: safeInteger,
  })
  .strict();

const challengeSchema = z
  .object({
    id: text.max(256),
    contextHash: text.max(256),
    kind: z.enum(["register", "login", "add", "reauth"]),
    accountId: text.max(256).nullable(),
    options: z.record(z.string().max(256), z.unknown()),
    nickname: optionalText.max(256).optional(),
    inviteHash: text.max(256).optional(),
    label: optionalText.max(256).optional(),
    expiresAt: safeInteger,
    usedAt: safeInteger.nullable(),
  })
  .strict();

const inviteSchema = z
  .object({
    hash: text.max(256),
    expiresAt: safeInteger,
    usedAt: safeInteger.nullable(),
    accountId: text.max(256).nullable(),
  })
  .strict();

const reviewSchema = z
  .object({
    operatorId: text.max(256),
    reviewedAt: safeInteger,
    sha256: text.max(256),
    compliance: z.enum(["valid", "invalid", "indeterminate"]),
    trustAnchor: z.enum(["govbr", "icpbrasil"]).nullable(),
    signedContentConfirmed: z.boolean(),
    identityConfirmed: z.boolean(),
    civilUniqueness: z.boolean(),
    independentReview: z.boolean(),
    reportReference: optionalText.max(4096).nullable(),
  })
  .strict();

const enrollmentSchema = z
  .object({
    id: text.max(256),
    accountId: text.max(256),
    credentialId: text.max(256),
    keyDigest: text.max(256),
    nonce: text.max(4096),
    issuedAt: safeInteger,
    expiresAt: safeInteger,
    status: z.enum(["issued", "submitted", "approved", "rejected"]),
    evidenceHash: optionalText.max(256).nullable(),
    evidence: backupEnvelopeSchema.nullable(),
    submittedAt: safeInteger.nullable(),
    discardAfter: safeInteger.nullable(),
    discardedAt: safeInteger.nullable(),
    review: reviewSchema.nullable(),
    cpfIndex: optionalText.max(512).nullable(),
  })
  .strict();

const rateBucketSchema = z
  .object({
    key: text.max(512),
    start: safeInteger,
    count: nonNegativeInteger,
  })
  .strict();

const fingerprintSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/)
  .nullable();

export const pilotStateSchema = z
  .object({
    version: z.literal(1),
    accounts: z.array(accountSchema).max(arrayLimit),
    passkeys: z.array(passkeySchema).max(arrayLimit),
    sessions: z.array(sessionSchema).max(arrayLimit),
    contexts: z.array(contextSchema).max(arrayLimit),
    challenges: z.array(challengeSchema).max(arrayLimit),
    invites: z.array(inviteSchema).max(arrayLimit),
    enrollments: z.array(enrollmentSchema).max(arrayLimit),
    rates: z.array(rateBucketSchema).max(arrayLimit),
    adminBootstrapped: z.boolean(),
    cryptoFingerprints: z
      .object({ document: fingerprintSchema, cpf: fingerprintSchema })
      .strict()
      .optional(),
  })
  .strict();

export const backupSnapshotSchema = z
  .object({
    version: z.literal(1),
    createdAt: safeInteger,
    state: pilotStateSchema,
  })
  .strict();

export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;

function invalidBackup(): PilotError {
  return new PilotError("INVALID_BACKUP", 400);
}

export function parseBackupEnvelope(input: unknown): Envelope {
  const parsed = backupEnvelopeSchema.safeParse(input);
  if (!parsed.success) throw invalidBackup();
  return parsed.data;
}

export function parseBackupSnapshot(input: unknown): BackupSnapshot {
  const parsed = backupSnapshotSchema.safeParse(input);
  if (!parsed.success) throw invalidBackup();
  return parsed.data as BackupSnapshot;
}

export function assertBackupPlaintextWithinLimit(bytes: Uint8Array): void {
  if (bytes.byteLength > BACKUP_MAX_PLAINTEXT_BYTES) throw invalidBackup();
}

export function asPilotState(snapshot: BackupSnapshot): PilotState {
  return snapshot.state as PilotState;
}
