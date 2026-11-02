import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { MysqlStateRepository } from "../server/adapters/mysql-state";
import { assertTestDatabase } from "../server/adapters/config";
import { NativeProtection } from "../server/adapters/protection";
import {
  exportBackup,
  restoreIsolatedBackup,
} from "../server/application/backup";
const url = process.env.TEST_DATABASE_URL;
const restoreUrl = process.env.TEST_RESTORE_DATABASE_URL;
const documentCrypto = new NativeProtection(randomBytes(32).toString("hex"));
let cipherHash = "";
const aad = "sql-roundtrip-nonpersonal-protocol";
describe.skipIf(!url)(
  "real isolated MariaDB/MySQL transactional persistence",
  () => {
    it("persists across connections, serializes 20 concurrent updates, rolls back and preserves a >2MiB nonpersonal SQL payload", async () => {
      assertTestDatabase(url!);
      const a = new MysqlStateRepository(url!);
      const b = new MysqlStateRepository(url!);
      await a.init();
      await b.init();
      try {
        await a.transact(state => {
          expect(state.accounts).toHaveLength(0);
          state.accounts.push({
            id: "sql-protocol-only",
            nickname: "SQL protocol test",
            role: "member",
            createdAt: 0,
          });
        });
        const work = Array.from({ length: 20 }, (_, index) =>
          (index % 2 ? a : b).transact(async state => {
            const account = state.accounts[0];
            const old = account.createdAt;
            await new Promise(resolve => setTimeout(resolve, 3));
            account.createdAt = old + 1;
          })
        );
        await Promise.all(work);
        expect(await b.transact(state => state.accounts[0].createdAt)).toBe(20);
        await expect(
          a.transact(state => {
            state.accounts[0].nickname = "must rollback";
            throw new Error("intentional test rollback");
          })
        ).rejects.toThrow("intentional");
        expect(await b.transact(state => state.accounts[0].nickname)).toBe(
          "SQL protocol test"
        );
        await a.transact(state => {
          state.accounts[0].nickname = "Protocol";
          state.rates.push({
            key:
              "large-persisted-nonpersonal-string:" +
              "A".repeat(2 * 1024 * 1024 + 100),
            start: 0,
            count: 0,
          });
        });
        expect(
          (await b.transact(state => state.rates[0].key)).length
        ).toBeGreaterThan(2 * 1024 * 1024);
        const detached = await a.transact(state => state.accounts[0]);
        detached.nickname = "outside mutation";
        expect(await b.transact(state => state.accounts[0].nickname)).toBe(
          "Protocol"
        );
      } finally {
        await a.close();
        await b.close();
      }
    });
    it("persists a genuine 2MiB AES-GCM encrypted nonpersonal buffer, without plaintext in the SQL JSON", async () => {
      const repo = new MysqlStateRepository(url!);
      await repo.init();
      try {
        const bytes = randomBytes(2 * 1024 * 1024);
        cipherHash = documentCrypto.sha256(bytes);
        const envelope = documentCrypto.encrypt(bytes, aad);
        await repo.transact(state => {
          state.cryptoFingerprints = documentCrypto.fingerprints;
          state.passkeys.push({
            id: "sql-cipher-key",
            accountId: "sql-protocol-only",
            label: "Protocol",
            publicKey: Buffer.from("nonpersonal-protocol").toString("base64"),
            counter: 0,
            transports: [],
            deviceType: "singleDevice",
            backedUp: false,
            createdAt: 0,
            lastUsedAt: null,
          });
          state.enrollments.push({
            id: "sql-cipher-evidence",
            accountId: "sql-protocol-only",
            credentialId: "sql-cipher-key",
            keyDigest: documentCrypto.sha256("nonpersonal-protocol"),
            nonce: "sql-nonpersonal-nonce",
            issuedAt: 0,
            expiresAt: 9999999999999,
            status: "submitted",
            evidenceHash: cipherHash,
            evidence: envelope,
            submittedAt: 1,
            discardAfter: 9999999999999,
            discardedAt: null,
            review: null,
            cpfIndex: null,
          });
        });
        const stored = await repo.transact(
          state => state.enrollments[0].evidence!
        );
        expect(Buffer.from(documentCrypto.decrypt(stored, aad))).toEqual(bytes);
        expect(stored.ciphertext).not.toBe(bytes.toString("base64"));
      } finally {
        await repo.close();
      }
    });
  }
);
it.skipIf(!url || !restoreUrl)(
  "restores an encrypted SQL backup to an empty SQL test target with matching account/key/ciphertext and no active sessions",
  async () => {
    assertTestDatabase(url!);
    assertTestDatabase(restoreUrl!);
    const source = new MysqlStateRepository(url!);
    const target = new MysqlStateRepository(restoreUrl!);
    await source.init();
    await target.init();
    try {
      const backupCrypto = new NativeProtection(
        randomBytes(32).toString("hex"),
        undefined,
        "backup-v1"
      );
      const expected = await source.transact(state => ({
        accounts: state.accounts,
        passkeys: state.passkeys,
        enrollments: state.enrollments,
        cryptoFingerprints: state.cryptoFingerprints,
      }));
      const encrypted = await exportBackup(source, backupCrypto, Date.now());
      await restoreIsolatedBackup(target, backupCrypto, encrypted);
      const actual = await target.transact(state => ({
        accounts: state.accounts,
        passkeys: state.passkeys,
        enrollments: state.enrollments,
        cryptoFingerprints: state.cryptoFingerprints,
        sessions: state.sessions,
        contexts: state.contexts,
      }));
      expect(actual.accounts).toEqual(expected.accounts);
      expect(actual.passkeys).toEqual(expected.passkeys);
      expect(actual.enrollments).toEqual(expected.enrollments);
      expect(actual.cryptoFingerprints).toEqual(expected.cryptoFingerprints);
      expect(actual.sessions).toEqual([]);
      expect(actual.contexts).toEqual([]);
      expect(
        documentCrypto.sha256(
          documentCrypto.decrypt(actual.enrollments[0].evidence!, aad)
        )
      ).toBe(cipherHash);
    } finally {
      await source.close();
      await target.close();
    }
  }
);
