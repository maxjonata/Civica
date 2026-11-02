import express from "express";
import type {
  RuntimeConfig,
  StateRepository,
  CryptoPort,
  DocumentPort,
  Clock,
  RandomSource,
} from "../ports/pilot";
import { PilotError } from "../ports/pilot";
import type { WebauthnPort } from "../adapters/webauthn";
import { createAuthRouter } from "./auth";
import { createIdentityRouter } from "./identity";
import {
  createSecurityMiddleware,
  enforceMutationSecurity,
  errorHandler,
  requestIdentity,
} from "./security";
import { IdentityService } from "../application/identity";
import { enforceRate, requireAccount } from "../domain/security";
export interface AppDependencies {
  repo: StateRepository;
  config: RuntimeConfig;
  crypto: CryptoPort;
  document: DocumentPort;
  clock: Clock;
  random: RandomSource;
  webauthn: WebauthnPort;
  development?: boolean;
}
export function createPilotApp(deps: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), publickey-credentials-create=(self), publickey-credentials-get=(self)",
      "Content-Security-Policy": `default-src 'self'; script-src 'self'${deps.development ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; connect-src 'self'${deps.development ? " ws: wss:" : ""}`,
    });
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  app.use("/api", createSecurityMiddleware(deps.repo, deps.config, deps.clock));
  app.use("/api", (req, _res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    enforceMutationSecurity(deps.repo, deps.config, deps.clock, req)
      .then(async () => {
        if (
          req.get("Content-Encoding") &&
          req.get("Content-Encoding") !== "identity"
        )
          throw new PilotError("COMPRESSED_BODY_FORBIDDEN", 415);
        await deps.repo.transact(state =>
          enforceRate(state, "mutation:global", deps.clock.now(), 120, 60000)
        );
        next();
      })
      .catch(next);
  });
  app.use(
    "/api",
    createAuthRouter({
      ...deps,
      getProtectionStatus: () => ({
        documentProtectionReady: deps.crypto.encryptionReady,
        cpfUniquenessReady: deps.crypto.cpfReady,
      }),
    })
  );
  const identity = new IdentityService({
    ...deps,
    authorizer: {
      require: (state, hash, now, options) =>
        requireAccount(state, hash, now, deps.config, options),
    },
  });
  app.use(
    "/api",
    createIdentityRouter({
      service: identity,
      resolveIdentity: requestIdentity,
    })
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.use(errorHandler);
  return app;
}
