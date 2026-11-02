import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  emptyState,
  PilotError,
  type PilotState,
  type StateRepository,
} from "../ports/pilot";
import { NativeProtection } from "../adapters/protection";
import { GovbrDocument } from "../adapters/document";
import { IdentityService } from "./identity";
class IsolatedRepository implements StateRepository {
  state = emptyState();
  private queue: Promise<unknown> = Promise.resolve();
  transact<T>(operation: (state: PilotState) => Promise<T> | T): Promise<T> {
    const result = this.queue.then(async () => {
      const copy = structuredClone(this.state);
      const value = await operation(copy);
      this.state = copy;
      return structuredClone(value);
    });
    this.queue = result.catch(() => {});
    return result;
  }
}
function setup(protectedDocuments = true) {
  const repo = new IsolatedRepository();
  let now = 1000;
  const crypto = new NativeProtection(
    protectedDocuments ? randomBytes(32).toString("hex") : undefined
  );
  for (const id of ["participant", "operator"])
    repo.state.accounts.push({
      id,
      nickname: "Protocol test",
      role: id === "operator" ? "admin" : "member",
      createdAt: 0,
    });
  for (const id of ["key-a", "key-b"])
    repo.state.passkeys.push({
      id,
      accountId: "participant",
      publicKey: Buffer.from(id).toString("base64"),
      label: id,
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: 0,
      lastUsedAt: 500,
    });
  for (const id of ["participant", "operator"])
    repo.state.sessions.push({
      hash: id,
      accountId: id,
      credentialId: "key-a",
      authAt: 500,
      createdAt: 0,
      lastSeenAt: 500,
      expiresAt: 1000000000,
      revokedAt: null,
    });
  const authorizer = {
    require: (
      s: PilotState,
      hash: string | null,
      _now: number,
      options?: { admin?: boolean; recent?: boolean }
    ) => {
      const session = s.sessions.find(
        item => item.hash === hash && item.revokedAt === null
      );
      if (!session) throw new PilotError("UNAUTHENTICATED", 401);
      const account = s.accounts.find(item => item.id === session.accountId)!;
      if (options?.admin && account.role !== "admin")
        throw new PilotError("FORBIDDEN", 403);
      return { account, session };
    },
  };
  const service = new IdentityService({
    repo,
    crypto,
    document: new GovbrDocument("https://test.invalid"),
    clock: { now: () => now },
    random: { token: () => randomBytes(24).toString("hex") },
    authorizer,
  });
  return {
    repo,
    crypto,
    service,
    time: (value: number) => {
      now = value;
    },
  };
}
const decision = {
  decision: "approve" as const,
  compliance: "valid" as const,
  trustAnchor: "govbr" as const,
  signedContentConfirmed: true,
  identityConfirmed: true,
  reviewerDifferentPersonConfirmed: true,
};
const pdf = Buffer.from(
  "%PDF-1.7\nNon-personal untrusted protocol bytes; NOT a signed gov.br document."
);
describe("identity use cases — isolated protocol, no real civil identity", () => {
  it("issues an account-bound challenge, returns a PDF and does not invent verification", async () => {
    const { service, repo } = setup();
    const issued = await service.issue("participant");
    expect(issued.status).toBe("issued");
    expect(issued.accountId).toBe("participant");
    expect(issued.review).toBeNull();
    expect(
      Buffer.from(await service.documentBytes("participant", issued.id))
        .subarray(0, 5)
        .toString()
    ).toBe("%PDF-");
    expect(repo.state.enrollments).toHaveLength(1);
  });
  it("missing document key blocks issuance and upload rather than storing plaintext", async () => {
    const { service, repo } = setup(false);
    await expect(service.issue("participant")).rejects.toThrow(
      "DOCUMENT_PROTECTION_NOT_CONFIGURED"
    );
    expect(repo.state.enrollments).toHaveLength(0);
  });
  it("requires explicit consent, PDF header, size limit and account ownership", async () => {
    const { service } = setup();
    const e = await service.issue("participant");
    await expect(
      service.submit("participant", e.id, pdf, false)
    ).rejects.toThrow("EVIDENCE_CONSENT_REQUIRED");
    await expect(
      service.submit("participant", e.id, Buffer.from("not-pdf"), true)
    ).rejects.toThrow("INVALID_PDF");
    await expect(
      service.submit(
        "participant",
        e.id,
        Buffer.alloc(2 * 1024 * 1024 + 1),
        true
      )
    ).rejects.toThrow("PDF_TOO_LARGE");
    await expect(service.submit("operator", e.id, pdf, true)).rejects.toThrow(
      "ENROLLMENT_NOT_FOUND"
    );
  });
  it("persists only ciphertext and hash, and blocks replacement or replay", async () => {
    const { service, repo } = setup();
    const e = await service.issue("participant");
    await service.submit("participant", e.id, pdf, true);
    const stored = repo.state.enrollments[0];
    expect(stored.status).toBe("submitted");
    expect(stored.evidence?.ciphertext).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain("Non-personal");
    await expect(
      service.submit("participant", e.id, pdf, true)
    ).rejects.toThrow("ENROLLMENT_NOT_ISSUED");
  });
  it("expires document challenges and blocks unauthorized review/download", async () => {
    const { service, time } = setup();
    const e = await service.issue("participant");
    await expect(service.reviews("participant")).rejects.toThrow("FORBIDDEN");
    time(e.expiresAt);
    await expect(
      service.submit("participant", e.id, pdf, true)
    ).rejects.toThrow("ENROLLMENT_EXPIRED");
  });
  it("validates decrypted evidence hash and admin-only access", async () => {
    const { service, repo } = setup();
    const e = await service.issue("participant");
    await service.submit("participant", e.id, pdf, true);
    expect(Buffer.from(await service.evidenceBytes("operator", e.id))).toEqual(
      pdf
    );
    await expect(service.evidenceBytes("participant", e.id)).rejects.toThrow(
      "FORBIDDEN"
    );
    repo.state.enrollments[0].evidenceHash = "0".repeat(64);
    await expect(service.evidenceBytes("operator", e.id)).rejects.toThrow(
      "EVIDENCE_CHANGED"
    );
  });
  it("a simultaneous manual decision commits once and never implies CPF uniqueness", async () => {
    const { service, repo } = setup();
    const e = await service.issue("participant");
    await service.submit("participant", e.id, pdf, true);
    const expectedSha256 = repo.state.enrollments[0].evidenceHash!;
    const results = await Promise.allSettled([
      service.decide("operator", e.id, { ...decision, expectedSha256 }),
      service.decide("operator", e.id, { ...decision, expectedSha256 }),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(repo.state.enrollments[0].review?.civilUniqueness).toBe(false);
  });
  it("revoked sessions cannot operate even if a prior HTTP check succeeded", async () => {
    const { service, repo } = setup();
    const e = await service.issue("participant");
    repo.state.sessions[0].revokedAt = 1000;
    await expect(
      service.submit("participant", e.id, pdf, true)
    ).rejects.toThrow("UNAUTHENTICATED");
  });
});

it("authorizes PDF ownership before HTTP body parsing", async () => {
  const { service } = setup();
  const e = await service.issue("participant");
  await expect(
    service.authorizeUpload("participant", e.id)
  ).resolves.toBeUndefined();
  await expect(service.authorizeUpload(null, e.id)).rejects.toThrow(
    "UNAUTHENTICATED"
  );
  await expect(service.authorizeUpload("operator", e.id)).rejects.toThrow(
    "ENROLLMENT_NOT_FOUND"
  );
});

it("gives the private operator the exact expected signed binding, not only a PDF hash", async () => {
  const { service } = setup();
  const e = await service.issue("participant");
  await service.submit("participant", e.id, pdf, true);
  const reviews = await service.reviews("operator");
  expect(reviews[0]).toMatchObject({
    expectedChallenge: e.nonce,
    expectedKeyDigest: e.keyDigest,
    expectedCredentialId: e.credentialId,
  });
});
