import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type {
  Clock,
  RandomSource,
  RuntimeConfig,
  StateRepository,
} from "../ports/pilot";
import {
  deleteCredential,
  getSessionView,
  issueInvite,
  logout,
  startCredentialAdd,
  startLogin,
  startReauth,
  startRegistration,
  verifyCredentialAdd,
  verifyLogin,
  verifyReauth,
  verifyRegistration,
  type AuthDependencies,
} from "../application/auth";
import type { WebauthnPort } from "../adapters/webauthn";
import {
  clearAuthCookies,
  enforceMutationSecurity,
  requestIdentity,
  setContextCookie,
  setSessionCookie,
} from "./security";

export interface AuthRouterOptions {
  repo: StateRepository;
  config: RuntimeConfig;
  clock: Clock;
  random: RandomSource;
  webauthn: WebauthnPort;
  getProtectionStatus: () => {
    documentProtectionReady: boolean;
    cpfUniquenessReady: boolean;
  };
}

function deps(options: AuthRouterOptions): AuthDependencies {
  return {
    repo: options.repo,
    config: options.config,
    clock: options.clock,
    random: options.random,
    webauthn: options.webauthn,
  };
}

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>)
    : {};
}

function responseBody(req: Request): unknown {
  const value = body(req);
  return value.id !== undefined ? value : value.response;
}

function mutation(options: AuthRouterOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    enforceMutationSecurity(options.repo, options.config, options.clock, req)
      .then(() => next())
      .catch(next);
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();
  const application = deps(options);
  router.use(express.json({ limit: "64kb", strict: true }));

  router.get(
    "/session",
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      const session = await getSessionView(
        options.repo === application.repo ? application : application,
        identity.contextHash || null,
        identity.sessionHash,
        options.getProtectionStatus
      );
      if (session.rawContext)
        setContextCookie(res, options.config, session.rawContext);
      res.setHeader("Cache-Control", "no-store");
      res.json(session.view);
    })
  );

  router.post(
    "/auth/register/options",
    mutation(options),
    asyncRoute(async (req, res) => {
      const value = body(req);
      const result = await startRegistration(application, {
        contextHash: requestIdentity(req).contextHash,
        nickname: value.nickname as string,
        invite: value.invite as string,
      });
      res.json(result);
    })
  );

  router.post(
    "/auth/register/verify",
    mutation(options),
    asyncRoute(async (req, res) => {
      const result = await verifyRegistration(
        application,
        requestIdentity(req).contextHash,
        responseBody(req)
      );
      setContextCookie(res, options.config, result.rawContext);
      if (result.rawSession)
        setSessionCookie(res, options.config, result.rawSession);
      res.json({ ok: true });
    })
  );

  router.post(
    "/auth/login/options",
    mutation(options),
    asyncRoute(async (req, res) => {
      res.json(await startLogin(application, requestIdentity(req).contextHash));
    })
  );

  router.post(
    "/auth/login/verify",
    mutation(options),
    asyncRoute(async (req, res) => {
      const result = await verifyLogin(
        application,
        requestIdentity(req).contextHash,
        responseBody(req)
      );
      setContextCookie(res, options.config, result.rawContext);
      if (result.rawSession)
        setSessionCookie(res, options.config, result.rawSession);
      res.json({ ok: true });
    })
  );

  router.post(
    "/auth/reauth/options",
    mutation(options),
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      res.json(
        await startReauth(
          application,
          identity.contextHash,
          identity.sessionHash ?? ""
        )
      );
    })
  );

  router.post(
    "/auth/reauth/verify",
    mutation(options),
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      const result = await verifyReauth(
        application,
        identity.contextHash,
        identity.sessionHash ?? "",
        responseBody(req)
      );
      if (result.rawSession)
        setSessionCookie(res, options.config, result.rawSession);
      res.json({ ok: true });
    })
  );

  router.post(
    "/auth/credentials/options",
    mutation(options),
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      res.json(
        await startCredentialAdd(application, {
          contextHash: identity.contextHash,
          sessionHash: identity.sessionHash ?? "",
          label: body(req).label as string,
        })
      );
    })
  );

  router.post(
    "/auth/credentials/verify",
    mutation(options),
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      await verifyCredentialAdd(
        application,
        identity.contextHash,
        identity.sessionHash ?? "",
        responseBody(req)
      );
      res.json({ ok: true });
    })
  );

  router.post(
    "/auth/logout",
    mutation(options),
    asyncRoute(async (req, res) => {
      await logout(application, requestIdentity(req).sessionHash);
      clearAuthCookies(res, options.config);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/auth/credentials/:id",
    mutation(options),
    asyncRoute(async (req, res) => {
      const identity = requestIdentity(req);
      const result = await deleteCredential(
        application,
        identity.sessionHash ?? "",
        req.params.id
      );
      if (result.revokedCurrentSession) clearAuthCookies(res, options.config);
      res.json({ ok: true });
    })
  );

  return router;
}

/** CLI-only helper; there is intentionally no public HTTP invite endpoint. */
export { issueInvite };
