import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CivicApp, { VoteBox } from "./CivicApp";
import { civicApi, clearCivicSession } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Cívica frontend RED contract", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearCivicSession();
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ csrfToken: "csrf-test", expiresAt: 0, mode: "experimental" })
    ) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders an accessible public shell without identity or invented content", () => {
    const markup = renderToStaticMarkup(createElement(CivicApp, { path: "/" }));
    expect(markup).toMatch(/Pular para o conteúdo principal/i);
    expect(markup).toMatch(/<main[^>]+id="conteudo-principal"/i);
    expect(markup).toMatch(/Explorar propostas/i);
    expect(markup).toMatch(/Fazer uma sugestão/i);
    expect(markup).not.toMatch(/passkey|CPF|Manus|gov\.br/i);
    expect(markup).toMatch(/Carregando propostas públicas/i);
  });

  it("shows a loading state before rendering any saved session choice", () => {
    const markup = renderToStaticMarkup(createElement(VoteBox, { proposal: { id: "proposal-test" } }));
    expect(markup).toMatch(/<button[^>]*>Retirar minha escolha<\/button>/i);
    expect(markup).toMatch(/Consultando a escolha desta sessão/i);
    expect(markup).not.toMatch(/— escolhido/);
  });

  it("exposes the civic REST paths and keeps the CSRF token out of bodies", async () => {
    await civicApi.session();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) as typeof fetch;

    await civicApi.proposals({ query: "escola" });
    await civicApi.vote("proposal-1", "support");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/civic/proposals?query=escola",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/civic/proposals/proposal-1/vote",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ choice: "support" }),
      })
    );
    const mutationInit = vi.mocked(globalThis.fetch).mock.calls[1]?.[1];
    expect(new Headers(mutationInit?.headers).get("X-CSRF-Token")).toBe("csrf-test");
  });

  it("loads only the current session's private vote state", async () => {
    await civicApi.session();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ choice: "support" })) as typeof fetch;

    await expect(civicApi.sessionVote("proposal-1")).resolves.toEqual({ choice: "support" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/civic/proposals/proposal-1/vote",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("renders a truthful empty graph with an equivalent textual table", () => {
    const markup = renderToStaticMarkup(createElement(CivicApp, { path: "/conexoes" }));
    expect(markup).toMatch(/Grafo de conexões/i);
    expect(markup).toMatch(/sem perfis verificados|dados insuficientes/i);
    expect(markup).toMatch(/Tabela equivalente/i);
    expect(markup).not.toMatch(/Pessoa|cidadão|amostra fictícia/i);
  });
});
