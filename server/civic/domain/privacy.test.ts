import { describe, expect, it } from "vitest";
import { deriveScopedHash, hashOpaqueToken } from "./privacy";

describe("experimental participation privacy scopes", () => {
  it("uses a one-way session digest instead of persisting the browser token", () => {
    const token = "random-test-session-token";
    expect(hashOpaqueToken(token)).not.toContain(token);
    expect(hashOpaqueToken(token)).toHaveLength(64);
  });

  it("derives independent per-purpose and per-proposal identifiers", () => {
    const token = "random-test-session-token";
    const vote = deriveScopedHash(token, "vote", "proposal-a");
    expect(vote).toBe(deriveScopedHash(token, "vote", "proposal-a"));
    expect(vote).not.toBe(deriveScopedHash(token, "region", "proposal-a"));
    expect(vote).not.toBe(deriveScopedHash(token, "vote", "proposal-b"));
    expect(vote).not.toBe(deriveScopedHash(token, "profile", "global"));
  });
});
