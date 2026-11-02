import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { PDFDocument, PDFName } from "pdf-lib";
import { NativeProtection } from "./protection";
import { GovbrDocument } from "./document";
import type { Enrollment } from "../ports/pilot";
const e: Enrollment = {
  id: "test-doc-id",
  accountId: "opaque-account-id",
  credentialId: "test-credential",
  keyDigest: "e".repeat(64),
  nonce: "exclusive-document-challenge",
  issuedAt: 1000000,
  expiresAt: 87400000,
  status: "issued",
  evidenceHash: null,
  evidence: null,
  submittedAt: null,
  discardAfter: null,
  discardedAt: null,
  review: null,
  cpfIndex: null,
};
describe("native authenticated protection, isolated non-personal bytes", () => {
  it("fails closed without configured independent keys", () => {
    const p = new NativeProtection();
    expect(p.encryptionReady).toBe(false);
    expect(p.cpfReady).toBe(false);
    expect(() =>
      p.encrypt(Buffer.from("not a personal document"), "account/enrollment")
    ).toThrow("DOCUMENT_PROTECTION_NOT_CONFIGURED");
    expect(() => p.cpfIndex("not a real CPF")).toThrow(
      "CPF_PROTECTION_NOT_CONFIGURED"
    );
  });
  it("roundtrips with fresh nonces, never includes plaintext in persisted envelope", () => {
    const p = new NativeProtection(
      randomBytes(32).toString("hex"),
      randomBytes(32).toString("hex")
    );
    const bytes = Buffer.from("non-personal test bytes");
    const a = p.encrypt(bytes, "bound-account/enrollment");
    const b = p.encrypt(bytes, "bound-account/enrollment");
    expect(a.nonce).not.toBe(b.nonce);
    expect(JSON.stringify(a)).not.toContain("non-personal");
    expect(Buffer.from(p.decrypt(a, "bound-account/enrollment"))).toEqual(
      bytes
    );
  });
  it("rejects changed ciphertext, wrong associated account and wrong key", () => {
    const p = new NativeProtection(randomBytes(32).toString("hex"));
    const envelope = p.encrypt(Buffer.from("test-only"), "a/e");
    expect(() => p.decrypt(envelope, "other-account/e")).toThrow(
      "EVIDENCE_AUTHENTICATION_FAILED"
    );
    const altered = {
      ...envelope,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(() => p.decrypt(altered, "a/e")).toThrow(
      "EVIDENCE_AUTHENTICATION_FAILED"
    );
    const wrong = new NativeProtection(randomBytes(32).toString("hex"));
    expect(() => wrong.decrypt(envelope, "a/e")).toThrow(
      "EVIDENCE_AUTHENTICATION_FAILED"
    );
  });
  it("HMAC is deterministic under same key and separated from public SHA256", () => {
    const key = randomBytes(32).toString("hex");
    const p = new NativeProtection(undefined, key);
    expect(p.cpfIndex("non-personal-index-input")).toBe(
      p.cpfIndex("non-personal-index-input")
    );
    expect(p.cpfIndex("non-personal-index-input")).not.toBe(
      p.sha256("non-personal-index-input")
    );
    expect(
      new NativeProtection(undefined, randomBytes(32).toString("hex")).cpfIndex(
        "non-personal-index-input"
      )
    ).not.toBe(p.cpfIndex("non-personal-index-input"));
  });
  it("refuses weak or malformed keys instead of accepting a shared platform secret", () => {
    expect(() => new NativeProtection("short")).toThrow(
      "INVALID_PROTECTION_KEY"
    );
    expect(() => new NativeProtection("z".repeat(64))).toThrow(
      "INVALID_PROTECTION_KEY"
    );
  });
});
describe("vinculation PDF — not a signature and not a fake identity", () => {
  it("creates a real one-page PDF with no JavaScript and binding metadata", async () => {
    const bytes = await new GovbrDocument("https://pilot.invalid").create(
      e,
      "Apelido de teste isolado"
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getSubject()).toContain(e.id);
    expect(pdf.catalog.has(PDFName.of("OpenAction"))).toBe(false);
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("/JavaScript");
  });
});
