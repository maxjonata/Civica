import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { RandomSource } from "../ports/pilot";
import { MemoryStateRepository } from "../adapters/state";
import { issueInvite, type WebauthnPort } from "../application/auth";
import { createAuthRouter } from "./auth";
import { createSecurityMiddleware, errorHandler } from "./security";
import type { RuntimeConfig } from "../ports/pilot";

const config: RuntimeConfig = {
  rpID: "civica.test",
  origins: ["https://civica.test"],
  primaryOrigin: "https://civica.test",
  secureCookies: false,
  sessionLifetimeMs: 8 * 60 * 60 * 1000,
  sessionIdleMs: 30 * 60 * 1000,
  recentAuthMs: 5 * 60 * 1000,
  maxAccounts: 2,
  configured: true,
};

class FakeClock {
  value = 1_000_000;
  now = () => this.value;
}

class FakeRandom implements RandomSource {
  private next = 1;
  token(): string {
    return `${this.next++}`.padStart(32, "0");
  }
}

class FakeWebauthn implements WebauthnPort {
  async registrationOptions(input: { challenge: string }): Promise<unknown> {
    return {
      challenge: input.challenge,
      rp: { id: "civica.test", name: "Cívica" },
    };
  }

  async authenticationOptions(input: { challenge: string }): Promise<unknown> {
    return {
      challenge: input.challenge,
      rpId: "civica.test",
      userVerification: "required",
    };
  }

  async verifyRegistration(): Promise<{
    verified: boolean;
    credential?: {
      id: string;
      publicKey: string;
      counter: number;
      transports: string[];
      deviceType: string;
      backedUp: boolean;
    };
  }> {
    return {
      verified: true,
      credential: {
        id: "credential-1",
        publicKey: "public-key",
        counter: 0,
        transports: [],
        deviceType: "singleDevice",
        backedUp: false,
      },
    };
  }

  async verifyAuthentication(input: {
    response: unknown;
  }): Promise<{ verified: boolean; credentialId: string; newCounter: number }> {
    const response = input.response as { id?: string };
    return {
      verified: true,
      credentialId: response.id ?? "credential-1",
      newCounter: 1,
    };
  }
}

function makeApp() {
  const repo = new MemoryStateRepository();
  const clock = new FakeClock();
  const app = express();
  app.use(createSecurityMiddleware(repo, config, clock));
  app.use(
    "/api",
    createAuthRouter({
      repo,
      config,
      clock,
      random: new FakeRandom(),
      webauthn: new FakeWebauthn(),
      getProtectionStatus: () => ({
        documentProtectionReady: false,
        cpfUniquenessReady: false,
      }),
    })
  );
  app.use(errorHandler);
  return { app, repo, clock, random: new FakeRandom() };
}

async function session(agent: request.SuperTest<request.Test>) {
  return agent.get("/api/session").expect(200);
}

describe("pilot auth HTTP contract", () => {
  it("creates a context on GET session and exposes protection readiness without identity", async () => {
    const { app } = makeApp();
    const response = await request(app).get("/api/session").expect(200);
    expect(response.body.account).toBeNull();
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.body.configuration).toMatchObject({
      ready: true,
      origin: "https://civica.test",
      rpID: "civica.test",
      documentProtectionReady: false,
      cpfUniquenessReady: false,
    });
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("civica_context=")])
    );
  });

  it("rejects every state mutation when Origin is absent", async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post("/api/auth/register/options")
      .send({ nickname: "Pessoa", invite: "invite" });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "origin_required" });
  });

  it("registers an invited account, consumes the invite, and rejects verification replay", async () => {
    const { app, repo, clock } = makeApp();
    const rawInvite = await issueInvite(repo, clock, new FakeRandom());
    const agent = request.agent(app);
    const context = await session(agent);

    const options = await agent
      .post("/api/auth/register/options")
      .set("Origin", "https://civica.test")
      .set("X-CSRF-Token", context.body.csrfToken)
      .send({ nickname: "Pessoa", invite: rawInvite })
      .expect(200);
    expect(options.body.challenge).toEqual(expect.any(String));

    const verify = await agent
      .post("/api/auth/register/verify")
      .set("Origin", "https://civica.test")
      .set("X-CSRF-Token", context.body.csrfToken)
      .send({ response: { id: "credential-1" } })
      .expect(200);
    expect(verify.body).toEqual({ ok: true });

    const rotatedContext = await session(agent);

    const replay = await agent
      .post("/api/auth/register/verify")
      .set("Origin", "https://civica.test")
      .set("X-CSRF-Token", rotatedContext.body.csrfToken)
      .send({ response: { id: "credential-1" } });
    expect(replay.status).toBe(400);
    expect(replay.body).toEqual({ error: "challenge_invalid" });

    const state = await repo.transact(value => value);
    expect(state.accounts).toHaveLength(1);
    expect(state.invites[0]!.usedAt).toBe(clock.value);
    expect(state.sessions).toHaveLength(1);
  });

  it("invalidates only the current session on logout and prevents deleting the last credential", async () => {
    const { app, repo, clock } = makeApp();
    const rawInvite = await issueInvite(repo, clock, new FakeRandom());
    const agent = request.agent(app);
    const context = await session(agent);
    await agent
      .post("/api/auth/register/options")
      .set("Origin", config.primaryOrigin)
      .set("X-CSRF-Token", context.body.csrfToken)
      .send({ nickname: "Pessoa", invite: rawInvite })
      .expect(200);
    await agent
      .post("/api/auth/register/verify")
      .set("Origin", config.primaryOrigin)
      .set("X-CSRF-Token", context.body.csrfToken)
      .send({ response: { id: "credential-1" } })
      .expect(200);

    const loggedIn = await session(agent);
    const logout = await agent
      .post("/api/auth/logout")
      .set("Origin", config.primaryOrigin)
      .set("X-CSRF-Token", loggedIn.body.csrfToken)
      .expect(200);
    expect(logout.body).toEqual({ ok: true });

    const current = await repo.transact(value => value);
    expect(current.sessions[0]!.revokedAt).toBe(clock.value);
    const lastDelete = await agent
      .delete("/api/auth/credentials/credential-1")
      .set("Origin", config.primaryOrigin)
      .set("X-CSRF-Token", loggedIn.body.csrfToken);
    expect(lastDelete.status).toBe(403);
  });
});
