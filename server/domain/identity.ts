import { PilotError, type Enrollment, type PilotState } from "../ports/pilot";
import type { ReviewDecision, IdentityView } from "../../shared/pilot";
const DAY = 24 * 60 * 60 * 1000;

export function assertDocumentEligibility(
  state: PilotState,
  accountId: string
): void {
  const keys = state.passkeys.filter(key => key.accountId === accountId);
  if (keys.length < 2) throw new PilotError("SECOND_PASSKEY_REQUIRED", 409);
  if (keys.filter(key => key.lastUsedAt !== null).length < 2)
    throw new PilotError("SECOND_PASSKEY_UNTESTED", 409);
}
export function validateDecision(
  state: PilotState,
  enrollment: Enrollment,
  decision: ReviewDecision,
  now: number
): void {
  if (enrollment.status !== "submitted" || !enrollment.evidence)
    throw new PilotError("REVIEW_NOT_PENDING", 409);
  if (decision.decision === "approve" && enrollment.expiresAt <= now)
    throw new PilotError("ENROLLMENT_EXPIRED", 409);
  if (decision.expectedSha256 !== enrollment.evidenceHash)
    throw new PilotError("EVIDENCE_CHANGED", 409);
  if (
    !state.passkeys.some(
      key =>
        key.id === enrollment.credentialId &&
        key.accountId === enrollment.accountId
    )
  )
    throw new PilotError("BOUND_PASSKEY_MISSING", 409);
  if (
    decision.decision === "approve" &&
    (decision.compliance !== "valid" ||
      !decision.trustAnchor ||
      !decision.signedContentConfirmed ||
      !decision.identityConfirmed)
  )
    throw new PilotError("MANUAL_CHECKS_REQUIRED", 400);
}
export function applyDecision(
  state: PilotState,
  enrollment: Enrollment,
  decision: ReviewDecision,
  operatorId: string,
  now: number,
  cpfIndex: string | null
): void {
  validateDecision(state, enrollment, decision, now);
  if (
    cpfIndex &&
    decision.decision === "approve" &&
    state.enrollments.some(
      prior =>
        prior.accountId !== enrollment.accountId &&
        prior.cpfIndex === cpfIndex &&
        prior.status === "approved"
    )
  )
    throw new PilotError("IDENTITY_ALREADY_LINKED", 409);
  enrollment.status = decision.decision === "approve" ? "approved" : "rejected";
  enrollment.cpfIndex = decision.decision === "approve" ? cpfIndex : null;
  enrollment.discardAfter = now + 7 * DAY;
  enrollment.review = {
    operatorId,
    reviewedAt: now,
    sha256: enrollment.evidenceHash!,
    compliance: decision.compliance,
    trustAnchor: decision.trustAnchor,
    signedContentConfirmed: decision.signedContentConfirmed,
    identityConfirmed: decision.identityConfirmed,
    civilUniqueness: enrollment.status === "approved" && cpfIndex !== null,
    independentReview:
      decision.reviewerDifferentPersonConfirmed &&
      operatorId !== enrollment.accountId,
    reportReference: decision.reportReference?.trim() || null,
  };
}
export function purgeExpiredEvidence(state: PilotState, now: number): number {
  let removed = 0;
  for (const enrollment of state.enrollments) {
    if (!enrollment.evidence) continue;
    const deadline = enrollment.discardAfter ?? enrollment.expiresAt + 7 * DAY;
    if (deadline > now) continue;
    enrollment.evidence = null;
    enrollment.discardedAt = now;
    if (enrollment.status === "submitted") enrollment.status = "rejected";
    removed++;
  }
  return removed;
}
export function normalizeCpf(value: string): string {
  if (!/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value))
    throw new PilotError("INVALID_CPF");
  const digits = value.replace(/[.-]/g, "");
  if (/^(\d)\1{10}$/.test(digits)) throw new PilotError("INVALID_CPF");
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let index = 0; index < size; index++)
      sum += Number(digits[index]) * (size + 1 - index);
    const mod = (sum * 10) % 11;
    const expected = mod === 10 ? 0 : mod;
    if (expected !== Number(digits[size])) throw new PilotError("INVALID_CPF");
  }
  return digits;
}
export function identityView(enrollment: Enrollment): IdentityView {
  const approved = enrollment.status === "approved";
  return {
    id: enrollment.id,
    status: enrollment.status,
    issuedAt: enrollment.issuedAt,
    expiresAt: enrollment.expiresAt,
    sha256: enrollment.evidenceHash,
    discardedAt: enrollment.discardedAt,
    signatureChecked: approved && enrollment.review?.compliance === "valid",
    identityIdentified:
      approved && enrollment.review?.identityConfirmed === true,
    civilUniqueness: approved && enrollment.review?.civilUniqueness === true,
    independentReview: enrollment.review?.independentReview === true,
    discardAfter: enrollment.discardAfter,
  };
}
