import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type { ReviewDecision, ReviewView, SessionView } from "@shared/pilot";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type SessionState = { session: SessionView | null; csrfToken: string | null };

let currentSession: SessionView | null = null;
let currentCsrf: string | null = null;

const messages: Record<string, string> = {
  INVITE_INVALID: "O convite não é válido ou já foi utilizado.",
  NICKNAME_INVALID: "Escolha um apelido entre 2 e 40 caracteres.",
  CONFIG_NOT_READY:
    "Este recurso está bloqueado enquanto a configuração não estiver pronta.",
  UNAUTHORIZED: "Abra sua conta para continuar.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  RECENT_AUTH_REQUIRED:
    "Confirme novamente com uma passkey antes de continuar.",
  SECOND_CREDENTIAL_REQUIRED:
    "Adicione e teste uma segunda credencial antes de enviar o documento.",
  LAST_CREDENTIAL: "A última passkey não pode ser removida.",
  PDF_TOO_LARGE: "O PDF ultrapassa o limite de 2 MiB.",
  EVIDENCE_CONSENT_REQUIRED:
    "Confirme o consentimento antes de enviar a evidência.",
  INVALID_PDF: "Escolha um arquivo PDF digital válido.",
  REVIEW_CONFLICT:
    "A revisão mudou. Atualize a página e confira o estado novamente.",
  REVIEW_NOT_INDEPENDENT:
    "A revisão do próprio titular não pode ser apresentada como independente.",
  WEBAUTHN_NOT_ALLOWED:
    "A passkey não foi autorizada. Tente novamente nesta janela.",
};

export function clearSessionState() {
  currentSession = null;
  currentCsrf = null;
}

export function getSessionState(): SessionState {
  return { session: currentSession, csrfToken: currentCsrf };
}

export function isConfigurationReady(
  configuration: SessionView["configuration"] | null | undefined
) {
  return Boolean(
    configuration?.ready &&
      configuration.origin &&
      configuration.rpID &&
      configuration.documentProtectionReady
  );
}

export function formatOpaqueId(value: string) {
  if (value.length <= 11) return value;
  return `${value.slice(0, 5)}…${value.slice(-6)}`;
}

export function formatDatePtBr(timestamp: number | null | undefined) {
  if (timestamp === null || timestamp === undefined) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function formatStatus(status: string) {
  const labels: Record<string, string> = {
    issued: "documento emitido",
    submitted: "evidência recebida",
    approved: "vinculação aprovada",
    rejected: "vinculação não aprovada",
  };
  return labels[status] ?? "estado não informado";
}

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { error?: unknown }).error;
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { code?: unknown }).code === "string"
  ) {
    return (value as { code: string }).code;
  }
  return null;
}

export function parseApiError(payload: unknown, status = 0) {
  const code = errorCode(payload);
  const message =
    (code && messages[code]) ||
    (status === 401
      ? messages.UNAUTHORIZED
      : status === 403
        ? messages.FORBIDDEN
        : "Não foi possível concluir a operação agora.");
  return new ApiError(message, status, code);
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
  if (mutation && !currentCsrf) await api.session();

  const headers: Record<string, string> = Object.fromEntries(
    new Headers(init.headers).entries()
  );
  headers.Accept = "application/json";
  const hasContentType = Object.keys(headers).some(
    key => key.toLowerCase() === "content-type"
  );
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !hasContentType
  ) {
    headers["Content-Type"] = "application/json";
  }
  if (mutation) {
    headers["X-CSRF-Token"] = currentCsrf ?? "";
    if (typeof window !== "undefined") headers.Origin = window.location.origin;
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const payload = await readResponse(response);
  if (!response.ok) throw parseApiError(payload, response.status);
  return payload as T;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    true
  );
}

async function beginRegistration(
  optionsPath: string,
  verifyPath: string,
  body?: unknown
) {
  const options = await postJson<
    Parameters<typeof startRegistration>[0]["optionsJSON"]
  >(optionsPath, body);
  try {
    const response = await startRegistration({ optionsJSON: options });
    await postJson(verifyPath, { response });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new ApiError(
        messages.WEBAUTHN_NOT_ALLOWED,
        0,
        "WEBAUTHN_NOT_ALLOWED"
      );
    }
    throw error;
  }
  return api.session();
}

async function beginAuthentication(
  optionsPath: string,
  verifyPath: string,
  body?: unknown
) {
  const options = await postJson<
    Parameters<typeof startAuthentication>[0]["optionsJSON"]
  >(optionsPath, body);
  try {
    const response = await startAuthentication({ optionsJSON: options });
    await postJson(verifyPath, { response });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new ApiError(
        messages.WEBAUTHN_NOT_ALLOWED,
        0,
        "WEBAUTHN_NOT_ALLOWED"
      );
    }
    throw error;
  }
  return api.session();
}

export const api = {
  session: async () => {
    const session = await requestJson<SessionView>("/api/session", {
      method: "GET",
    });
    currentSession = session;
    currentCsrf = session.csrfToken;
    return session;
  },
  auth: {
    register: (nickname: string, invite: string) =>
      beginRegistration(
        "/api/auth/register/options",
        "/api/auth/register/verify",
        { nickname, invite }
      ),
    login: () =>
      beginAuthentication("/api/auth/login/options", "/api/auth/login/verify"),
    reauthenticate: () =>
      beginAuthentication(
        "/api/auth/reauth/options",
        "/api/auth/reauth/verify"
      ),
    addCredential: (label: string) =>
      beginRegistration(
        "/api/auth/credentials/options",
        "/api/auth/credentials/verify",
        { label }
      ),
    removeCredential: async (id: string) => {
      await requestJson(
        `/api/auth/credentials/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
        true
      );
      return api.session();
    },
    logout: async () => {
      await postJson("/api/auth/logout");
      clearSessionState();
    },
  },
  logout: async () => {
    await postJson("/api/auth/logout");
    clearSessionState();
  },
  identity: {
    createDocument: async () =>
      postJson<{ id: string }>("/api/identity/document"),
    documentUrl: (id: string) =>
      `/api/identity/document/${encodeURIComponent(id)}`,
    uploadEvidence: async (
      id: string,
      file: File,
      maxBytes = 2 * 1024 * 1024
    ) => {
      if (file.type !== "application/pdf")
        throw new ApiError(messages.INVALID_PDF, 0, "INVALID_PDF");
      if (file.size > maxBytes)
        throw new ApiError(messages.PDF_TOO_LARGE, 0, "PDF_TOO_LARGE");
      if (!currentCsrf) await api.session();
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/pdf",
        "X-CSRF-Token": currentCsrf ?? "",
        "X-Evidence-Consent": "accepted",
      };
      if (typeof window !== "undefined")
        headers.Origin = window.location.origin;
      const response = await fetch(
        `/api/identity/${encodeURIComponent(id)}/evidence`,
        {
          method: "POST",
          body: file,
          headers,
          credentials: "include",
        }
      );
      const payload = await readResponse(response);
      if (!response.ok) throw parseApiError(payload, response.status);
      return payload as { ok: true };
    },
  },
  admin: {
    reviews: () => requestJson<{ reviews: ReviewView[] }>("/api/admin/reviews"),
    evidenceUrl: (id: string) =>
      `/api/admin/reviews/${encodeURIComponent(id)}/evidence`,
    decide: (id: string, decision: ReviewDecision) =>
      postJson(
        `/api/admin/reviews/${encodeURIComponent(id)}/decision`,
        decision
      ),
    discard: (id: string) =>
      postJson(`/api/admin/reviews/${encodeURIComponent(id)}/discard`),
  },
};
