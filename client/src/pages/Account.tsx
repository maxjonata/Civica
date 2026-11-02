import React, { useState } from "react";
import { Link } from "wouter";
import { useAppSession } from "@/App";
import {
  api,
  ApiError,
  formatDatePtBr,
  formatOpaqueId,
  formatStatus,
} from "@/lib/api";

export default function Account() {
  const { session, loading, refresh, logout } = useAppSession();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading)
    return (
      <main className="page-wrap page-state">
        Carregando o estado da sua conta…
      </main>
    );
  if (!session?.account)
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> conta
        </div>
        <h1>Sua conta começa com uma passkey.</h1>
        <p className="lede">Abra o acesso local para continuar.</p>
        <Link className="button button--primary" href="/acesso">
          Ir para acesso
        </Link>
      </main>
    );

  const addCredential = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.auth.reauthenticate();
      await api.auth.addCredential(label.trim());
      await refresh();
      setLabel("");
      setMessage(
        "A segunda passkey foi adicionada. Teste-a antes de enviar qualquer documento."
      );
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível adicionar esta passkey."
      );
    } finally {
      setBusy(false);
    }
  };

  const removeCredential = async (id: string) => {
    if (busy || session.credentials.length <= 1) return;
    if (
      !window.confirm(
        "Remover esta passkey? A remoção exige uma nova autenticação e não pode ser desfeita por este fluxo."
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.auth.reauthenticate();
      await api.auth.removeCredential(id);
      await refresh();
      setMessage("Passkey removida.");
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível remover esta passkey."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-wrap account-page">
      <div className="eyebrow">
        <span className="rule" /> sua conta
      </div>
      <div className="account-heading">
        <div>
          <h1>Estado da conta.</h1>
          <p className="lede">
            A conta está autenticada pelo site, não pelo gov.br.
          </p>
        </div>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => void logout()}
        >
          Encerrar sessão
        </button>
      </div>
      <section className="account-record" aria-labelledby="record-title">
        <div>
          <p className="section-index" id="record-title">
            Registro
          </p>
          <p
            className="record-id"
            aria-label={`ID da conta ${session.account.id}`}
          >
            {formatOpaqueId(session.account.id)}
          </p>
        </div>
        <dl>
          <div>
            <dt>Apelido</dt>
            <dd>{session.account.nickname}</dd>
          </div>
          <div>
            <dt>Papel</dt>
            <dd>{session.account.role === "admin" ? "operador" : "titular"}</dd>
          </div>
          <div>
            <dt>Criada em</dt>
            <dd>{formatDatePtBr(session.account.createdAt)}</dd>
          </div>
          <div>
            <dt>Vínculo</dt>
            <dd>
              {session.identity
                ? formatStatus(session.identity.status)
                : "ainda não vinculada"}
            </dd>
          </div>
        </dl>
      </section>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section
        className="credential-section"
        aria-labelledby="credentials-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-index">Acesso</p>
            <h2 id="credentials-title">Passkeys deste site</h2>
          </div>
          <span className="status-chip">
            {session.credentials.length}{" "}
            {session.credentials.length === 1 ? "credencial" : "credenciais"}
          </span>
        </div>
        <p className="section-lede">
          A lista mostra somente metadados necessários. Duas chaves no mesmo
          dispositivo ou provedor ainda podem falhar juntas.
        </p>
        <ul className="credential-list">
          {session.credentials.map(credential => (
            <li key={credential.id}>
              <div>
                <strong>{credential.label || "Passkey sem apelido"}</strong>
                <span>
                  Adicionada {formatDatePtBr(credential.createdAt)} · última
                  utilização {formatDatePtBr(credential.lastUsedAt)}
                </span>
                {credential.isCurrent && <em>usada nesta sessão</em>}
              </div>
              <button
                className="button button--text-danger"
                type="button"
                disabled={busy || session.credentials.length <= 1}
                onClick={() => void removeCredential(credential.id)}
              >
                {session.credentials.length <= 1 ? "Última chave" : "Excluir"}
              </button>
            </li>
          ))}
        </ul>
        <div className="add-credential">
          <label htmlFor="credential-label">Nome para a nova passkey</label>
          <div className="inline-form">
            <input
              id="credential-label"
              value={label}
              maxLength={80}
              onChange={event => setLabel(event.target.value)}
              placeholder="Ex.: chave reserva"
            />
            <button
              className="button button--secondary"
              type="button"
              disabled={busy || !label.trim()}
              onClick={() => void addCredential()}
            >
              {busy ? "Confirmando…" : "Adicionar com reautenticação"}
            </button>
          </div>
          <p className="field-help">
            A inclusão pede uma autenticação recente. O navegador seleciona a
            credencial; não contornamos bloqueios de iframe.
          </p>
        </div>
      </section>
      <section className="next-action">
        <p className="section-index">Próximo passo</p>
        <h2>
          Quando houver duas chaves testadas, você pode iniciar a vinculação.
        </h2>
        <Link className="text-link" href="/vinculacao">
          Ver vinculação manual <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
