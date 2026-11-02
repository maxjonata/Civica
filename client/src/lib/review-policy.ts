import type { ReviewDecision } from "../../../shared/pilot";
export function canApproveManualReview(
  checks: Pick<
    ReviewDecision,
    | "compliance"
    | "trustAnchor"
    | "signedContentConfirmed"
    | "identityConfirmed"
    | "reviewerDifferentPersonConfirmed"
  >,
  _isSelf: boolean
): boolean {
  return (
    checks.compliance === "valid" &&
    checks.trustAnchor !== null &&
    checks.signedContentConfirmed &&
    checks.identityConfirmed
  );
}
