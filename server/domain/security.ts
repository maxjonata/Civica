import {
  PilotError,
  type Account,
  type PilotState,
  type RuntimeConfig,
  type Session,
} from "../ports/pilot";

export function requireAccount(
  state: PilotState,
  sessionHash: string | null,
  now: number,
  config: RuntimeConfig,
  options: { admin?: boolean; recent?: boolean } = {}
): { account: Account; session: Session } {
  if (!sessionHash) throw new PilotError("authentication_required", 401);
  const session = state.sessions.find(
    candidate => candidate.hash === sessionHash
  );
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    now - session.lastSeenAt > config.sessionIdleMs
  ) {
    throw new PilotError("session_invalid", 401);
  }

  const account = state.accounts.find(
    candidate => candidate.id === session.accountId
  );
  if (!account) throw new PilotError("session_invalid", 401);
  if (options.admin && account.role !== "admin")
    throw new PilotError("admin_required", 403);
  if (options.recent && now - session.authAt > config.recentAuthMs)
    throw new PilotError("recent_auth_required", 403);
  return { account, session };
}

export function enforceRate(
  state: PilotState,
  key: string,
  now: number,
  max: number,
  windowMs: number
): void {
  if (max <= 0 || windowMs <= 0) throw new PilotError("rate_limited", 429);
  let bucket = state.rates.find(candidate => candidate.key === key);
  if (!bucket || now < bucket.start || now - bucket.start >= windowMs) {
    bucket = { key, start: now, count: 0 };
    state.rates = state.rates.filter(candidate => candidate.key !== key);
    state.rates.push(bucket);
  }
  if (bucket.count >= max) throw new PilotError("rate_limited", 429);
  bucket.count += 1;
}
