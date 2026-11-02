import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createCivicApp } from "./app";
import type { CivicRepository, CivicSessionRecord, NewClaimRecord, NewProposalRecord } from "../ports/repository";
import type { ClaimRecord, ProposalRecord } from "../domain/types";
import type { VoteChoice } from "../../../shared/civic/contracts";

const validProposal = {
  kind: "public_work",
  title: "Mais iluminação na ciclovia",
  summary: "A ciclovia precisa de iluminação pública durante a noite.",
  description: "O trecho perto do terminal fica escuro e difícil de usar após as 18 horas.",
  desiredChange: "Instalar iluminação pública adequada no trecho.",
  region: { municipalityCode: "3304557", municipality: "Rio de Janeiro", state: "RJ", precision: "municipality" },
  acceptPublicPreview: true,
};

function makeRepo() {
  const sessions = new Map<string, CivicSessionRecord>();
  const proposals = new Map<string, ProposalRecord>();
  const claims = new Map<string, ClaimRecord[]>();
  const votes = new Map<string, VoteChoice>();
  const repo = {
    ping: vi.fn(async () => undefined),
    findSession: vi.fn(async (hash: string, now: number) => {
      const found = sessions.get(hash);
      return found && found.expiresAt > now ? found : null;
    }),
    createSession: vi.fn(async (session: CivicSessionRecord) => { sessions.set(session.tokenHash, session); }),
    rotateCsrfHash: vi.fn(async (tokenHash: string, csrfHash: string) => {
      const old = sessions.get(tokenHash);
      if (old) sessions.set(tokenHash, { ...old, csrfHash });
    }),
    incrementMutation: vi.fn(async (hash: string) => sessions.has(hash)),
    createProposal: vi.fn(async (proposal: NewProposalRecord, initialClaims: NewClaimRecord[] = []) => {
      proposals.set(proposal.id, proposal);
      claims.set(proposal.id, initialClaims.map(claim => ({ ...claim, checkedAt: null })));
    }),
    findProposal: vi.fn(async (id: string) => proposals.get(id) ?? null),
    findRecentProposals: vi.fn(async () => [...proposals.values()]),
    findProposals: vi.fn(async () => [...proposals.values()]),
    recordVote: vi.fn(async (id: string, hash: string, choice: VoteChoice) => { votes.set(`${id}:${hash}`, choice); }),
    findVote: vi.fn(async (id: string, hash: string) => votes.get(`${id}:${hash}`) ?? null),
    removeVote: vi.fn(async (id: string, hash: string) => { votes.delete(`${id}:${hash}`); }),
    voteCounts: vi.fn(async (id: string) => {
      const counts: Record<VoteChoice, number> = { support: 0, oppose: 0, need_information: 0 };
      for (const [key, choice] of votes) if (key.startsWith(`${id}:`)) counts[choice] += 1;
      return counts;
    }),
    voteCount: vi.fn(async () => votes.size),
    listRegionCells: vi.fn(async () => []),
    recordRegion: vi.fn(async () => true),
    addComment: vi.fn(async () => undefined),
    listComments: vi.fn(async () => []),
    countComments: vi.fn(async () => 0),
    addClaim: vi.fn(async (claim: NewClaimRecord) => { claims.set(claim.proposalId, [...(claims.get(claim.proposalId) ?? []), { ...claim, checkedAt: null }]); }),
    listClaims: vi.fn(async (id: string) => claims.get(id) ?? []),
    addMedia: vi.fn(async () => undefined),
    findMedia: vi.fn(async () => null),
    removeMedia: vi.fn(async () => false),
    listMedia: vi.fn(async () => []),
    publicProposalCount: vi.fn(async () => proposals.size),
    proposalCountsByKind: vi.fn(async () => ({ public_work: proposals.size, legislative_change: 0, public_service: 0 })),
    listVerifiedProfiles: vi.fn(async () => []),
    saveProfileSubmission: vi.fn(async () => false),
    publicProfileCohorts: vi.fn(async () => []),
  };
  return repo as unknown as CivicRepository & typeof repo;
}

const config = {
  origin: "https://civica.example",
  allowedOrigins: ["https://civica.example"],
  secureCookies: true,
  configured: true,
  mapsBaseUrl: null,
  mapBrowserKey: null,
};

function tokenSequence(prefix: string) {
  let counter = 0;
  return () => `${prefix}${String(++counter).padStart(42, "0")}`;
}

describe("civic public API boundaries", () => {
  it("serves health without blocking the cross-site Preview iframe", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000 });
    const response = await request(app).get("/api/health").expect(200);
    expect(response.headers["x-frame-options"]).toBeUndefined();
    expect(response.headers["content-security-policy"] ?? "").not.toMatch(/frame-ancestors\s+'?(self|none)/i);
  });

  it("creates only an opaque experimental session with Preview-compatible cookies", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("a") });
    const response = await request(app).get("/api/civic/session").expect(200);
    expect(response.body.mode).toBe("experimental");
    expect(response.body.csrfToken).toBeTruthy();
    expect(response.body).not.toHaveProperty("participantId");
    expect(response.body).not.toHaveProperty("cpf");
    const header = response.headers["set-cookie"];
    const cookies = Array.isArray(header) ? header : [header];
    expect(cookies.join(" ")).toMatch(/HttpOnly/i);
    expect(cookies.join(" ")).toMatch(/Secure/i);
    expect(cookies.join(" ")).toMatch(/SameSite=None/i);
  });

  it("uses a valid same-site cookie for a plain HTTP local test origin", async () => {
    const localConfig = {
      ...config,
      origin: "http://localhost:4100",
      allowedOrigins: ["http://localhost:4100"],
      secureCookies: false,
    };
    const app = createCivicApp({ repository: makeRepo(), config: localConfig, now: () => 1_800_000_000_000, newToken: tokenSequence("h") });
    const response = await request(app).get("/api/civic/session").expect(200);
    const header = response.headers["set-cookie"];
    const cookies = Array.isArray(header) ? header : [header];
    expect(cookies.join(" ")).toMatch(/SameSite=Lax/i);
    expect(cookies.join(" ")).not.toMatch(/Secure/i);
  });

  it("keeps the same CSRF proof when another tab opens the session", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("m") });
    const first = await request(app).get("/api/civic/session");
    const firstCookies = Array.isArray(first.headers["set-cookie"]) ? first.headers["set-cookie"] : [first.headers["set-cookie"]];
    const cookie = firstCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const second = await request(app).get("/api/civic/session").set("Cookie", cookie ?? "");
    expect(second.body.csrfToken).toBe(first.body.csrfToken);
    expect(repo.rotateCsrfHash).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin mutation before it reaches the application service", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("b") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    await request(app).post("/api/civic/proposals").set("Cookie", cookie ?? "").set("Origin", "https://evil.example").set("X-CSRF-Token", session.body.csrfToken).send(validProposal).expect(403);
    expect(repo.createProposal).not.toHaveBeenCalled();
  });

  it("requires exact origin and in-memory CSRF before accepting public content", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("c") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    await request(app).post("/api/civic/proposals").set("Cookie", cookie ?? "").set("Origin", "https://civica.example").send(validProposal).expect(403);
    const created = await request(app).post("/api/civic/proposals").set("Cookie", cookie ?? "").set("Origin", "https://civica.example").set("X-CSRF-Token", session.body.csrfToken).send(validProposal).expect(201);
    expect(created.body.id).toBeTruthy();
    expect(JSON.stringify(created.body)).not.toMatch(/cpf|participantHash|ownerScopeHash/i);
    expect(repo.createProposal).toHaveBeenCalledOnce();
  });

  it("returns only the current session vote and never adds it to public proposal details", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("v") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const created = await request(app).post("/api/civic/proposals")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send(validProposal)
      .expect(201);
    await request(app).post(`/api/civic/proposals/${created.body.id}/vote`)
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({ choice: "support" })
      .expect(204);

    const ownVote = await request(app).get(`/api/civic/proposals/${created.body.id}/vote`)
      .set("Cookie", cookie ?? "")
      .expect(200);
    expect(ownVote.body).toEqual({ choice: "support" });
    expect(ownVote.headers["cache-control"]).toContain("no-store");
    const anotherSession = await request(app).get("/api/civic/session");
    const anotherCookies = Array.isArray(anotherSession.headers["set-cookie"]) ? anotherSession.headers["set-cookie"] : [anotherSession.headers["set-cookie"]];
    const anotherCookie = anotherCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    await request(app).get(`/api/civic/proposals/${created.body.id}/vote`)
      .set("Cookie", anotherCookie ?? "")
      .expect(200, { choice: null });
    await request(app).get(`/api/civic/proposals/${created.body.id}/vote`)
      .expect(200, { choice: null });
    const publicDetail = await request(app).get(`/api/civic/proposals/${created.body.id}`).expect(200);
    expect(publicDetail.body).not.toHaveProperty("choice");
    expect(publicDetail.body).not.toHaveProperty("sessionVote");
  });

  it("accepts a proposal without a region and persists explicit absence", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("l") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const created = await request(app).post("/api/civic/proposals")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({ ...validProposal, region: null })
      .expect(201);
    expect(repo.createProposal.mock.calls[0]?.[0]).toMatchObject({
      municipalityCode: null,
      municipality: null,
      state: null,
      latitude: null,
      longitude: null,
      precision: "not_provided",
    });
    const detail = await request(app).get(`/api/civic/proposals/${created.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ municipality: null, state: null, regionStatus: "not_provided", region: null });
  });

  it("accepts a community-reported locality without requiring an IBGE code", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("u") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const created = await request(app).post("/api/civic/proposals")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({ ...validProposal, region: { municipality: "São Paulo", state: "SP" } })
      .expect(201);
    expect(repo.createProposal.mock.calls[0]?.[0]).toMatchObject({ municipalityCode: null, municipality: "São Paulo", state: "SP" });
    const detail = await request(app).get(`/api/civic/proposals/${created.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ regionStatus: "user_provided_unverified", region: { municipality: "São Paulo", state: "SP" } });
    expect(detail.body.region).not.toHaveProperty("municipalityCode");
  });

  it("sends optional initial evidence with community-submitted, unchecked status", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("e") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    await request(app).post("/api/civic/proposals")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({
        ...validProposal,
        initialClaims: [{ category: "other", type: "participant_report", relation: "unknown", statement: "Relato enviado pela comunidade; ainda não conferido." }],
      })
      .expect(201);
    const [proposal, claims] = repo.createProposal.mock.calls[0] ?? [];
    expect(proposal).toMatchObject({ id: expect.any(String) });
    expect(claims).toHaveLength(1);
    expect(claims?.[0]).toMatchObject({ status: "community_submitted", submittedAt: 1_800_000_000_000 });
    expect(claims?.[0]).not.toHaveProperty("checkedAt");
    const detail = await request(app).get(`/api/civic/proposals/${proposal?.id}`).expect(200);
    expect(detail.body.claims[0]).toMatchObject({ status: "community_submitted", submittedAt: 1_800_000_000_000, checkedAt: null });
  });

  it("allows related-proposal discovery without asking for a location", async () => {
    const repo = makeRepo();
    const app = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("r") });
    const session = await request(app).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const response = await request(app).post("/api/civic/related")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({ kind: "public_service", title: "Água potável na escola", summary: "A escola precisa de água potável acessível.", description: "A comunidade relata falta de água potável para estudantes." })
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("refuses to store a photo until manual review is available", async () => {
    const repo = makeRepo();
    const sessionApp = createCivicApp({ repository: repo, config, now: () => 1_800_000_000_000, newToken: tokenSequence("p") });
    const session = await request(sessionApp).get("/api/civic/session");
    const sessionCookies = Array.isArray(session.headers["set-cookie"]) ? session.headers["set-cookie"] : [session.headers["set-cookie"]];
    const cookie = sessionCookies.find((value: string) => value.startsWith("civica_experiment="))?.split(";")[0];
    const proposal = await request(sessionApp)
      .post("/api/civic/proposals")
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send(validProposal)
      .expect(201);
    const response = await request(sessionApp)
      .post(`/api/civic/proposals/${proposal.body.id}/media`)
      .set("Cookie", cookie ?? "")
      .set("Origin", "https://civica.example")
      .set("X-CSRF-Token", session.body.csrfToken)
      .set("Content-Type", "image/png")
      .send(Buffer.from("raw-upload-bytes"))
      .expect(503);
    expect(response.body.error.code).toBe("photo_moderation_unavailable");
    expect(repo.addMedia).not.toHaveBeenCalled();
  });

  it("does not expose the legacy account/session routes in the civic app", async () => {
    const app = createCivicApp({ repository: makeRepo(), config, now: () => 1_800_000_000_000 });
    await request(app).get("/api/session").expect(404);
    await request(app).post("/api/auth/login/options").expect(404);
  });
});
