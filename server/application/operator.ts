import { PilotError, type StateRepository } from "../ports/pilot";
export async function bootstrapAdministrator(
  repo: StateRepository,
  accountId: string,
  now: number
): Promise<void> {
  await repo.transact(state => {
    if (state.adminBootstrapped)
      throw new PilotError("ADMIN_BOOTSTRAP_CONSUMED", 409);
    const account = state.accounts.find(item => item.id === accountId);
    if (!account) throw new PilotError("ACCOUNT_NOT_FOUND", 404);
    const proven = state.sessions.some(
      session =>
        session.accountId === accountId &&
        session.revokedAt === null &&
        session.expiresAt > now &&
        now - session.authAt <= 5 * 60 * 1000 &&
        state.passkeys.some(
          key =>
            key.id === session.credentialId &&
            key.accountId === accountId &&
            key.lastUsedAt !== null &&
            now - key.lastUsedAt <= 5 * 60 * 1000
        )
    );
    if (!proven) throw new PilotError("RECENT_PASSKEY_REQUIRED", 403);
    account.role = "admin";
    state.adminBootstrapped = true;
  });
}
