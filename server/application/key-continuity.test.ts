import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { MemoryStateRepository } from "../adapters/state";
import { NativeProtection } from "../adapters/protection";
import { ensureProtectionContinuity } from "./key-continuity";
describe("protection key continuity", () => {
  it("records a non-secret key fingerprint and accepts an unchanged configured key", async () => {
    const repo = new MemoryStateRepository();
    const crypto = new NativeProtection(
      randomBytes(32).toString("hex"),
      randomBytes(32).toString("hex")
    );
    await ensureProtectionContinuity(repo, crypto);
    await expect(
      ensureProtectionContinuity(repo, crypto)
    ).resolves.toBeUndefined();
  });
  it("refuses a silent key replacement instead of treating an existing CPF as a new identity", async () => {
    const repo = new MemoryStateRepository();
    await ensureProtectionContinuity(
      repo,
      new NativeProtection(
        randomBytes(32).toString("hex"),
        randomBytes(32).toString("hex")
      )
    );
    await expect(
      ensureProtectionContinuity(
        repo,
        new NativeProtection(
          randomBytes(32).toString("hex"),
          randomBytes(32).toString("hex")
        )
      )
    ).rejects.toThrow("KEY_ROTATION_REQUIRES_MIGRATION");
  });
});
