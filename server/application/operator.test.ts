import { describe, it, expect } from "vitest";
import { MemoryStateRepository } from "../adapters/state";
import { bootstrapAdministrator } from "./operator";
describe("one-use operational administrator bootstrap", () => {
  it("never grants role by merely being the first account, and requires recent proven authentication", async () => {
    const repo = new MemoryStateRepository();
    await repo.transact(s =>
      s.accounts.push({
        id: "target-protocol",
        nickname: "Protocol",
        role: "member",
        createdAt: 0,
      })
    );
    await expect(
      bootstrapAdministrator(repo, "target-protocol", 1000)
    ).rejects.toThrow("RECENT_PASSKEY_REQUIRED");
    expect(await repo.transact(s => s.accounts[0].role)).toBe("member");
  });
  it("grants only the explicitly selected account once and does not expose a public bootstrap endpoint", async () => {
    const repo = new MemoryStateRepository();
    await repo.transact(s => {
      s.accounts.push(
        {
          id: "target-protocol",
          nickname: "Protocol",
          role: "member",
          createdAt: 0,
        },
        {
          id: "not-selected",
          nickname: "Protocol",
          role: "member",
          createdAt: 0,
        }
      );
      s.passkeys.push({
        id: "k",
        accountId: "target-protocol",
        label: "test",
        publicKey: "dGVzdA",
        counter: 0,
        transports: [],
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: 0,
        lastUsedAt: 900,
      });
      s.sessions.push({
        hash: "testhash",
        accountId: "target-protocol",
        credentialId: "k",
        authAt: 900,
        createdAt: 0,
        lastSeenAt: 900,
        expiresAt: 10000,
        revokedAt: null,
      });
    });
    await bootstrapAdministrator(repo, "target-protocol", 1000);
    expect(await repo.transact(s => s.accounts.map(a => a.role))).toEqual([
      "admin",
      "member",
    ]);
    await expect(
      bootstrapAdministrator(repo, "not-selected", 1000)
    ).rejects.toThrow("ADMIN_BOOTSTRAP_CONSUMED");
  });
});
