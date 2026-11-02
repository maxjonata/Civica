import { randomBytes } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  listIbgeMunicipalities,
  listIbgeStates,
  searchChamberProposals,
} from "../adapters/official-sources";
import { CivicService, CivicApplicationError } from "../application/service";
import { deriveCsrfToken, hashOpaqueToken, safeTokenEqual } from "../domain/privacy";
import type { CivicRepository, CivicSessionRecord } from "../ports/repository";
import type { CivicHttpConfig } from "./config";

const SESSION_COOKIE = "civica_experiment";
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MUTATION_WINDOW_MS = 60 * 60 * 1000;
const MUTATION_LIMIT = 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const voteChoices = ["support", "oppose", "need_information"] as const;

export interface CivicAppOptions {
  repository: CivicRepository;
  config: CivicHttpConfig;
  now?: () => number;
  newToken?: () => string;
  fetcher?: typeof fetch;
}

type CivicRequest = Request & { civicRawToken?: string; civicTokenHash?: string };

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function requestToken(req: Request): string | null {
  const value = req.headers.cookie;
  if (!value) return null;
  for (const piece of value.split(";")) {
    const split = piece.trim().split("=");
    const name = split.shift();
    if (name === SESSION_COOKIE) {
      const token = split.join("=");
      return TOKEN_PATTERN.test(token) ? token : null;
    }
  }
  return null;
}

function setSessionCookie(res: Response, token: string, config: CivicHttpConfig) {
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`,
    "HttpOnly",
  ];
  if (config.secureCookies) attributes.push("SameSite=None", "Secure");
  else attributes.push("SameSite=Lax");
  res.append("Set-Cookie", attributes.join("; "));
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function secureHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"
    );
  }
  next();
}

function fail(code: string, status: number, res: Response) {
  noStore(res);
  res.status(status).json({ error: { code } });
}

function asyncRoute(
  handler: (req: CivicRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req as CivicRequest, res, next).catch(next);
  };
}

function readBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CivicApplicationError("invalid_input", 400);
  }
  return value as Record<string, unknown>;
}

function sessionMutationGuard(repository: CivicRepository, config: CivicHttpConfig, now: () => number) {
  return asyncRoute(async (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    noStore(res);
    const origin = req.get("Origin");
    if (!config.configured || !origin || !config.allowedOrigins.includes(origin)) {
      return fail("origin_not_allowed", 403, res);
    }
    const contentEncoding = req.get("Content-Encoding");
    if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
      return fail("content_encoding_not_supported", 415, res);
    }
    const token = requestToken(req);
    const csrfToken = req.get("X-CSRF-Token") ?? "";
    if (!token || !TOKEN_PATTERN.test(csrfToken)) return fail("session_or_csrf_required", 403, res);
    const tokenHash = hashOpaqueToken(token);
    const session = await repository.findSession(tokenHash, now());
    if (!session) return fail("experimental_session_expired", 401, res);
    if (!safeTokenEqual(hashOpaqueToken(csrfToken), session.csrfHash)) {
      return fail("csrf_rejected", 403, res);
    }
    if (!(await repository.incrementMutation(tokenHash, now(), MUTATION_LIMIT, MUTATION_WINDOW_MS))) {
      return fail("session_rate_limited", 429, res);
    }
    req.civicRawToken = token;
    req.civicTokenHash = tokenHash;
    next();
  });
}

const proposalFilters = z.object({
  kind: z.enum(["public_work", "legislative_change", "public_service"]).optional(),
  municipalityCode: z.string().regex(/^\d{7}$/).optional(),
  query: z.string().max(120).optional(),
}).strict();

const relatedInput = z.object({
  kind: z.enum(["public_work", "legislative_change", "public_service"]),
  title: z.string().min(4).max(120),
  summary: z.string().min(15).max(500),
  description: z.string().min(15).max(5000),
  region: z.object({
    municipalityCode: z.string().regex(/^\d{7}$/).nullable().optional(),
    municipality: z.string().min(2).max(120),
    state: z.string().regex(/^[A-Za-z]{2}$/),
    areaLabel: z.string().max(120).optional(),
    precision: z.enum(["municipality", "approximate_area"]).optional(),
  }).strict().nullable().optional(),
}).strict();

function safeError(error: unknown, res: Response) {
  if (error instanceof CivicApplicationError) return fail(error.code, error.status, res);
  if (error instanceof z.ZodError) return fail("invalid_input", 400, res);
  const status = (error as { status?: unknown } | null)?.status;
  const type = (error as { type?: unknown } | null)?.type;
  if (type === "entity.too.large") return fail("request_too_large", 413, res);
  if (typeof status === "number" && status >= 400 && status < 500) return fail("invalid_input", status, res);
  return fail("service_unavailable", 503, res);
}

export function createCivicApp(options: CivicAppOptions) {
  const now = options.now ?? Date.now;
  const newToken = options.newToken ?? randomToken;
  const repository = options.repository;
  const service = new CivicService({ repository, now });
  const app = express();
  app.disable("x-powered-by");
  app.use(secureHeaders);
  app.get("/api/health", asyncRoute(async (_req, res) => {
    try {
      await repository.ping();
      noStore(res);
      res.status(200).json({ ok: true });
    } catch {
      fail("not_ready", 503, res);
    }
  }));

  app.get("/api/civic/session", asyncRoute(async (req, res) => {
    noStore(res);
    if (!options.config.configured) return fail("civic_origin_not_configured", 503, res);
    const at = now();
    const existingRaw = requestToken(req);
    const existingHash = existingRaw ? hashOpaqueToken(existingRaw) : null;
    const existing = existingHash ? await repository.findSession(existingHash, at) : null;
    const token = existing ? existingRaw! : newToken();
    if (!TOKEN_PATTERN.test(token)) return fail("session_unavailable", 503, res);
    const tokenHash = hashOpaqueToken(token);
    const csrfToken = deriveCsrfToken(token);
    if (!TOKEN_PATTERN.test(csrfToken) || safeTokenEqual(csrfToken, token)) {
      return fail("session_unavailable", 503, res);
    }
    const expiresAt = existing?.expiresAt ?? at + SESSION_LIFETIME_MS;
    if (existing) {
      if (!safeTokenEqual(existing.csrfHash, hashOpaqueToken(csrfToken))) {
        await repository.rotateCsrfHash(tokenHash, hashOpaqueToken(csrfToken), at);
      }
    } else {
      const session: CivicSessionRecord = {
        tokenHash,
        csrfHash: hashOpaqueToken(csrfToken),
        createdAt: at,
        expiresAt,
        rateWindowStart: at,
        mutationCount: 0,
      };
      await repository.createSession(session);
    }
    setSessionCookie(res, token, options.config);
    res.status(200).json({ mode: "experimental", csrfToken, expiresAt });
  }));

  app.use("/api/civic", sessionMutationGuard(repository, options.config, now));
  app.use("/api/civic", express.json({ limit: "64kb", strict: true, type: "application/json" }));

  app.get("/api/civic/proposals", asyncRoute(async (req, res) => {
    noStore(res);
    const parsed = proposalFilters.safeParse({
      ...(typeof req.query.kind === "string" ? { kind: req.query.kind } : {}),
      ...(typeof req.query.municipalityCode === "string" ? { municipalityCode: req.query.municipalityCode } : {}),
      ...(typeof req.query.query === "string" ? { query: req.query.query } : {}),
    });
    if (!parsed.success) return fail("invalid_filters", 400, res);
    res.json(await service.listProposals(parsed.data));
  }));

  app.get("/api/civic/proposals/:id", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    res.json(await service.proposal(req.params.id));
  }));

  app.get("/api/civic/proposals/:id/vote", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const token = requestToken(req);
    if (!token || !(await repository.findSession(hashOpaqueToken(token), now()))) {
      return res.json({ choice: null });
    }
    const choice = await service.sessionVote(req.params.id, token);
    res.json({ choice });
  }));

  app.post("/api/civic/related", asyncRoute(async (req, res) => {
    noStore(res);
    const parsed = relatedInput.parse(readBodyObject(req.body));
    res.json(await service.related({
      kind: parsed.kind,
      title: parsed.title,
      summary: parsed.summary,
      description: parsed.description,
      municipalityCode: parsed.region?.municipalityCode ?? null,
      municipality: parsed.region?.municipality ?? null,
      state: parsed.region?.state.toUpperCase() ?? null,
    }));
  }));

  app.post("/api/civic/proposals", asyncRoute(async (req, res) => {
    noStore(res);
    const token = req.civicRawToken;
    if (!token) return fail("session_or_csrf_required", 403, res);
    const result = await service.createProposal(readBodyObject(req.body), token);
    res.status(201).json(result);
  }));

  app.post("/api/civic/proposals/:id/vote", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const body = z.object({ choice: z.enum(voteChoices) }).strict().parse(readBodyObject(req.body));
    await service.vote(req.params.id, req.civicRawToken!, body.choice);
    res.status(204).end();
  }));

  app.delete("/api/civic/proposals/:id/vote", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    await service.withdrawVote(req.params.id, req.civicRawToken!);
    res.status(204).end();
  }));

  app.post("/api/civic/proposals/:id/region", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const result = await service.submitRegion(req.params.id, req.civicRawToken!, readBodyObject(req.body));
    res.status(201).json(result);
  }));

  app.post("/api/civic/proposals/:id/comments", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const result = await service.comment(req.params.id, readBodyObject(req.body));
    res.status(201).json(result);
  }));

  app.post("/api/civic/proposals/:id/claims", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const result = await service.addClaim(req.params.id, readBodyObject(req.body));
    res.status(201).json(result);
  }));

  app.post("/api/civic/proposals/:id/media", asyncRoute(async (req, res, next) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("proposal_not_found", 404, res);
    const declaredMime = req.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(declaredMime)) return fail("unsupported_media_type", 415, res);
    express.raw({ type: () => true, limit: MAX_INPUT_BYTES })(req, res, error => {
      if (error) return next(error);
      return fail("photo_moderation_unavailable", 503, res);
    });
  }));

  app.delete("/api/civic/proposals/:id/media/:mediaId", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id) || !UUID_PATTERN.test(req.params.mediaId)) return fail("media_not_found", 404, res);
    const removed = await service.deleteMedia(req.params.id, req.params.mediaId, req.civicRawToken!);
    if (!removed) return fail("media_not_found", 404, res);
    res.status(204).end();
  }));

  app.get("/api/civic/media/:id", asyncRoute(async (req, res) => {
    noStore(res);
    if (!UUID_PATTERN.test(req.params.id)) return fail("media_not_found", 404, res);
    const media = await service.media(req.params.id);
    if (!media) return fail("media_not_found", 404, res);
    res.status(200).type("image/webp").setHeader("Content-Disposition", `inline; filename="${media.id}.webp"`).send(media.bytes);
  }));

  app.get("/api/civic/analytics", asyncRoute(async (_req, res) => {
    noStore(res);
    res.json(await service.analytics());
  }));

  app.get("/api/civic/graph", asyncRoute(async (_req, res) => {
    noStore(res);
    res.json(await service.graph());
  }));

  app.get("/api/civic/sources/states", asyncRoute(async (_req, res) => {
    noStore(res);
    res.json(await listIbgeStates(options.fetcher));
  }));

  app.get("/api/civic/sources/municipalities", asyncRoute(async (req, res) => {
    noStore(res);
    const uf = typeof req.query.uf === "string" ? req.query.uf : "";
    res.json(await listIbgeMunicipalities(uf, options.fetcher));
  }));

  app.get("/api/civic/sources/legislative", asyncRoute(async (req, res) => {
    noStore(res);
    const token = requestToken(req);
    if (!token) return fail("experimental_session_required", 401, res);
    const tokenHash = hashOpaqueToken(token);
    if (!(await repository.findSession(tokenHash, now()))) return fail("experimental_session_expired", 401, res);
    if (!(await repository.incrementMutation(tokenHash, now(), 12, MUTATION_WINDOW_MS))) return fail("source_rate_limited", 429, res);
    const query = typeof req.query.q === "string" ? req.query.q : "";
    res.json(await searchChamberProposals(query, options.fetcher));
  }));

  app.use("/api/civic", (_req, res) => fail("not_found", 404, res));
  app.use("/api", (_req, res) => fail("not_found", 404, res));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => safeError(err, res));
  return app;
}
