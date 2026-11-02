import type {
  CivicApi,
  CivicComment,
  CivicMediaView,
  CivicRegionInput,
  CivicSessionResponse,
  CreateClaimInput,
  CreateCommentInput,
  DossierClaim,
  IbgeMunicipalityOption,
  IbgeStateOption,
  LegislativeMatch,
  ProposalDetail,
  ProposalListItem,
  PublicAnalytics,
  PublicGraph,
  RelatedProposal,
  VoteChoice,
} from "@shared/civic/contracts";

export class CivicApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = "CivicApiError";
    this.status = status;
    this.code = code;
  }
}

let csrfToken: string | null = null;

export function clearCivicSession() {
  csrfToken = null;
}

export function getCivicCsrfToken() {
  return csrfToken;
}

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function safeMessage(status: number, code: string | null) {
  if (status === 401) return "Esta sessão experimental terminou. Tente novamente.";
  if (status === 403) return "A operação não foi autorizada nesta sessão.";
  if (code === "VALIDATION_ERROR") return "Confira os campos e tente novamente.";
  if (code === "NOT_FOUND") return "O conteúdo não foi encontrado.";
  return "Não foi possível concluir a operação agora. Tente novamente.";
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  mutation = false
): Promise<T> {
  if (mutation && !csrfToken) await civicApi.session();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (mutation) headers.set("X-CSRF-Token", csrfToken ?? "");
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      method: init.method ?? "GET",
      headers,
      credentials: "include",
    });
  } catch {
    throw new CivicApiError("A conexão não respondeu. Tente novamente.");
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    const code = errorCode(payload);
    throw new CivicApiError(safeMessage(response.status, code), response.status, code);
  }
  return payload as T;
}

function queryString(filters: {
  kind?: string;
  municipalityCode?: string;
  query?: string;
}) {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.municipalityCode) params.set("municipalityCode", filters.municipalityCode);
  if (filters.query) params.set("query", filters.query);
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const civicApi: CivicApi & {
  mediaUrl(id: string): string;
} = {
  session: async (): Promise<CivicSessionResponse> => {
    const session = await requestJson<CivicSessionResponse>("/api/civic/session");
    csrfToken = session.csrfToken;
    return session;
  },
  states: () => requestJson<IbgeStateOption[]>("/api/civic/sources/states"),
  municipalities: (uf: string) =>
    requestJson<IbgeMunicipalityOption[]>(
      `/api/civic/sources/municipalities?uf=${encodeURIComponent(uf)}`
    ),
  proposals: (filters = {}) =>
    requestJson<ProposalListItem[]>(
      `/api/civic/proposals${queryString(filters)}`
    ),
  proposal: (id: string) =>
    requestJson<ProposalDetail>(
      `/api/civic/proposals/${encodeURIComponent(id)}`
    ),
  related: (input) =>
    requestJson<RelatedProposal>("/api/civic/related", {
      method: "POST",
      body: JSON.stringify(input),
    }, true).then(value => (Array.isArray(value) ? value : [])),
  createProposal: input =>
    requestJson<{ id: string }>("/api/civic/proposals", {
      method: "POST",
      body: JSON.stringify(input),
    }, true),
  sessionVote: (proposalId: string) =>
    requestJson<{ choice: VoteChoice | null }>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/vote`
    ),
  vote: (proposalId: string, choice: VoteChoice) =>
    requestJson<void>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/vote`,
      { method: "POST", body: JSON.stringify({ choice }) },
      true
    ),
  withdrawVote: (proposalId: string) =>
    requestJson<void>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/vote`,
      { method: "DELETE" },
      true
    ),
  comment: (proposalId: string, input: CreateCommentInput) =>
    requestJson<{ id: string }>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/comments`,
      { method: "POST", body: JSON.stringify(input) },
      true
    ),
  addClaim: (proposalId: string, input: CreateClaimInput) =>
    requestJson<{ id: string }>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/claims`,
      { method: "POST", body: JSON.stringify(input) },
      true
    ),
  uploadPhoto: async (proposalId: string, file: File, altText: string, publicConsent: true) => {
    if (publicConsent !== true) throw new CivicApiError("A autorização para publicação da foto é obrigatória.", 400, "photo_public_consent_required");
    return requestJson<{ id: string }>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Image-Alt": altText,
          "X-Photo-Public-Consent": "accepted",
        },
        body: file,
      },
      true
    );
  },
  deletePhoto: (proposalId: string, mediaId: string) =>
    requestJson<void>(
      `/api/civic/proposals/${encodeURIComponent(proposalId)}/media/${encodeURIComponent(mediaId)}`,
      { method: "DELETE" },
      true
    ),
  analytics: () => requestJson<PublicAnalytics>("/api/civic/analytics"),
  graph: () => requestJson<PublicGraph>("/api/civic/graph"),
  legislativeSearch: (query: string) =>
    requestJson<LegislativeMatch[]>(
      `/api/civic/sources/legislative?q=${encodeURIComponent(query)}`
    ),
  mediaUrl: (id: string) => `/api/civic/media/${encodeURIComponent(id)}`,
};

export type CivicCommentView = CivicComment;
export type CivicMediaViewType = CivicMediaView;
export type CivicRegion = CivicRegionInput;
export type CivicClaim = DossierClaim;
