import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  emptyState,
  type PilotState,
  type StateRepository,
  type StateRepositoryTarget,
} from "../ports/pilot";
import { NativeProtection } from "../adapters/protection";
import { exportBackup, restoreIsolatedBackup } from "./backup";

class TestRepository implements StateRepository {
  constructor(
    public state: PilotState = emptyState(),
    readonly target: StateRepositoryTarget = { kind: "testmemory" }
  ) {}
  async transact<T>(fn: (s: PilotState) => Promise<T> | T): Promise<T> {
    const next = structuredClone(this.state);
    const value = await fn(next);
    this.state = next;
    return structuredClone(value);
  }
}

describe("encrypted backup of isolated non-personal state", () => {
  it("encrypts account metadata and excludes live sessions, contexts and invitations", async () => {
    const state = emptyState();
    state.accounts.push({
      id: "protocol-backup-id",
      nickname: "Nonpersonal protocol label",
      role: "member",
      createdAt: 1,
    });
    state.sessions.push({
      hash: "testsessionhash",
      accountId: "protocol-backup-id",
      credentialId: "test-key",
      authAt: 1,
      createdAt: 1,
      lastSeenAt: 1,
      expiresAt: 99999,
      revokedAt: null,
    });
    state.contexts.push({
      hash: "testcontext",
      csrf: "test-csrf",
      expiresAt: 99999,
    });
    state.invites.push({
      hash: "testinvite",
      expiresAt: 99999,
      usedAt: null,
      accountId: null,
    });
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      undefined,
      "backup-v1"
    );
    const encrypted = await exportBackup(
      new TestRepository(state),
      crypto,
      100
    );
    expect(JSON.stringify(encrypted)).not.toContain("Nonpersonal");
    const target = new TestRepository();
    await restoreIsolatedBackup(target, crypto, encrypted);
    expect(target.state.accounts).toEqual(state.accounts);
    expect(target.state.sessions).toHaveLength(0);
    expect(target.state.contexts).toHaveLength(0);
    expect(target.state.invites).toHaveLength(0);
    expect(state.sessions).toHaveLength(1);
  });

  it("rejects restoration to production or remote targets from their own metadata", async () => {
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      undefined,
      "backup-v1"
    );
    const encrypted = await exportBackup(new TestRepository(), crypto, 100);
    for (const target of [
      { kind: "mysql", hostname: "127.0.0.1", database: "production" },
      {
        kind: "mysql",
        hostname: "external.example",
        database: "civica_test_restore",
      },
    ] as const)
      await expect(
        restoreIsolatedBackup(
          new TestRepository(emptyState(), target),
          crypto,
          encrypted
        )
      ).rejects.toThrow("UNSAFE_TEST_DATABASE");
    const state = emptyState();
    state.accounts.push({
      id: "existing-test-id",
      nickname: "Already present",
      role: "member",
      createdAt: 0,
    });
    await expect(
      restoreIsolatedBackup(new TestRepository(state), crypto, encrypted)
    ).rejects.toThrow("RESTORE_TARGET_NOT_EMPTY");
  });

  it("uses the repository's actual target identity, without a caller URL", async () => {
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      undefined,
      "backup-v1"
    );
    const encrypted = await exportBackup(new TestRepository(), crypto, 100);
    const target = new TestRepository(emptyState(), {
      kind: "mysql",
      hostname: "127.0.0.1",
      database: "civica_test_actual",
    });
    await expect(
      restoreIsolatedBackup(target, crypto, encrypted)
    ).resolves.toBe(undefined);
  });

  it.each(["contexts", "challenges", "rates", "cryptoFingerprints"])(
    "rejects a target containing %s",
    async field => {
      const crypto = new NativeProtection(
        randomBytes(32).toString("hex"),
        undefined,
        "backup-v1"
      );
      const encrypted = await exportBackup(new TestRepository(), crypto, 100);
      const state = emptyState();
      if (field === "contexts")
        state.contexts.push({ hash: "context", csrf: "csrf", expiresAt: 1 });
      if (field === "challenges")
        state.challenges.push({
          id: "challenge",
          contextHash: "context",
          kind: "login",
          accountId: null,
          options: {},
          expiresAt: 1,
          usedAt: null,
        });
      if (field === "rates")
        state.rates.push({ key: "rate", start: 1, count: 1 });
      if (field === "cryptoFingerprints")
        state.cryptoFingerprints = { document: "a".repeat(64), cpf: null };
      await expect(
        restoreIsolatedBackup(new TestRepository(state), crypto, encrypted)
      ).rejects.toThrow("RESTORE_TARGET_NOT_EMPTY");
    }
  );

  it("rejects an oversized outer ciphertext before asking crypto to decrypt", async () => {
    let decryptCalls = 0;
    const crypto = {
      encryptionReady: true,
      cpfReady: false,
      fingerprints: { document: null, cpf: null },
      sha256: () => "hash",
      encrypt: () => {
        throw new Error("not used");
      },
      decrypt: () => {
        decryptCalls += 1;
        return Buffer.from("{}");
      },
      cpfIndex: () => {
        throw new Error("not used");
      },
    };
    const oversized = {
      version: "aes-256-gcm-v1" as const,
      keyId: "backup-v1",
      nonce: Buffer.alloc(12).toString("base64"),
      tag: Buffer.alloc(16).toString("base64"),
      ciphertext: "A".repeat(13 * 1024 * 1024),
    };
    await expect(
      restoreIsolatedBackup(new TestRepository(), crypto, oversized)
    ).rejects.toThrow("INVALID_BACKUP");
    expect(decryptCalls).toBe(0);
  });

  it("rejects malformed snapshot array entries before applying state", async () => {
    const crypto = {
      encryptionReady: true,
      cpfReady: false,
      fingerprints: { document: null, cpf: null },
      sha256: () => "hash",
      encrypt: () => {
        throw new Error("not used");
      },
      decrypt: () =>
        Buffer.from(
          JSON.stringify({
            version: 1,
            createdAt: 100,
            state: {
              ...emptyState(),
              accounts: [{ id: "a", nickname: "n", role: "owner" }],
            },
          })
        ),
      cpfIndex: () => {
        throw new Error("not used");
      },
    };
    const target = new TestRepository();
    await expect(
      restoreIsolatedBackup(target, crypto, {
        version: "aes-256-gcm-v1",
        keyId: "backup-v1",
        nonce: Buffer.alloc(12).toString("base64"),
        tag: Buffer.alloc(16).toString("base64"),
        ciphertext: Buffer.from("snapshot").toString("base64"),
      })
    ).rejects.toThrow("INVALID_BACKUP");
    await expect(target.transact(state => state.accounts)).resolves.toEqual([]);
  });

  it("does not restore a tampered encrypted backup", async () => {
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      undefined,
      "backup-v1"
    );
    const encrypted = await exportBackup(new TestRepository(), crypto, 100);
    encrypted.ciphertext = Buffer.from("tampered").toString("base64");
    await expect(
      restoreIsolatedBackup(new TestRepository(), crypto, encrypted)
    ).rejects.toThrow("EVIDENCE_AUTHENTICATION_FAILED");
  });
});
