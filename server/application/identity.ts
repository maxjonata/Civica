import {
  PilotError,
  type Account,
  type Clock,
  type CryptoPort,
  type DocumentPort,
  type Enrollment,
  type RandomSource,
  type Session,
  type StateRepository,
  type PilotState,
} from "../ports/pilot";
import type { ReviewDecision, ReviewView } from "../../shared/pilot";
import {
  applyDecision,
  assertDocumentEligibility,
  identityView,
  normalizeCpf,
  purgeExpiredEvidence,
} from "../domain/identity";
export const MAX_PDF_BYTES = 2 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
export interface IdentityDependencies {
  repo: StateRepository;
  crypto: CryptoPort;
  document: DocumentPort;
  clock: Clock;
  random: RandomSource;
  authorizer: {
    require(
      state: PilotState,
      sessionHash: string | null,
      now: number,
      options?: { admin?: boolean; recent?: boolean }
    ): { account: Account; session: Session };
  };
}
export class IdentityService {
  constructor(private readonly deps: IdentityDependencies) {}
  private owned(state: PilotState, id: string, accountId: string): Enrollment {
    const e = state.enrollments.find(
      item => item.id === id && item.accountId === accountId
    );
    if (!e) throw new PilotError("ENROLLMENT_NOT_FOUND", 404);
    return e;
  }
  private selected(state: PilotState, id: string): Enrollment {
    const e = state.enrollments.find(item => item.id === id);
    if (!e) throw new PilotError("ENROLLMENT_NOT_FOUND", 404);
    return e;
  }
  private aad(enrollment: Enrollment): string {
    return `civica-evidence-v1\0${enrollment.accountId}\0${enrollment.id}\0${enrollment.nonce}`;
  }
  async issue(hash: string | null): Promise<Enrollment> {
    if (!this.deps.crypto.encryptionReady)
      throw new PilotError("DOCUMENT_PROTECTION_NOT_CONFIGURED", 503);
    return this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      const { account, session } = this.deps.authorizer.require(
        state,
        hash,
        now,
        { recent: true }
      );
      purgeExpiredEvidence(state, now);
      assertDocumentEligibility(state, account.id);
      const prior = [...state.enrollments]
        .reverse()
        .find(
          item =>
            item.accountId === account.id &&
            (item.status === "issued" || item.status === "submitted") &&
            item.expiresAt > now
        );
      if (prior) return prior;
      if (
        state.enrollments.filter(item => item.accountId === account.id)
          .length >= 20
      )
        throw new PilotError("ENROLLMENT_LIMIT_REACHED", 429);
      const passkey = state.passkeys.find(
        key => key.id === session.credentialId && key.accountId === account.id
      );
      if (!passkey) throw new PilotError("BOUND_PASSKEY_MISSING", 409);
      const enrollment: Enrollment = {
        id: this.deps.random.token(24),
        accountId: account.id,
        credentialId: passkey.id,
        keyDigest: this.deps.crypto.sha256(
          Buffer.from(passkey.publicKey, "base64")
        ),
        nonce: this.deps.random.token(32),
        issuedAt: now,
        expiresAt: now + DAY,
        status: "issued",
        evidenceHash: null,
        evidence: null,
        submittedAt: null,
        discardAfter: null,
        discardedAt: null,
        review: null,
        cpfIndex: null,
      };
      state.enrollments.push(enrollment);
      return enrollment;
    });
  }
  async authorizeUpload(hash: string | null, id: string): Promise<void> {
    await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      const { account } = this.deps.authorizer.require(state, hash, now, {
        recent: true,
      });
      const e = this.owned(state, id, account.id);
      assertDocumentEligibility(state, account.id);
      if (!this.deps.crypto.encryptionReady)
        throw new PilotError("DOCUMENT_PROTECTION_NOT_CONFIGURED", 503);
      if (e.status !== "issued")
        throw new PilotError("ENROLLMENT_NOT_ISSUED", 409);
      if (e.expiresAt <= now) throw new PilotError("ENROLLMENT_EXPIRED", 409);
    });
  }
  async documentBytes(hash: string | null, id: string): Promise<Uint8Array> {
    const data = await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      const { account } = this.deps.authorizer.require(state, hash, now);
      const enrollment = this.owned(state, id, account.id);
      if (enrollment.status !== "issued")
        throw new PilotError("ENROLLMENT_NOT_ISSUED", 409);
      if (enrollment.expiresAt <= now)
        throw new PilotError("ENROLLMENT_EXPIRED", 409);
      return { enrollment, nickname: account.nickname };
    });
    return this.deps.document.create(data.enrollment, data.nickname);
  }
  async submit(
    hash: string | null,
    id: string,
    bytes: Uint8Array,
    consent: boolean
  ): Promise<void> {
    if (!consent) throw new PilotError("EVIDENCE_CONSENT_REQUIRED");
    if (!this.deps.crypto.encryptionReady)
      throw new PilotError("DOCUMENT_PROTECTION_NOT_CONFIGURED", 503);
    if (bytes.byteLength > MAX_PDF_BYTES)
      throw new PilotError("PDF_TOO_LARGE", 413);
    if (
      bytes.byteLength < 8 ||
      Buffer.from(bytes).subarray(0, 5).toString("ascii") !== "%PDF-"
    )
      throw new PilotError("INVALID_PDF", 415);
    await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      const { account } = this.deps.authorizer.require(state, hash, now, {
        recent: true,
      });
      const e = this.owned(state, id, account.id);
      assertDocumentEligibility(state, account.id);
      if (e.status !== "issued")
        throw new PilotError("ENROLLMENT_NOT_ISSUED", 409);
      if (e.expiresAt <= now) throw new PilotError("ENROLLMENT_EXPIRED", 409);
      const key = state.passkeys.find(
        item => item.id === e.credentialId && item.accountId === e.accountId
      );
      if (
        !key ||
        this.deps.crypto.sha256(Buffer.from(key.publicKey, "base64")) !==
          e.keyDigest
      )
        throw new PilotError("BOUND_PASSKEY_MISSING", 409);
      e.evidence = this.deps.crypto.encrypt(bytes, this.aad(e));
      e.evidenceHash = this.deps.crypto.sha256(bytes);
      e.status = "submitted";
      e.submittedAt = now;
      e.discardAfter = e.expiresAt + 7 * DAY;
    });
  }
  async reviews(hash: string | null): Promise<ReviewView[]> {
    return this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      this.deps.authorizer.require(state, hash, now, {
        admin: true,
        recent: true,
      });
      purgeExpiredEvidence(state, now);
      return state.enrollments
        .filter(item => item.status !== "issued")
        .map(e => ({
          ...identityView(e),
          accountId: e.accountId,
          expectedChallenge: e.nonce,
          expectedKeyDigest: e.keyDigest,
          expectedCredentialId: e.credentialId,
          nickname:
            state.accounts.find(a => a.id === e.accountId)?.nickname ??
            "Conta indisponível",
        }));
    });
  }
  async evidenceBytes(hash: string | null, id: string): Promise<Uint8Array> {
    const e = await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      this.deps.authorizer.require(state, hash, now, {
        admin: true,
        recent: true,
      });
      const selected = this.selected(state, id);
      if (!selected.evidence || (selected.discardAfter ?? 0) <= now)
        throw new PilotError("EVIDENCE_NOT_AVAILABLE", 410);
      return selected;
    });
    const bytes = this.deps.crypto.decrypt(e.evidence!, this.aad(e));
    if (this.deps.crypto.sha256(bytes) !== e.evidenceHash)
      throw new PilotError("EVIDENCE_CHANGED", 409);
    return bytes;
  }
  async decide(
    hash: string | null,
    id: string,
    decision: ReviewDecision
  ): Promise<void> {
    await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      const { account } = this.deps.authorizer.require(state, hash, now, {
        admin: true,
        recent: true,
      });
      const e = this.selected(state, id);
      if (e.discardAfter !== null && e.discardAfter <= now)
        throw new PilotError("EVIDENCE_NOT_AVAILABLE", 410);
      const key = state.passkeys.find(
        item => item.id === e.credentialId && item.accountId === e.accountId
      );
      if (
        !key ||
        this.deps.crypto.sha256(Buffer.from(key.publicKey, "base64")) !==
          e.keyDigest
      )
        throw new PilotError("BOUND_PASSKEY_MISSING", 409);
      const cpfIndex =
        decision.decision === "approve" && decision.cpf
          ? this.deps.crypto.cpfIndex(normalizeCpf(decision.cpf))
          : null;
      applyDecision(state, e, decision, account.id, now, cpfIndex);
    });
  }
  async discard(hash: string | null, id: string): Promise<void> {
    await this.deps.repo.transact(state => {
      const now = this.deps.clock.now();
      this.deps.authorizer.require(state, hash, now, {
        admin: true,
        recent: true,
      });
      const e = this.selected(state, id);
      e.evidence = null;
      e.discardedAt = now;
      if (e.status === "submitted") e.status = "rejected";
    });
  }
  async purge(): Promise<number> {
    return this.deps.repo.transact(state =>
      purgeExpiredEvidence(state, this.deps.clock.now())
    );
  }
}
