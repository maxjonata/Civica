import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCivicSession, civicApi } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("photo upload contract", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearCivicSession();
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-test", expiresAt: 0, mode: "experimental" }))
      .mockResolvedValueOnce(jsonResponse({ id: "media-id" }, 201)) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends the original raster bytes with alt text, CSRF and explicit public consent", async () => {
    const file = new Blob(["raster bytes"], { type: "image/png" }) as File;
    await civicApi.uploadPhoto("proposal-id", file, "Registro visual da praça pública", true);

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const init = calls[1]?.[1];
    const headers = new Headers(init?.headers);
    expect(calls[1]?.[0]).toBe("/api/civic/proposals/proposal-id/media");
    expect(init?.body).toBe(file);
    expect(headers.get("Content-Type")).toBe("image/png");
    expect(headers.get("X-Image-Alt")).toBe("Registro visual da praça pública");
    expect(headers.get("X-Photo-Public-Consent")).toBe("accepted");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test");
  });
});
