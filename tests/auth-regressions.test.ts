import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { MemoryStateRepository } from "../server/adapters/state";
import {
  issueInvite,
  getSessionView,
  startRegistration,
  verifyRegistration,
  deleteCredential,
  startLogin,
} from "../server/application/auth";
import type { AuthDependencies } from "../server/application/auth";
import { loadRuntimeConfig } from "../server/adapters/config";
import { hashOpaque } from "../server/application/auth";
function setup() {
  const repo = new MemoryStateRepository();
  let capturedUserID = new Uint8Array();
  let excluded: string[] = [];
  const deps: AuthDependencies = {
    repo,
    config: loadRuntimeConfig({
      CIVICA_ORIGIN: "http://localhost:3000",
      CIVICA_RP_ID: "localhost",
      CIVICA_TEST_MODE: "1",
    }),
    clock: { now: () => 1000 },
    random: { token: (bytes = 32) => randomBytes(bytes).toString("base64url") },
    webauthn: {
      registrationOptions: async input => {
        capturedUserID = input.userID;
        excluded = input.excludeCredentialIds ?? [];
        return { challenge: input.challenge };
      },
      authenticationOptions: async input => ({ challenge: input.challenge }),
      verifyRegistration: async () => ({
        verified: true,
        credential: {
          id: "test-protocol-key",
          publicKey: "dGVzdA",
          counter: 0,
          transports: [],
          deviceType: "singleDevice",
          backedUp: false,
        },
      }),
      verifyAuthentication: async () => ({ verified: false }),
    },
  };
  return { repo, deps, userID: () => capturedUserID, excluded: () => excluded };
}
describe("regressions on existing TDD account kernel", () => {
  it("uses the same opaque account ID as the stable WebAuthn userHandle", async () => {
    const s = setup();
    const invite = await issueInvite(s.repo, s.deps.clock, s.deps.random);
    const context = await getSessionView(s.deps, null, null, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }));
    const contextHash = hashOpaque(context.rawContext!);
    await startRegistration(s.deps, {
      contextHash,
      nickname: "Protocol test",
      invite,
    });
    const result = await verifyRegistration(s.deps, contextHash, {
      id: "protocol-response",
    });
    expect(Buffer.from(s.userID()).toString("utf8")).toBe(result.account.id);
  });
  it("does not disclose existing account credential IDs to a new registration", async () => {
    const s = setup();
    await s.repo.transact(state => {
      state.passkeys.push({
        id: "other-credential-id",
        accountId: "other-opaque-id",
        label: "Protocol key",
        publicKey: "dGVzdA",
        counter: 0,
        transports: [],
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: 0,
        lastUsedAt: 0,
      });
    });
    const invite = await issueInvite(s.repo, s.deps.clock, s.deps.random);
    const context = await getSessionView(s.deps, null, null, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }));
    await startRegistration(s.deps, {
      contextHash: hashOpaque(context.rawContext!),
      nickname: "Protocol test",
      invite,
    });
    expect(s.excluded()).toEqual([]);
  });
  it("revokes every session authenticated by a removed key, not just the current one", async () => {
    const s = setup();
    await s.repo.transact(state => {
      state.accounts.push({
        id: "a",
        nickname: "Protocol test",
        role: "member",
        createdAt: 0,
      });
      for (const id of ["ka", "kb"])
        state.passkeys.push({
          id,
          accountId: "a",
          label: id,
          publicKey: "dGVzdA",
          counter: 0,
          transports: [],
          deviceType: "singleDevice",
          backedUp: false,
          createdAt: 0,
          lastUsedAt: 0,
        });
      for (const [hash, credentialId] of [
        ["old-a", "ka"],
        ["other-a", "ka"],
        ["current-b", "kb"],
      ])
        state.sessions.push({
          hash,
          credentialId,
          accountId: "a",
          authAt: 1000,
          createdAt: 0,
          lastSeenAt: 1000,
          expiresAt: 999999,
          revokedAt: null,
        });
    });
    await deleteCredential(s.deps, "current-b", "ka");
    const sessions = await s.repo.transact(state => state.sessions);
    expect(
      sessions
        .filter(session => session.credentialId === "ka")
        .every(session => session.revokedAt !== null)
    ).toBe(true);
    expect(
      sessions.find(session => session.hash === "current-b")?.revokedAt
    ).toBeNull();
  });
  it("invalidates an older challenge when new options for the same operation are issued", async () => {
    const s = setup();
    const context = await getSessionView(s.deps, null, null, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }));
    const hash = hashOpaque(context.rawContext!);
    await startLogin(s.deps, hash);
    await startLogin(s.deps, hash);
    const active = await s.repo.transact(state =>
      state.challenges.filter(
        c => c.contextHash === hash && c.kind === "login" && c.usedAt === null
      )
    );
    expect(active).toHaveLength(1);
  });
});

it("bounds creation of anonymous contexts with a persisted global rate budget", async () => {
  const s = setup();
  for (let i = 0; i < 70; i++)
    await getSessionView(s.deps, null, null, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }));
  await expect(
    getSessionView(s.deps, null, null, () => ({
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    }))
  ).rejects.toThrow("rate_limited");
});

it("a rejected review never appears as an approved signature/identity in the session view", async () => {
  const s = setup();
  await s.repo.transact(state => {
    state.accounts.push({
      id: "a",
      nickname: "Protocol",
      role: "member",
      createdAt: 0,
    });
    state.sessions.push({
      hash: "view-test",
      accountId: "a",
      credentialId: "key",
      authAt: 1000,
      createdAt: 0,
      lastSeenAt: 1000,
      expiresAt: 99999,
      revokedAt: null,
    });
    state.enrollments.push({
      id: "review-test",
      accountId: "a",
      credentialId: "key",
      keyDigest: "test-digest",
      nonce: "test-nonce",
      issuedAt: 0,
      expiresAt: 99999,
      status: "rejected",
      evidenceHash: "a".repeat(64),
      evidence: null,
      submittedAt: 100,
      discardAfter: 99999,
      discardedAt: 1000,
      cpfIndex: null,
      review: {
        operatorId: "operator-test",
        reviewedAt: 100,
        sha256: "a".repeat(64),
        compliance: "valid",
        trustAnchor: "govbr",
        signedContentConfirmed: false,
        identityConfirmed: true,
        civilUniqueness: false,
        independentReview: false,
        reportReference: null,
      },
    });
  });
  const view = await getSessionView(s.deps, null, "view-test", () => ({
    documentProtectionReady: false,
    cpfUniquenessReady: false,
  }));
  expect(view.view.identity?.signatureChecked).toBe(false);
  expect(view.view.identity?.identityIdentified).toBe(false);
});
