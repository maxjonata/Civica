import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { MysqlStateRepository } from "../server/adapters/mysql-state";
import { NativeProtection } from "../server/adapters/protection";
import { issueInvite } from "../server/application/auth";
import { bootstrapAdministrator } from "../server/application/operator";
import {
  exportBackup,
  restoreIsolatedBackup,
} from "../server/application/backup";
import { purgeExpiredEvidence } from "../server/domain/identity";
import { assertTestDatabase } from "../server/adapters/config";
import { ensureProtectionContinuity } from "../server/application/key-continuity";
import { BACKUP_MAX_ENVELOPE_FILE_BYTES } from "../server/application/backup-schema";

async function readBoundedBackupFile(filename: string): Promise<string> {
  const initial = await fs.stat(filename);
  if (!initial.isFile() || initial.size > BACKUP_MAX_ENVELOPE_FILE_BYTES)
    throw new Error("BACKUP_FILE_TOO_LARGE");
  const handle = await fs.open(filename, "r");
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.size > BACKUP_MAX_ENVELOPE_FILE_BYTES)
      throw new Error("BACKUP_FILE_TOO_LARGE");
    const buffer = Buffer.alloc(BACKUP_MAX_ENVELOPE_FILE_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0);
    if (bytesRead > BACKUP_MAX_ENVELOPE_FILE_BYTES)
      throw new Error("BACKUP_FILE_TOO_LARGE");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function main() {
  if (process.env.CIVICA_TEST_MODE !== "1") await import("dotenv/config");
  const [command, argument] = process.argv.slice(2);
  const isolated =
    command === "restore-test" || process.env.CIVICA_TEST_MODE === "1";
  const url = isolated
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_NOT_CONFIGURED");
  if (isolated) assertTestDatabase(url);
  const repo = new MysqlStateRepository(url);
  await repo.init();
  try {
    if (command === "invite") {
      if (!argument || !path.isAbsolute(argument))
        throw new Error("ABSOLUTE_PRIVATE_FILE_REQUIRED");
      if (
        path
          .resolve(argument)
          .startsWith(path.resolve(process.cwd()) + path.sep)
      )
        throw new Error("INVITE_MUST_STAY_OUTSIDE_REPOSITORY");
      const raw = await issueInvite(
        repo,
        { now: () => Date.now() },
        { token: (bytes = 32) => randomBytes(bytes).toString("base64url") }
      );
      await fs.writeFile(argument, raw + "\n", { mode: 0o600, flag: "wx" });
      console.log(
        "Convite de uso único salvo no arquivo privado indicado. O token não é exibido em logs."
      );
    } else if (command === "admin") {
      if (!argument) throw new Error("EXPLICIT_ACCOUNT_ID_REQUIRED");
      await bootstrapAdministrator(repo, argument, Date.now());
      console.log("Bootstrap administrativo explícito consumido.");
    } else if (command === "status") {
      const status = await repo.transact(state => ({
        accounts: state.accounts.map(account => ({
          id: account.id,
          role: account.role,
        })),
        pending: state.enrollments.filter(e => e.status === "submitted").length,
        bootstrapConsumed: state.adminBootstrapped,
      }));
      console.log(JSON.stringify(status, null, 2));
    } else if (command === "purge") {
      const count = await repo.transact(state =>
        purgeExpiredEvidence(state, Date.now())
      );
      console.log("Evidências cifradas vencidas descartadas:", count);
    } else if (command === "export" || command === "restore-test") {
      if (!argument || !path.isAbsolute(argument))
        throw new Error("ABSOLUTE_PRIVATE_FILE_REQUIRED");
      const backupKey = process.env.CIVICA_BACKUP_KEY;
      if (!backupKey) throw new Error("BACKUP_KEY_NOT_CONFIGURED");
      if (
        backupKey === process.env.CIVICA_DOCUMENT_KEY ||
        backupKey === process.env.CIVICA_CPF_KEY
      )
        throw new Error("BACKUP_KEY_MUST_DIFFER");
      const crypto = new NativeProtection(backupKey, undefined, "backup-v1");
      if (command === "export") {
        await ensureProtectionContinuity(
          repo,
          new NativeProtection(
            process.env.CIVICA_DOCUMENT_KEY,
            process.env.CIVICA_CPF_KEY
          )
        );
        const envelope = await exportBackup(repo, crypto, Date.now());
        await fs.writeFile(argument, JSON.stringify(envelope) + "\n", {
          mode: 0o600,
          flag: "wx",
        });
        console.log("Backup cifrado exportado; chave não foi incluída.");
      } else {
        const raw = await readBoundedBackupFile(argument);
        if (Buffer.byteLength(raw, "utf8") > BACKUP_MAX_ENVELOPE_FILE_BYTES)
          throw new Error("BACKUP_FILE_TOO_LARGE");
        const envelope = JSON.parse(raw);
        if (
          Buffer.byteLength(JSON.stringify(envelope), "utf8") >
          BACKUP_MAX_ENVELOPE_FILE_BYTES
        )
          throw new Error("BACKUP_FILE_TOO_LARGE");
        await restoreIsolatedBackup(repo, crypto, envelope);
        console.log(
          "Restauração concluída somente na base isolada permitida, sem restaurar sessões."
        );
      }
    } else
      throw new Error(
        "COMMAND_REQUIRED: invite, admin, status, purge, export, restore-test"
      );
  } finally {
    await repo.close();
  }
}
main().catch(error => {
  const known = String(error?.message ?? "OPERATION_FAILED");
  console.error(/^[A-Z0-9_: ,.-]+$/.test(known) ? known : "OPERATION_FAILED");
  process.exit(1);
});
