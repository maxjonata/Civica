import { timingSafeEqual } from "node:crypto";
import type {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
} from "express";
import { parse, serialize } from "cookie";
import { hashOpaque } from "../application/auth";
import {
  PilotError,
  type Clock,
  type RequestIdentity,
  type RuntimeConfig,
  type StateRepository,
} from "../ports/pilot";

export const CONTEXT_COOKIE = "civica_context";
export const SESSION_COOKIE = "civica_session";

function cookieOptions(
  config: RuntimeConfig,
  maxAge?: number
): Parameters<typeof serialize>[2] {
  return {
    httpOnly: true,
    path: "/",
    sameSite: config.secureCookies ? "none" : "lax",
    secure: config.secureCookies,
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function requestIdentity(req: Request): RequestIdentity {
  if (req.pilot) return req.pilot;
  const cookies = parse(req.headers.cookie ?? "");
  const identity: RequestIdentity = {
    contextHash: cookies[CONTEXT_COOKIE]
      ? hashOpaque(cookies[CONTEXT_COOKIE])
      : "",
    sessionHash: cookies[SESSION_COOKIE]
      ? hashOpaque(cookies[SESSION_COOKIE])
      : null,
  };
  req.pilot = identity;
  return identity;
}

export function createSecurityMiddleware(
  _repo: StateRepository,
  _config: RuntimeConfig,
  _clock: Clock
): RequestHandler {
  return (req, _res, next) => {
    requestIdentity(req);
    next();
  };
}

function headerValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Enforce exact configured Origin and the raw CSRF token stored for this browser context. */
export async function enforceMutationSecurity(
  repo: StateRepository,
  config: RuntimeConfig,
  clock: Clock,
  req: Request
): Promise<RequestIdentity> {
  if (!config.configured) throw new PilotError("site_not_configured", 503);
  const origin = headerValue(req.headers.origin);
  if (!origin) throw new PilotError("origin_required", 403);
  if (!config.origins.some(allowed => allowed === origin))
    throw new PilotError("origin_forbidden", 403);
  const identity = requestIdentity(req);
  const csrf = headerValue(req.headers["x-csrf-token"]);
  if (!identity.contextHash || !csrf) throw new PilotError("csrf_invalid", 403);
  await repo.transact(state => {
    const context = state.contexts.find(
      candidate => candidate.hash === identity.contextHash
    );
    if (
      !context ||
      context.expiresAt <= clock.now() ||
      !safeEqual(context.csrf, csrf)
    )
      throw new PilotError("csrf_invalid", 403);
  });
  return identity;
}

export function setContextCookie(
  res: Response,
  config: RuntimeConfig,
  rawContext: string
): void {
  res.append(
    "Set-Cookie",
    serialize(CONTEXT_COOKIE, rawContext, cookieOptions(config))
  );
}

export function setSessionCookie(
  res: Response,
  config: RuntimeConfig,
  rawSession: string
): void {
  res.append(
    "Set-Cookie",
    serialize(SESSION_COOKIE, rawSession, cookieOptions(config))
  );
}

export function clearAuthCookies(res: Response, config: RuntimeConfig): void {
  const options = cookieOptions(config, 0);
  res.append("Set-Cookie", serialize(CONTEXT_COOKIE, "", options));
  res.append("Set-Cookie", serialize(SESSION_COOKIE, "", options));
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof PilotError) {
    return res.status(error.status).json({ error: error.code });
  }
  if (error?.type === "entity.too.large")
    return res.status(413).json({ error: "body_too_large" });
  if (error?.type === "entity.parse.failed")
    return res.status(400).json({ error: "invalid_json" });
  return res.status(500).json({ error: "internal_error" });
};
