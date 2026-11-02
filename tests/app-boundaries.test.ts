import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { MemoryStateRepository } from "../server/adapters/state";
import { NativeProtection } from "../server/adapters/protection";
import { GovbrDocument } from "../server/adapters/document";
import { loadRuntimeConfig } from "../server/adapters/config";
import { RealWebauthnAdapter } from "../server/adapters/webauthn";
import { createPilotApp } from "../server/http/app";
function setup() {
  const repo = new MemoryStateRepository();
  const config = loadRuntimeConfig({
    CIVICA_ORIGIN: "http://localhost:3000",
    CIVICA_RP_ID: "localhost",
    CIVICA_TEST_MODE: "1",
  });
  const app = createPilotApp({
    repo,
    config,
    crypto: new NativeProtection(randomBytes(32).toString("hex")),
    document: new GovbrDocument(config.primaryOrigin),
    clock: { now: () => 1000 },
    random: { token: (bytes = 32) => randomBytes(bytes).toString("base64url") },
    webauthn: new RealWebauthnAdapter(),
    development: false,
  });
  return { app, repo };
}
describe("complete API composition security", () => {
  it("exposes a health endpoint and anonymous context, but never accepts Manus/Bearer as login", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/health")).status).toBe(200);
    const res = await request(app)
      .get("/api/session")
      .set("Authorization", "Bearer unused-template-token")
      .set("Cookie", "manus_session=unused-template-token");
    expect(res.status).toBe(200);
    expect(res.body.account).toBeNull();
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers["cache-control"]).toContain("no-store");
  });
  it("returns JSON 404 for all old OAuth/tRPC/upload and unknown API paths", async () => {
    const { app } = setup();
    for (const path of [
      "/api/oauth/callback?code=protocol-only",
      "/api/trpc/auth.me",
      "/api/storage/test",
      "/api/unknown",
    ]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.headers.location).toBeUndefined();
    }
  });
  it("enforces Origin and CSRF on identity/admin mutations, not only auth routes", async () => {
    const { app } = setup();
    for (const path of [
      "/api/identity/document",
      "/api/admin/reviews/id/decision",
      "/api/auth/logout",
    ]) {
      expect((await request(app).post(path).send({})).status).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set("Origin", "https://attacker.invalid")
            .send({})
        ).status
      ).toBe(403);
    }
  });
  it("an allowed origin and valid CSRF do not authorize an anonymous document request", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const session = await agent.get("/api/session");
    const res = await agent
      .post("/api/identity/document")
      .set("Origin", "http://localhost:3000")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({});
    expect(res.status).toBe(401);
  });
  it("keeps Preview embedding possible without disabling script/object restrictions", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/health");
    expect(res.headers["x-frame-options"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toContain(
      "object-src 'none'"
    );
    expect(res.headers["content-security-policy"]).not.toContain(
      "frame-ancestors"
    );
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });
  it("never returns internal stack data for malformed JSON or compressed API requests", async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const context = await agent.get("/api/session");
    const res = await agent
      .post("/api/auth/register/options")
      .set("Origin", "http://localhost:3000")
      .set("X-CSRF-Token", context.body.csrfToken)
      .set("Content-Type", "application/json")
      .send("{invalid");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(
      /stack|SyntaxError|node_modules/
    );
  });
});
