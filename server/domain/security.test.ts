import { describe, expect, it } from "vitest";
import { enforceRate, requireAccount } from "./security";
import {
  emptyState,
  PilotError,
  type PilotState,
  type RuntimeConfig,
} from "../ports/pilot";

const config: RuntimeConfig = {
  rpID: "civica.test",
  origins: ["https://civica.test"],
  primaryOrigin: "https://civica.test",
  secureCookies: true,
  sessionLifetimeMs: 8 * 60 * 60 * 1000,
  sessionIdleMs: 30 * 60 * 1000,
  recentAuthMs: 5 * 60 * 1000,
  maxAccounts: 2,
  configured: true,
};

function sessionState(
  overrides: Partial<PilotState["sessions"][number]> = {}
): PilotState {
  const state = emptyState();
  state.accounts.push({
    id: "account-1",
    nickname: "Pessoa",
    role: "admin",
    createdAt: 1,
  });
  state.sessions.push({
    hash: "session-hash",
    accountId: "account-1",
    credentialId: "credential-1",
    authAt: 9_000_000,
    createdAt: 9_000_000,
    lastSeenAt: 9_000_000,
    expiresAt: 100_000_000,
    revokedAt: null,
    ...overrides,
  });
  return state;
}

describe("requireAccount", () => {
  it("returns the account and valid session", () => {
    const result = requireAccount(
      sessionState(),
      "session-hash",
      9_010_000,
      config,
      { admin: true, recent: true }
    );
    expect(result.account.id).toBe("account-1");
    expect(result.session.hash).toBe("session-hash");
  });

  it.each([
    ["missing", "session-hash-missing", {}],
    ["revoked", "session-hash", { revokedAt: 9_500 }],
    ["expired", "session-hash", { expiresAt: 9_999 }],
    ["idle", "session-hash", { lastSeenAt: 1 }],
    ["not recent", "session-hash", { authAt: 1 }],
  ])("rejects %s sessions", (_name, hash, overrides) => {
    const options = _name === "not recent" ? { recent: true } : {};
    expect(() =>
      requireAccount(sessionState(overrides), hash, 9_010_000, config, options)
    ).toThrow(PilotError);
  });

  it("rejects member accounts when admin is required", () => {
    const state = sessionState();
    state.accounts[0]!.role = "member";
    expect(() =>
      requireAccount(state, "session-hash", 10_000, config, { admin: true })
    ).toThrowError(
      expect.objectContaining({ code: "admin_required", status: 403 })
    );
  });
});

describe("enforceRate", () => {
  it("persists counts in the pilot state and resets after the window", () => {
    const state = emptyState();
    enforceRate(state, "register", 1_000, 2, 100);
    enforceRate(state, "register", 1_050, 2, 100);
    expect(() => enforceRate(state, "register", 1_060, 2, 100)).toThrowError(
      expect.objectContaining({ code: "rate_limited", status: 429 })
    );
    expect(() => enforceRate(state, "register", 1_101, 2, 100)).not.toThrow();
    expect(state.rates).toEqual([{ key: "register", start: 1_101, count: 1 }]);
  });
});
