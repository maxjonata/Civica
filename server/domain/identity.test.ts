import { describe, it, expect } from "vitest";
import { emptyState, type Enrollment, type PilotState } from "../ports/pilot";
import {
  assertDocumentEligibility,
  validateDecision,
  applyDecision,
  purgeExpiredEvidence,
  normalizeCpf,
  identityView,
} from "./identity";

function prepared(): PilotState {
  const s = emptyState();
  s.accounts.push({
    id: "protocol-account",
    nickname: "Teste isolado",
    role: "member",
    createdAt: 0,
  });
  for (const id of ["credential-a", "credential-b"])
    s.passkeys.push({
      id,
      accountId: "protocol-account",
      label: id,
      publicKey: "dGVzdA==",
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: 0,
      lastUsedAt: 10,
    });
  return s;
}
function enrollment(): Enrollment {
  return {
    id: "enrollment-test",
    accountId: "protocol-account",
    credentialId: "credential-a",
    keyDigest: "digest",
    nonce: "unique-test-challenge",
    issuedAt: 0,
    expiresAt: 86400000,
    status: "submitted",
    evidenceHash: "a".repeat(64),
    evidence: {
      version: "aes-256-gcm-v1",
      keyId: "test",
      nonce: "n",
      tag: "t",
      ciphertext: "cipher-only",
    },
    submittedAt: 100,
    discardAfter: 86400000 + 7 * 86400000,
    discardedAt: null,
    review: null,
    cpfIndex: null,
  };
}
const valid = {
  decision: "approve" as const,
  expectedSha256: "a".repeat(64),
  compliance: "valid" as const,
  trustAnchor: "govbr" as const,
  signedContentConfirmed: true,
  identityConfirmed: true,
  reviewerDifferentPersonConfirmed: false,
};

describe("identity invariants — protocol fixtures only, no gov.br identity", () => {
  it("requires two credentials with an actual authentication before a real document", () => {
    const s = prepared();
    expect(() =>
      assertDocumentEligibility(s, "protocol-account")
    ).not.toThrow();
    s.passkeys.pop();
    expect(() => assertDocumentEligibility(s, "protocol-account")).toThrow(
      "SECOND_PASSKEY_REQUIRED"
    );
  });
  it("registration of a second key alone is not a tested login", () => {
    const s = prepared();
    s.passkeys[1].lastUsedAt = null;
    expect(() => assertDocumentEligibility(s, "protocol-account")).toThrow(
      "SECOND_PASSKEY_UNTESTED"
    );
  });
  it("rejects expired, replayed, changed-hash and unknown-key evidence", () => {
    const s = prepared();
    const e = enrollment();
    expect(() => validateDecision(s, e, valid, 86400000)).toThrow(
      "ENROLLMENT_EXPIRED"
    );
    e.status = "approved";
    expect(() => validateDecision(s, e, valid, 200)).toThrow(
      "REVIEW_NOT_PENDING"
    );
    e.status = "submitted";
    expect(() =>
      validateDecision(s, e, { ...valid, expectedSha256: "b".repeat(64) }, 200)
    ).toThrow("EVIDENCE_CHANGED");
    s.passkeys.shift();
    expect(() => validateDecision(s, e, valid, 200)).toThrow(
      "BOUND_PASSKEY_MISSING"
    );
  });
  it("never approves indeterminate/invalid signatures or unchecked content/identity", () => {
    for (const compliance of ["invalid", "indeterminate"] as const)
      expect(() =>
        validateDecision(
          prepared(),
          enrollment(),
          { ...valid, compliance },
          200
        )
      ).toThrow("MANUAL_CHECKS_REQUIRED");
    expect(() =>
      validateDecision(
        prepared(),
        enrollment(),
        { ...valid, identityConfirmed: false },
        200
      )
    ).toThrow("MANUAL_CHECKS_REQUIRED");
    expect(() =>
      validateDecision(
        prepared(),
        enrollment(),
        { ...valid, signedContentConfirmed: false },
        200
      )
    ).toThrow("MANUAL_CHECKS_REQUIRED");
  });
  it("a self-review cannot be recorded as independent, nor signature approval as CPF uniqueness", () => {
    const s = prepared();
    const e = enrollment();
    s.enrollments.push(e);
    applyDecision(
      s,
      e,
      { ...valid, reviewerDifferentPersonConfirmed: true },
      "protocol-account",
      200,
      null
    );
    expect(e.review?.independentReview).toBe(false);
    expect(e.review?.civilUniqueness).toBe(false);
    expect(identityView(e)).toMatchObject({
      signatureChecked: true,
      identityIdentified: true,
      civilUniqueness: false,
      independentReview: false,
    });
  });
  it("enforces a unique verified CPF pseudonym transactionally", () => {
    const s = prepared();
    const existing = enrollment();
    existing.id = "prior";
    existing.accountId = "other";
    existing.status = "approved";
    existing.cpfIndex = "pseudonym";
    s.enrollments.push(existing);
    expect(() =>
      applyDecision(s, enrollment(), valid, "operator", 200, "pseudonym")
    ).toThrow("IDENTITY_ALREADY_LINKED");
  });
  it("deletes ciphertext at retention time while keeping minimal audit and hash", () => {
    const s = prepared();
    const e = enrollment();
    e.status = "approved";
    e.discardAfter = 500;
    s.enrollments.push(e);
    expect(purgeExpiredEvidence(s, 499)).toBe(0);
    expect(e.evidence).not.toBeNull();
    expect(purgeExpiredEvidence(s, 500)).toBe(1);
    expect(e.evidence).toBeNull();
    expect(e.evidenceHash).toBe("a".repeat(64));
    expect(e.discardedAt).toBe(500);
  });
  it("does not accept obviously invalid CPFs as an identity claim", () => {
    for (const value of ["00000000000", "111.111.111-11", "not-a-cpf", "123"])
      expect(() => normalizeCpf(value)).toThrow("INVALID_CPF");
  });
});
