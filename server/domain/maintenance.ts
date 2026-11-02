import type { PilotState } from "../ports/pilot";
export function pruneOperationalState(state: PilotState, now: number): void {
  state.contexts = state.contexts.filter(item => item.expiresAt > now);
  state.challenges = state.challenges.filter(
    item =>
      item.expiresAt > now &&
      item.usedAt === null &&
      state.contexts.some(context => context.hash === item.contextHash)
  );
  state.sessions = state.sessions.filter(
    item => item.expiresAt > now && item.revokedAt === null
  );
  state.invites = state.invites.filter(item => item.expiresAt > now);
  state.rates = state.rates.filter(
    item => now - item.start < 24 * 60 * 60 * 1000
  );
}
