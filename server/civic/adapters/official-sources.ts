import type { LegislativeMatch } from "../../../shared/civic/contracts";

export const CHAMBER_PROPOSALS_URL =
  "https://dadosabertos.camara.leg.br/api/v2/proposicoes";
export const IBGE_LOCALITIES_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades";
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_QUERY_LENGTH = 200;
export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export type OfficialFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface IbgeState {
  id: number;
  sigla: string;
  nome: string;
}

export interface IbgeMunicipality {
  id: number;
  nome: string;
}

export class OfficialSourceError extends Error {
  readonly code: string;
  readonly status: number | undefined;

  constructor(code: string, status?: number) {
    super(code);
    this.name = "OfficialSourceError";
    this.code = code;
    this.status = status;
  }
}

const IBGE_STATE_CODES = new Map<string, string>([
  ["11", "RO"],
  ["12", "AC"],
  ["13", "AM"],
  ["14", "RR"],
  ["15", "PA"],
  ["16", "AP"],
  ["17", "TO"],
  ["21", "MA"],
  ["22", "PI"],
  ["23", "CE"],
  ["24", "RN"],
  ["25", "PB"],
  ["26", "PE"],
  ["27", "AL"],
  ["28", "SE"],
  ["29", "BA"],
  ["31", "MG"],
  ["32", "ES"],
  ["33", "RJ"],
  ["35", "SP"],
  ["41", "PR"],
  ["42", "SC"],
  ["43", "RS"],
  ["50", "MS"],
  ["51", "MT"],
  ["52", "GO"],
  ["53", "DF"],
]);

const IBGE_CODE_BY_SIGLA = new Map(
  [...IBGE_STATE_CODES].map(([code, sigla]) => [sigla, code]),
);

const defaultFetcher: OfficialFetcher = (input, init) =>
  globalThis.fetch(input, init);

function sourceError(code: string, status?: number): OfficialSourceError {
  return new OfficialSourceError(code, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !hasControlCharacters(value)
  );
}

function hasControlCharacters(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function isSafeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function validateQuery(query: string): string {
  if (
    typeof query !== "string" ||
    query.trim().length === 0 ||
    query.length > MAX_QUERY_LENGTH ||
    hasControlCharacters(query)
  ) {
    throw sourceError("official_source_invalid_query");
  }
  return query.trim();
}

function normalizeUf(uf: string): string {
  if (typeof uf !== "string") {
    throw sourceError("official_source_invalid_uf");
  }

  const normalized = uf.trim().toUpperCase();
  const code =
    IBGE_STATE_CODES.has(normalized) ? normalized : IBGE_CODE_BY_SIGLA.get(normalized);

  if (!code) {
    throw sourceError("official_source_invalid_uf");
  }
  return code;
}

function expectedResponseUrl(response: Response, requestedUrl: string): boolean {
  if (!response.url) {
    return true;
  }

  try {
    const observed = new URL(response.url);
    const expected = new URL(requestedUrl);
    return (
      observed.protocol === "https:" &&
      observed.origin === expected.origin &&
      observed.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

function assertResponseUrl(response: Response, requestedUrl: string): void {
  if (
    response.redirected ||
    response.type === "opaqueredirect" ||
    !expectedResponseUrl(response, requestedUrl)
  ) {
    throw sourceError("official_source_redirect_or_url");
  }
}

function assertContentLength(response: Response): void {
  const value = response.headers.get("content-length");
  if (value === null) {
    return;
  }

  if (!/^\d+$/.test(value)) {
    throw sourceError("official_source_invalid_response");
  }

  const contentLength = Number(value);
  if (!Number.isSafeInteger(contentLength)) {
    throw sourceError("official_source_invalid_response");
  }
  if (contentLength > MAX_PAYLOAD_BYTES) {
    throw sourceError("official_source_payload_too_large");
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function readResponseBody(
  response: Response,
  controller: AbortController,
): Promise<string> {
  if (!response.body) {
    throw sourceError("official_source_invalid_response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return body + decoder.decode();
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_PAYLOAD_BYTES) {
        controller.abort();
        await reader.cancel();
        throw sourceError("official_source_payload_too_large");
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchJson(
  requestedUrl: string,
  fetcher: OfficialFetcher,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    try {
      response = await fetcher(requestedUrl, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        throw sourceError("official_source_timeout");
      }
      throw sourceError("official_source_unavailable");
    }

    try {
      assertResponseUrl(response, requestedUrl);

      if (!response.ok) {
        throw sourceError(`official_source_http_${response.status}`, response.status);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
        throw sourceError("official_source_invalid_response");
      }
      assertContentLength(response);

      const body = await readResponseBody(response, controller);

      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw sourceError("official_source_invalid_response");
      }
    } catch (error) {
      if (error instanceof OfficialSourceError) {
        throw error;
      }
      if (controller.signal.aborted || isAbortError(error)) {
        throw sourceError("official_source_timeout");
      }
      throw sourceError("official_source_invalid_response");
    }
  } finally {
    clearTimeout(timeout);
  }

}

function validateChamberUrl(value: unknown, id: number): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "dadosabertos.camara.leg.br" &&
      url.pathname === `${new URL(CHAMBER_PROPOSALS_URL).pathname}/${id}` &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function validatePresentedAt(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 80 &&
      !Number.isNaN(Date.parse(value)))
  );
}

function parseChamberResults(payload: unknown): LegislativeMatch[] {
  if (!isRecord(payload) || !Array.isArray(payload.dados) || payload.dados.length > 8) {
    throw sourceError("official_source_invalid_response");
  }

  return payload.dados.map((entry): LegislativeMatch => {
    if (!isRecord(entry)) {
      throw sourceError("official_source_invalid_response");
    }

    const id = entry.id;
    const type = entry.siglaTipo;
    const number = entry.numero;
    const year = entry.ano;
    const summary = entry.ementa;
    const presentedAt = entry.dataApresentacao;

    if (
      !isSafeInteger(id, 1, Number.MAX_SAFE_INTEGER) ||
      !isSafeText(type, 40) ||
      !/^[A-Za-z0-9-]+$/.test(type) ||
      !isSafeInteger(number, 1, Number.MAX_SAFE_INTEGER) ||
      !isSafeInteger(year, 1800, 3000) ||
      !isSafeText(summary, 20_000) ||
      !validatePresentedAt(presentedAt) ||
      !validateChamberUrl(entry.uri, id)
    ) {
      throw sourceError("official_source_invalid_response");
    }

    return {
      source: "Câmara dos Deputados",
      id,
      type,
      number,
      year,
      summary,
      presentedAt,
      officialUrl: entry.uri,
      matchNote: "keyword_match_requires_human_review",
    };
  });
}

function parseIbgeStates(payload: unknown): IbgeState[] {
  if (!Array.isArray(payload) || payload.length > IBGE_STATE_CODES.size) {
    throw sourceError("official_source_invalid_response");
  }

  const seen = new Set<number>();
  return payload.map((entry): IbgeState => {
    if (!isRecord(entry)) {
      throw sourceError("official_source_invalid_response");
    }

    const id = entry.id;
    const sigla = entry.sigla;
    const nome = entry.nome;
    const expectedSigla =
      typeof id === "number" && Number.isSafeInteger(id)
        ? IBGE_STATE_CODES.get(String(id))
        : undefined;

    if (
      !isSafeInteger(id, 1, 99) ||
      !expectedSigla ||
      sigla !== expectedSigla ||
      !isSafeText(nome, 120) ||
      seen.has(id)
    ) {
      throw sourceError("official_source_invalid_response");
    }

    seen.add(id);
    return { id, sigla, nome };
  });
}

function parseIbgeMunicipalities(payload: unknown, ufCode: string): IbgeMunicipality[] {
  if (!Array.isArray(payload) || payload.length > 6_000) {
    throw sourceError("official_source_invalid_response");
  }

  const seen = new Set<number>();
  return payload.map((entry): IbgeMunicipality => {
    if (!isRecord(entry)) {
      throw sourceError("official_source_invalid_response");
    }

    const id = entry.id;
    const nome = entry.nome;
    const prefix = typeof id === "number" ? String(id).slice(0, 2) : "";

    if (
      !isSafeInteger(id, 1_000_000, 99_999_999) ||
      prefix !== ufCode ||
      !isSafeText(nome, 200) ||
      seen.has(id)
    ) {
      throw sourceError("official_source_invalid_response");
    }

    seen.add(id);
    return { id, nome };
  });
}

export async function searchChamberProposals(
  query: string,
  fetcher: OfficialFetcher = defaultFetcher,
): Promise<LegislativeMatch[]> {
  const keywords = validateQuery(query);
  const url = new URL(CHAMBER_PROPOSALS_URL);
  url.searchParams.set("keywords", keywords);
  url.searchParams.set("itens", "8");
  url.searchParams.set("ordem", "DESC");
  url.searchParams.set("ordenarPor", "id");

  return parseChamberResults(await fetchJson(url.toString(), fetcher));
}

export async function listIbgeStates(
  fetcher: OfficialFetcher = defaultFetcher,
): Promise<IbgeState[]> {
  return parseIbgeStates(await fetchJson(`${IBGE_LOCALITIES_URL}/estados`, fetcher));
}

export async function listIbgeMunicipalities(
  uf: string,
  fetcher: OfficialFetcher = defaultFetcher,
): Promise<IbgeMunicipality[]> {
  const ufCode = normalizeUf(uf);
  return parseIbgeMunicipalities(
    await fetchJson(`${IBGE_LOCALITIES_URL}/estados/${ufCode}/municipios`, fetcher),
    ufCode,
  );
}
