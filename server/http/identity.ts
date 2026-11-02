import {
  Router,
  raw,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { z } from "zod";
import { MAX_PDF_BYTES, type IdentityService } from "../application/identity";
import { PilotError, type RequestIdentity } from "../ports/pilot";
export interface IdentityHttpDependencies {
  service: Pick<
    IdentityService,
    | "issue"
    | "documentBytes"
    | "submit"
    | "reviews"
    | "evidenceBytes"
    | "decide"
    | "discard"
    | "authorizeUpload"
  >;
  resolveIdentity(req: Request): RequestIdentity;
}
const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
    compliance: z.enum(["valid", "invalid", "indeterminate"]),
    trustAnchor: z.enum(["govbr", "icpbrasil"]).nullable(),
    signedContentConfirmed: z.boolean(),
    identityConfirmed: z.boolean(),
    cpf: z.string().max(14).optional(),
    reviewerDifferentPersonConfirmed: z.boolean(),
    reportReference: z.string().trim().max(120).optional(),
  })
  .strict();
function route(
  operation: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    operation(req, res).catch(next);
  };
}
function attachment(res: Response, bytes: Uint8Array, filename: string): void {
  res
    .set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": `attachment; filename="${filename}"`,
    })
    .type("application/pdf")
    .send(Buffer.from(bytes));
}
export function createIdentityRouter({
  service,
  resolveIdentity,
}: IdentityHttpDependencies): Router {
  const router = Router();
  const session = (req: Request) => resolveIdentity(req).sessionHash;
  router.post(
    "/identity/document",
    route(async (req, res) => {
      const e = await service.issue(session(req));
      res.json({ id: e.id });
    })
  );
  router.get(
    "/identity/document/:id",
    route(async (req, res) => {
      attachment(
        res,
        await service.documentBytes(session(req), req.params.id),
        "civica-vinculacao.pdf"
      );
    })
  );
  const beforeUpload: RequestHandler = (req, res, next) => {
    service
      .authorizeUpload(session(req), req.params.id)
      .then(() => {
        if (!req.is("application/pdf"))
          return next(new PilotError("INVALID_PDF", 415));
        const length = Number(req.headers["content-length"] ?? 0);
        if (Number.isFinite(length) && length > MAX_PDF_BYTES)
          return next(new PilotError("PDF_TOO_LARGE", 413));
        if (req.get("X-Evidence-Consent") !== "accepted")
          return next(new PilotError("EVIDENCE_CONSENT_REQUIRED"));
        next();
      })
      .catch(next);
  };
  router.post(
    "/identity/:id/evidence",
    beforeUpload,
    raw({ type: "application/pdf", limit: MAX_PDF_BYTES }),
    route(async (req, res) => {
      if (!Buffer.isBuffer(req.body)) throw new PilotError("INVALID_PDF", 415);
      await service.submit(session(req), req.params.id, req.body, true);
      res.json({ ok: true });
    })
  );
  router.get(
    "/admin/reviews",
    route(async (req, res) => {
      res.json({ reviews: await service.reviews(session(req)) });
    })
  );
  router.get(
    "/admin/reviews/:id/evidence",
    route(async (req, res) => {
      attachment(
        res,
        await service.evidenceBytes(session(req), req.params.id),
        "civica-evidencia.pdf"
      );
    })
  );
  router.post(
    "/admin/reviews/:id/decision",
    route(async (req, res) => {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) throw new PilotError("INVALID_REVIEW_DECISION");
      await service.decide(session(req), req.params.id, parsed.data);
      res.json({ ok: true });
    })
  );
  router.post(
    "/admin/reviews/:id/discard",
    route(async (req, res) => {
      await service.discard(session(req), req.params.id);
      res.json({ ok: true });
    })
  );
  return router;
}
