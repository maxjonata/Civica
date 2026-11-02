import {
  PilotError,
  emptyState,
  type CryptoPort,
  type Envelope,
  type PilotState,
  type StateRepository,
  type StateRepositoryTarget,
} from "../ports/pilot";
import {
  assertBackupPlaintextWithinLimit,
  parseBackupEnvelope,
  parseBackupSnapshot,
} from "./backup-schema";

const AAD = "civica-backup-v1";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const TEST_DATABASE_NAME = /^civica_test_[a-z0-9_]+$/;

function unsafeRestoreTarget(): PilotError {
  return new PilotError("UNSAFE_TEST_DATABASE", 503);
}

function assertSafeRestoreTarget(
  target: StateRepositoryTarget | undefined
): void {
  if (!target) throw unsafeRestoreTarget();
  if (target.kind === "testmemory") return;
  if (
    target.kind === "mysql" &&
    LOCAL_HOSTNAMES.has(target.hostname) &&
    TEST_DATABASE_NAME.test(target.database)
  )
    return;
  throw unsafeRestoreTarget();
}

function hasProtectionFingerprint(
  fingerprints: PilotState["cryptoFingerprints"]
): boolean {
  return Boolean(fingerprints?.document || fingerprints?.cpf);
}

function assertEmptyRestoreTarget(state: PilotState): void {
  if (
    state.accounts.length ||
    state.passkeys.length ||
    state.sessions.length ||
    state.contexts.length ||
    state.challenges.length ||
    state.invites.length ||
    state.enrollments.length ||
    state.rates.length ||
    state.adminBootstrapped ||
    hasProtectionFingerprint(state.cryptoFingerprints)
  )
    throw new PilotError("RESTORE_TARGET_NOT_EMPTY", 409);
}

export async function exportBackup(
  repo: StateRepository,
  crypto: CryptoPort,
  now: number
): Promise<Envelope> {
  const snapshot = await repo.transact(state => {
    const copy = structuredClone(state);
    copy.sessions = [];
    copy.contexts = [];
    copy.challenges = [];
    copy.invites = [];
    copy.rates = [];
    return { version: 1 as const, createdAt: now, state: copy };
  });
  parseBackupSnapshot(snapshot);
  return crypto.encrypt(Buffer.from(JSON.stringify(snapshot), "utf8"), AAD);
}

export async function restoreIsolatedBackup(
  repo: StateRepository,
  crypto: CryptoPort,
  envelope: unknown
): Promise<void> {
  assertSafeRestoreTarget(repo.target);
  const checkedEnvelope = parseBackupEnvelope(envelope);
  const plaintext = crypto.decrypt(checkedEnvelope, AAD);
  assertBackupPlaintextWithinLimit(plaintext);

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(plaintext).toString("utf8"));
  } catch {
    throw new PilotError("INVALID_BACKUP", 400);
  }
  const snapshot = parseBackupSnapshot(decoded);
  const restored: PilotState = {
    ...emptyState(),
    accounts: snapshot.state.accounts,
    passkeys: snapshot.state.passkeys,
    enrollments: snapshot.state.enrollments,
    adminBootstrapped: snapshot.state.adminBootstrapped,
    ...(snapshot.state.cryptoFingerprints
      ? { cryptoFingerprints: snapshot.state.cryptoFingerprints }
      : {}),
  };

  await repo.transact(state => {
    assertEmptyRestoreTarget(state);
    Object.assign(state, restored);
  });
}
