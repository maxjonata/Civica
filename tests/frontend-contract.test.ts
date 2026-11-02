import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionView } from "@shared/pilot";
import {
  api,
  clearSessionState,
  formatDatePtBr,
  formatOpaqueId,
  getSessionState,
  isConfigurationReady,
  parseApiError,
} from "@/lib/api";
import Access from "@/pages/Access";
import Home from "@/pages/Home";
import Privacy from "@/pages/Privacy";

const notReadySession: SessionView = {
  account: null,
  credentials: [],
  csrfToken: "csrf-test-only",
  recentAuth: false,
  identity: null,
  configuration: {
    ready: false,
    origin: "",
    rpID: "",
    documentProtectionReady: false,
    cpfUniquenessReady: false,
    requiresInvite: true,
    maxPdfBytes: 2 * 1024 * 1024,
  },
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("frontend REST contract", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearSessionState();
    globalThis.fetch = vi.fn(async () =>
      response(notReadySession)
    ) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches the session with same-origin credentials and keeps csrf only in memory", async () => {
    const session = await api.session();
    expect(session).toEqual(notReadySession);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(getSessionState().csrfToken).toBe("csrf-test-only");
    expect(() => localStorage).toThrowError();
  });

  it("sends csrf on mutations without putting it in a body or storage", async () => {
    await api.session();
    globalThis.fetch = vi.fn(async () =>
      response({ ok: true })
    ) as typeof fetch;

    await api.logout();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-test-only",
        }),
      })
    );
    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(init?.body).toBeUndefined();
  });

  it("refreshes the in-memory csrf token after a rotating session response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(response(notReadySession))
      .mockResolvedValueOnce(
        response({ ...notReadySession, csrfToken: "csrf-rotated" })
      ) as typeof fetch;

    await api.session();
    await api.session();

    expect(getSessionState().csrfToken).toBe("csrf-rotated");
  });

  it("maps structured API errors to safe Portuguese without exposing response bodies", () => {
    const error = parseApiError({ error: { code: "INVITE_INVALID" } }, 400);
    expect(error.message).toMatch(/convite/i);
    expect(error.message).not.toContain("INVITE_INVALID");
    expect(error.message).not.toContain("csrf");
    expect(
      parseApiError({ error: "UNKNOWN_SERVER_DETAIL" }, 500).message
    ).toMatch(/não foi possível|indisponível/i);
  });

  it("defines readiness and safe display formatters", () => {
    expect(isConfigurationReady(notReadySession.configuration)).toBe(false);
    expect(formatOpaqueId("acct_01HXYZ987")).toBe("acct_…XYZ987");
    expect(formatDatePtBr(0)).toMatch(/1970/);
  });

  it("renders an honest empty home and privacy notice with no invented metrics", () => {
    const home = renderToStaticMarkup(
      createElement(Home, { configuration: notReadySession.configuration })
    );
    const privacy = renderToStaticMarkup(createElement(Privacy));
    expect(home).toMatch(/Cívica/);
    expect(home).toMatch(/enquetes ainda não fazem parte deste piloto/i);
    expect(home).not.toMatch(/%|1\.000|votos/i);
    expect(privacy).toMatch(/sete dias/i);
    expect(privacy).toMatch(/não.*isolamento completo/i);
  });

  it("renders access as blocked when configuration is not ready and has no fake account state", () => {
    const markup = renderToStaticMarkup(
      createElement(Access, { configuration: notReadySession.configuration })
    );
    expect(markup).toMatch(
      /configuração.*não está pronta|temporariamente bloqueado/i
    );
    expect(markup).not.toMatch(/conta criada|bem-vindo/i);
    expect(markup).not.toMatch(/manus|oauth/i);
  });

  it("keeps signup validation visible only when configuration is ready", () => {
    const readyConfiguration = {
      ...notReadySession.configuration,
      ready: true,
      origin: "https://civica.example",
      rpID: "civica.example",
      documentProtectionReady: true,
    };
    const markup = renderToStaticMarkup(
      createElement(Access, {
        configuration: readyConfiguration,
        initialMode: "register",
      })
    );
    expect(markup).toMatch(/Apelido público/);
    expect(markup).toMatch(/minlength="2"/i);
    expect(markup).toMatch(/Não inclua CPF/);
  });

  it("rejects non-PDF and oversized evidence before any network request", async () => {
    const notPdf = new File(["not a pdf"], "nota.txt", { type: "text/plain" });
    const tooLarge = new File([new Uint8Array(5)], "grande.pdf", {
      type: "application/pdf",
    });
    await expect(
      api.identity.uploadEvidence("identity-test", notPdf, 4)
    ).rejects.toMatchObject({ code: "INVALID_PDF" });
    await expect(
      api.identity.uploadEvidence("identity-test", tooLarge, 4)
    ).rejects.toMatchObject({ code: "PDF_TOO_LARGE" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("sends evidence as raw PDF with explicit consent and in-memory csrf", async () => {
    const file = new File(["%PDF-test"], "assinado.pdf", {
      type: "application/pdf",
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(response(notReadySession))
      .mockResolvedValueOnce(response({ ok: true })) as typeof fetch;
    await api.identity.uploadEvidence("identity-test", file, 1024);
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        body: file,
        credentials: "include",
      })
    );
    expect(init?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/pdf",
        "X-CSRF-Token": "csrf-test-only",
        "X-Evidence-Consent": "accepted",
      })
    );
  });

  it("does not use browser storage or OAuth/trpc paths in the client API", async () => {
    const source = await import("node:fs/promises").then(fs =>
      fs.readFile(new URL("../client/src/lib/api.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(
      /localStorage|sessionStorage|Authorization|api\/trpc|oauth/i
    );
  });
});
