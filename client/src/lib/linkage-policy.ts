import type { CredentialView, IdentityView } from "../../../shared/pilot";
export function testedCredentials(keys: CredentialView[]): boolean {
  return keys.filter(key => key.lastUsedAt !== null).length >= 2;
}
export function issuedDocumentId(identity: IdentityView | null): string | null {
  return identity?.status === "issued" ? identity.id : null;
}
