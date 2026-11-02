import { describe, expect, it, vi } from "vitest";
import {
  MAX_PAYLOAD_BYTES,
  REQUEST_TIMEOUT_MS,
  listIbgeMunicipalities,
  listIbgeStates,
  searchChamberProposals,
} from "./official-sources";

const chamberUrl = "https://dadosabertos.camara.leg.br/api/v2/proposicoes";
const ibgeStatesUrl =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
const ibgeMunicipalitiesUrl =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios";

type FetchCall = {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
};

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    contentType?: string;
    url?: string;
    redirected?: boolean;
  } = {},
): Response {
  const response = new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status: options.status ?? 200,
      headers: {
        "content-type": options.contentType ?? "application/json; charset=utf-8",
      },
    },
  );

  Object.defineProperty(response, "url", {
    configurable: true,
    value: options.url ?? "",
  });
  Object.defineProperty(response, "redirected", {
    configurable: true,
    value: options.redirected ?? false,
  });
  return response;
}

function chamberPayload(uri = `${chamberUrl}/123`) {
  return {
    dados: [
      {
        id: 123,
        uri,
        siglaTipo: "PL",
        numero: 456,
        ano: 2026,
        ementa: "Dispõe sobre mobilidade urbana sustentável.",
        dataApresentacao: "2026-01-15T12:00:00",
      },
    ],
    links: [],
  };
}

describe("adaptador oficial de fontes", () => {
  it("busca proposições somente no endpoint fixo e marca o resultado como revisão humana", async () => {
    let call: FetchCall | undefined;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      call = { input, init };
      return jsonResponse(chamberPayload(), {
        url: `${chamberUrl}?keywords=mobilidade&itens=8&ordem=DESC&ordenarPor=id`,
      });
    });

    const results = await searchChamberProposals("  mobilidade  ", fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(call).toBeDefined();
    const requestUrl = new URL(String(call?.input));
    expect(requestUrl.origin + requestUrl.pathname).toBe(chamberUrl);
    expect(requestUrl.searchParams.get("keywords")).toBe("mobilidade");
    expect(requestUrl.searchParams.get("itens")).toBe("8");
    expect(requestUrl.searchParams.get("ordem")).toBe("DESC");
    expect(requestUrl.searchParams.get("ordenarPor")).toBe("id");
    expect(call?.init?.redirect).toBe("error");
    expect(call?.init?.signal).toBeInstanceOf(AbortSignal);

    expect(results).toEqual([
      {
        source: "Câmara dos Deputados",
        id: 123,
        type: "PL",
        number: 456,
        year: 2026,
        summary: "Dispõe sobre mobilidade urbana sustentável.",
        presentedAt: "2026-01-15T12:00:00",
        officialUrl: `${chamberUrl}/123`,
        matchNote: "keyword_match_requires_human_review",
      },
    ]);
  });

  it("rejects empty, oversized or control-character queries before any request", async () => {
    const fetcher = vi.fn();

    await expect(searchChamberProposals("", fetcher)).rejects.toThrow(
      "official_source_invalid_query",
    );
    await expect(searchChamberProposals("   ", fetcher)).rejects.toThrow(
      "official_source_invalid_query",
    );
    await expect(searchChamberProposals("x".repeat(201), fetcher)).rejects.toThrow(
      "official_source_invalid_query",
    );
    await expect(searchChamberProposals("obra\nprivada", fetcher)).rejects.toThrow(
      "official_source_invalid_query",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects invalid content type, shape and non-official item URL", async () => {
    await expect(
      searchChamberProposals("escola", async () =>
        jsonResponse(chamberPayload(), { contentType: "text/html" }),
      ),
    ).rejects.toThrow("official_source_invalid_response");

    await expect(
      searchChamberProposals("escola", async () =>
        jsonResponse({ dados: [{ id: 123 }] }),
      ),
    ).rejects.toThrow("official_source_invalid_response");

    await expect(
      searchChamberProposals("escola", async () =>
        jsonResponse(chamberPayload("https://evil.example/proposicoes/123")),
      ),
    ).rejects.toThrow("official_source_invalid_response");
  });

  it("rejects altered response URLs and redirects", async () => {
    await expect(
      searchChamberProposals("saude", async () =>
        jsonResponse(chamberPayload(), {
          url: "https://evil.example/api/v2/proposicoes?keywords=saude",
        }),
      ),
    ).rejects.toThrow("official_source_redirect_or_url");

    await expect(
      searchChamberProposals("saude", async () =>
        jsonResponse(chamberPayload(), { redirected: true }),
      ),
    ).rejects.toThrow("official_source_redirect_or_url");
  });

  it("returns sanitized failures for 429 and 503 without logging the participant query", async () => {
    const participantQuery = "consulta-participante-nao-logar-429";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        searchChamberProposals(participantQuery, async () =>
          jsonResponse({}, { status: 429 }),
        ),
      ).rejects.toThrow("official_source_http_429");
      await expect(
        searchChamberProposals(participantQuery, async () =>
          jsonResponse({}, { status: 503 }),
        ),
      ).rejects.toThrow("official_source_http_503");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(participantQuery);
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(chamberUrl);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("maps an aborted fetch to a sanitized timeout failure and requests redirect:error", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException("request timed out", "AbortError");
    });

    await expect(searchChamberProposals("transporte", fetcher)).rejects.toThrow(
      "official_source_timeout",
    );
  });

  it("rejects a response whose body exceeds the payload limit", async () => {
    const oversizedPayload = "x".repeat(4 * 1024 * 1024 + 1);

    await expect(
      listIbgeStates(async () => jsonResponse(oversizedPayload)),
    ).rejects.toThrow("official_source_payload_too_large");
  });

  it("stops and cancels a streaming body as soon as it exceeds the payload limit", async () => {
    let signal: AbortSignal | undefined;
    let cancelCalled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new Uint8Array(MAX_PAYLOAD_BYTES + 1));
          return;
        }
        throw new Error("read past payload limit");
      },
      cancel() {
        cancelCalled = true;
      },
    }, { highWaterMark: 0 });
    const response = new Response(body, {
      headers: { "content-type": "application/json" },
    });

    await expect(
      listIbgeStates(async (_input, init) => {
        signal = init?.signal as AbortSignal;
        return response;
      }),
    ).rejects.toThrow("official_source_payload_too_large");

    expect(signal?.aborted).toBe(true);
    expect(cancelCalled).toBe(true);
    expect(pulls).toBe(1);
  });

  it("classifies a timeout while the streaming body is paused", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let releaseBody!: () => void;
    try {
      const body = new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>((_resolve, reject) => {
            releaseBody = () => reject(new DOMException("aborted", "AbortError"));
            signal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        },
      });

      const pending = listIbgeStates(async (_input, init) => {
        signal = init?.signal as AbortSignal;
        return new Response(body, {
          headers: { "content-type": "application/json" },
        });
      });
      await Promise.resolve();
      vi.advanceTimersByTime(REQUEST_TIMEOUT_MS);
      expect(signal?.aborted).toBe(true);
      await expect(pending).rejects.toThrow("official_source_timeout");
    } finally {
      releaseBody?.();
      vi.useRealTimers();
    }
  });

  it("lists validated IBGE states from the fixed localities endpoint", async () => {
    let call: FetchCall | undefined;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      call = { input, init };
      return jsonResponse(
        [
          { id: 33, sigla: "RJ", nome: "Rio de Janeiro" },
          { id: 35, sigla: "SP", nome: "São Paulo" },
        ],
        { url: ibgeStatesUrl },
      );
    });

    const states = await listIbgeStates(fetcher);

    expect(String(call?.input)).toBe(ibgeStatesUrl);
    expect(call?.init?.redirect).toBe("error");
    expect(states).toEqual([
      { id: 33, sigla: "RJ", nome: "Rio de Janeiro" },
      { id: 35, sigla: "SP", nome: "São Paulo" },
    ]);
  });

  it("lists validated municipalities by numeric IBGE UF identifier", async () => {
    let call: FetchCall | undefined;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      call = { input, init };
      return jsonResponse(
        [
          { id: 3304557, nome: "Rio de Janeiro" },
          { id: 3301702, nome: "Duque de Caxias" },
        ],
        { url: ibgeMunicipalitiesUrl },
      );
    });

    const municipalities = await listIbgeMunicipalities("33", fetcher);

    expect(String(call?.input)).toBe(ibgeMunicipalitiesUrl);
    expect(call?.init?.redirect).toBe("error");
    expect(municipalities).toEqual([
      { id: 3304557, nome: "Rio de Janeiro" },
      { id: 3301702, nome: "Duque de Caxias" },
    ]);
  });

  it("rejects malformed UF input and malformed IBGE payloads before exposing data", async () => {
    const fetcher = vi.fn();

    await expect(listIbgeMunicipalities("", fetcher)).rejects.toThrow(
      "official_source_invalid_uf",
    );
    await expect(listIbgeMunicipalities("3", fetcher)).rejects.toThrow(
      "official_source_invalid_uf",
    );
    await expect(listIbgeMunicipalities("333", fetcher)).rejects.toThrow(
      "official_source_invalid_uf",
    );
    await expect(listIbgeMunicipalities("R1", fetcher)).rejects.toThrow(
      "official_source_invalid_uf",
    );
    expect(fetcher).not.toHaveBeenCalled();

    await expect(
      listIbgeStates(async () => jsonResponse([{ id: "33", sigla: "RJ", nome: "RJ" }])),
    ).rejects.toThrow("official_source_invalid_response");
    await expect(
      listIbgeMunicipalities("33", async () =>
        jsonResponse([{ id: 0, nome: "Sem nome oficial" }]),
      ),
    ).rejects.toThrow("official_source_invalid_response");
  });

  it("rejects an altered IBGE response URL and upstream statuses", async () => {
    await expect(
      listIbgeStates(async () =>
        jsonResponse([], { url: "https://evil.example/localidades/estados" }),
      ),
    ).rejects.toThrow("official_source_redirect_or_url");

    await expect(
      listIbgeStates(async () => jsonResponse([], { status: 429 })),
    ).rejects.toThrow("official_source_http_429");
    await expect(
      listIbgeStates(async () => jsonResponse([], { status: 503 })),
    ).rejects.toThrow("official_source_http_503");
  });
});
