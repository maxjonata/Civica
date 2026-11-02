import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { emptyState } from "../ports/pilot";
import { NativeProtection } from "../adapters/protection";
import {
  BACKUP_MAX_CIPHERTEXT_BASE64_LENGTH,
  parseBackupEnvelope,
  parseBackupSnapshot,
} from "./backup-schema";

describe("backup schema", () => {
  it("accepts the native envelope and rejects malformed outer fields", () => {
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      undefined,
      "backup-v1"
    );
    const envelope = crypto.encrypt(
      Buffer.from("snapshot"),
      "civica-backup-v1"
    );
    expect(parseBackupEnvelope(envelope)).toEqual(envelope);
    expect(() =>
      parseBackupEnvelope({
        ...envelope,
        nonce: "not-base64",
      })
    ).toThrow("INVALID_BACKUP");
    expect(() =>
      parseBackupEnvelope({
        ...envelope,
        ciphertext: "A".repeat(BACKUP_MAX_CIPHERTEXT_BASE64_LENGTH + 1),
      })
    ).toThrow("INVALID_BACKUP");
    expect(() =>
      parseBackupEnvelope({ ...envelope, unexpected: true })
    ).toThrow("INVALID_BACKUP");
  });

  it("validates every state collection shape while allowing old snapshots without fingerprints", () => {
    const snapshot = {
      version: 1 as const,
      createdAt: 100,
      state: emptyState(),
    };
    expect(parseBackupSnapshot(snapshot)).toEqual(snapshot);
    expect(() =>
      parseBackupSnapshot({
        ...snapshot,
        state: {
          ...snapshot.state,
          accounts: [{ ...snapshot.state.accounts, role: "owner" }],
        },
      })
    ).toThrow("INVALID_BACKUP");
    expect(() =>
      parseBackupSnapshot({
        ...snapshot,
        state: {
          ...snapshot.state,
          rates: [{ key: "rate", start: -1, count: 1 }],
        },
      })
    ).toThrow("INVALID_BACKUP");
  });
});
