import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { PilotError, type CryptoPort, type Envelope } from "../ports/pilot";
function parseKey(value?: string): Buffer | null {
  if (value === undefined || value === "") return null;
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new PilotError("INVALID_PROTECTION_KEY", 503);
  return Buffer.from(value, "hex");
}
export class NativeProtection implements CryptoPort {
  private readonly documentKey: Buffer | null;
  private readonly indexKey: Buffer | null;
  readonly encryptionReady: boolean;
  readonly cpfReady: boolean;
  readonly fingerprints: { document: string | null; cpf: string | null };
  constructor(
    documentKey?: string,
    cpfKey?: string,
    private readonly keyId = "document-v1"
  ) {
    this.documentKey = parseKey(documentKey);
    this.indexKey = parseKey(cpfKey);
    if (
      this.documentKey &&
      this.indexKey &&
      this.documentKey.equals(this.indexKey)
    )
      throw new PilotError("PROTECTION_KEYS_MUST_DIFFER", 503);
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(keyId))
      throw new PilotError("INVALID_KEY_ID", 503);
    this.encryptionReady = this.documentKey !== null;
    this.cpfReady = this.indexKey !== null;
    this.fingerprints = {
      document: this.documentKey
        ? createHash("sha256")
            .update("document-key-fingerprint-v1\0")
            .update(this.documentKey)
            .digest("hex")
        : null,
      cpf: this.indexKey
        ? createHash("sha256")
            .update("cpf-key-fingerprint-v1\0")
            .update(this.indexKey)
            .digest("hex")
        : null,
    };
  }
  sha256(bytes: Uint8Array | string): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
  encrypt(bytes: Uint8Array, aad: string): Envelope {
    if (!this.documentKey)
      throw new PilotError("DOCUMENT_PROTECTION_NOT_CONFIGURED", 503);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.documentKey, nonce);
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return {
      version: "aes-256-gcm-v1",
      keyId: this.keyId,
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }
  decrypt(envelope: Envelope, aad: string): Uint8Array {
    if (!this.documentKey)
      throw new PilotError("DOCUMENT_PROTECTION_NOT_CONFIGURED", 503);
    try {
      if (
        envelope.version !== "aes-256-gcm-v1" ||
        envelope.keyId !== this.keyId
      )
        throw new Error("Unsupported envelope");
      const nonce = Buffer.from(envelope.nonce, "base64");
      const tag = Buffer.from(envelope.tag, "base64");
      if (nonce.length !== 12 || tag.length !== 16)
        throw new Error("Invalid envelope");
      const cipher = createDecipheriv("aes-256-gcm", this.documentKey, nonce);
      cipher.setAAD(Buffer.from(aad, "utf8"));
      cipher.setAuthTag(tag);
      return Buffer.concat([
        cipher.update(Buffer.from(envelope.ciphertext, "base64")),
        cipher.final(),
      ]);
    } catch {
      throw new PilotError("EVIDENCE_AUTHENTICATION_FAILED", 409);
    }
  }
  cpfIndex(cpf: string): string {
    if (!this.indexKey)
      throw new PilotError("CPF_PROTECTION_NOT_CONFIGURED", 503);
    return (
      "hmac-v1:" +
      createHmac("sha256", this.indexKey)
        .update("civica-cpf-v1\0")
        .update(cpf)
        .digest("hex")
    );
  }
}
