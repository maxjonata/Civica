import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createIdentityRouter } from "./identity";
import { PilotError } from "../ports/pilot";
const bytes = Buffer.from("%PDF-1.7\nNonpersonal protocol bytes");
function setup(authorized = true) {
  let submitted = false;
  const service = {
    issue: async () => ({ id: "opaque-test-document" }),
    documentBytes: async () => bytes,
    authorizeUpload: async () => {
      if (!authorized) throw new PilotError("UNAUTHENTICATED", 401);
    },
    submit: async (
      _hash: string | null,
      _id: string,
      _bytes: Uint8Array,
      consent: boolean
    ) => {
      if (!consent) throw new PilotError("EVIDENCE_CONSENT_REQUIRED");
      submitted = true;
    },
    reviews: async () => [],
    evidenceBytes: async () => bytes,
    decide: async () => {},
    discard: async () => {},
  };
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use(
    "/api",
    createIdentityRouter({
      service,
      resolveIdentity: () => ({
        contextHash: "test-context",
        sessionHash: authorized ? "test-hash" : null,
      }),
    })
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const e = error as { status?: number; code?: string; type?: string };
      res.status(e.status ?? 500).json({
        error: {
          code:
            e.code ??
            (e.type === "entity.too.large"
              ? "PDF_TOO_LARGE"
              : "INTERNAL_ERROR"),
        },
      });
    }
  );
  return { app, submitted: () => submitted };
}
describe("private identity HTTP boundaries — no actual signed document", () => {
  it("download is attachment/private/no-store, not a public asset address", async () => {
    const { app } = setup();
    const response = await request(app).get(
      "/api/identity/document/opaque-test-document"
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("rejects an unauthenticated upload before PDF parsing", async () => {
    const { app, submitted } = setup(false);
    const response = await request(app)
      .post("/api/identity/doc/evidence")
      .set("Content-Type", "application/pdf")
      .send(Buffer.from("not a parsed PDF"));
    expect(response.status).toBe(401);
    expect(submitted()).toBe(false);
  });
  it("accepts only application/pdf on the upload route", async () => {
    const { app, submitted } = setup();
    expect(
      (
        await request(app)
          .post("/api/identity/doc/evidence")
          .set("Content-Type", "text/plain")
          .send("body")
      ).status
    ).toBe(415);
    expect(submitted()).toBe(false);
  });
  it("requires explicit consent for a PDF upload", async () => {
    const { app, submitted } = setup();
    expect(
      (
        await request(app)
          .post("/api/identity/doc/evidence")
          .set("Content-Type", "application/pdf")
          .send(bytes)
      ).status
    ).toBe(400);
    expect(submitted()).toBe(false);
    expect(
      (
        await request(app)
          .post("/api/identity/doc/evidence")
          .set("Content-Type", "application/pdf")
          .set("X-Evidence-Consent", "accepted")
          .send(bytes)
      ).status
    ).toBe(200);
    expect(submitted()).toBe(true);
  });
  it("does not trust extra fields, missing checks or malformed hashes in review decisions", async () => {
    const { app } = setup();
    for (const body of [
      { decision: "approve" },
      {
        decision: "approve",
        expectedSha256: "not-hash",
        compliance: "valid",
        trustAnchor: "govbr",
        signedContentConfirmed: true,
        identityConfirmed: true,
        reviewerDifferentPersonConfirmed: false,
      },
      {
        decision: "reject",
        expectedSha256: "a".repeat(64),
        compliance: "invalid",
        trustAnchor: null,
        signedContentConfirmed: false,
        identityConfirmed: false,
        reviewerDifferentPersonConfirmed: false,
        role: "admin",
      },
    ])
      expect(
        (await request(app).post("/api/admin/reviews/id/decision").send(body))
          .status
      ).toBe(400);
  });
  it("has no endpoint to mutate identity with GET", async () => {
    const { app } = setup();
    expect(
      (await request(app).get("/api/admin/reviews/id/decision")).status
    ).toBe(404);
    expect((await request(app).get("/api/identity/document")).status).toBe(404);
  });
});
