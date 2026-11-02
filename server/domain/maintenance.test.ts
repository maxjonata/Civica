import { describe, it, expect } from "vitest";
import { emptyState } from "../ports/pilot";
import { pruneOperationalState } from "./maintenance";
describe("bounded operational state, not identity records", () => {
  it("purges expired context/challenge/invite and session tokens without deleting accounts", () => {
    const s = emptyState();
    s.accounts.push({
      id: "protocol-only",
      nickname: "Protocol",
      role: "member",
      createdAt: 0,
    });
    s.contexts.push(
      { hash: "expired", csrf: "test-token", expiresAt: 10 },
      { hash: "active", csrf: "test-token", expiresAt: 1000 }
    );
    s.challenges.push({
      id: "old",
      contextHash: "expired",
      kind: "login",
      accountId: null,
      options: { challenge: "test" },
      expiresAt: 10,
      usedAt: null,
    });
    s.sessions.push({
      hash: "old-session",
      accountId: "protocol-only",
      credentialId: "key",
      authAt: 0,
      createdAt: 0,
      lastSeenAt: 0,
      expiresAt: 10,
      revokedAt: null,
    });
    s.invites.push({
      hash: "old-invite",
      expiresAt: 10,
      usedAt: null,
      accountId: null,
    });
    pruneOperationalState(s, 20);
    expect(s.contexts).toHaveLength(1);
    expect(s.challenges).toHaveLength(0);
    expect(s.sessions).toHaveLength(0);
    expect(s.invites).toHaveLength(0);
    expect(s.accounts).toHaveLength(1);
  });
  it("does not discard evidence or minimal review audit implicitly", () => {
    const s = emptyState();
    s.rates.push(
      { key: "old", start: 0, count: 2 },
      { key: "recent", start: 100000, count: 1 }
    );
    pruneOperationalState(s, 200000000);
    expect(s.rates).toHaveLength(0);
    expect(s.enrollments).toEqual([]);
  });
});
