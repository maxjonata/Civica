import React, { ChangeEvent, useState } from "react";
import { Link } from "wouter";
import { useAppSession } from "@/App";
import { api, ApiError, formatStatus, isConfigurationReady } from "@/lib/api";
import { issuedDocumentId, testedCredentials } from "@/lib/linkage-policy";

export default function Linkage() {
  const { session, loading, refresh } = useAppSession();
  const secondCredentialTested = testedCredentials(session?.credentials ?? []);
  const documentId = issuedDocumentId(session?.identity ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading)
    return (
      <main className="page-wrap page-state">
        Carregando o estado da vinculação…
      </main>
    );
  if (!session?.account)
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> vinculação
        </div>
        <h1>Entre antes de preparar um documento.</h1>
        <p className="lede">A vinculação é autenticada pela conta local.</p>
        <Link className="button button--primary" href="/acesso">
          Ir para acesso
        </Link>
      </main>
    );
  if (!isConfigurationReady(session.configuration))
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> vinculação bloqueada
        </div>
        <h1>A proteção do documento ainda não está pronta.</h1>
        <p className="lede">
          Nenhum PDF pode ser emitido ou recebido enquanto as chaves de proteção
          não estiverem disponíveis.
        </p>
      </main>
    );

  const hasSecondCredential = session.credentials.length >= 2;
  const identity = session.identity;
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    setMessage(null);
    if (chosen && chosen.type !== "application/pdf") {
      setFile(null);
      setError("Escolha um PDF digital, não uma foto ou captura de tela.");
      return;
    }
    if (chosen && chosen.size > session.configuration.maxPdfBytes) {
      setFile(null);
      setError("Este PDF ultrapassa o limite de 2 MiB.");
      return;
    }
    setFile(chosen);
  };

  const testSecond = async () => {
    if (!hasSecondCredential || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const confirmed = await api.auth.reauthenticate();
      await refresh();
      if (testedCredentials(confirmed.credentials))
        setMessage(
          "As duas credenciais têm utilização comprovada. Você pode emitir o documento."
        );
      else
        setError(
          "Foi usada a chave já testada. Selecione a passkey reserva para comprovar o segundo acesso."
        );
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "A segunda credencial não foi confirmada."
      );
    } finally {
      setBusy(false);
    }
  };

  const issueDocument = async () => {
    if (!secondCredentialTested || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.auth.reauthenticate();
      await api.identity.createDocument();
      setMessage(
        "Documento emitido. Baixe-o, assine no portal oficial e volte com o PDF assinado."
      );
      await refresh();
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível emitir o documento."
      );
    } finally {
      setBusy(false);
    }
  };

  const submitEvidence = async () => {
    const id = documentId;
    if (!id || !file || !consent || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.auth.reauthenticate();
      await api.identity.uploadEvidence(
        id,
        file,
        session.configuration.maxPdfBytes
      );
      await refresh();
      setMessage(
        "PDF recebido para conferência manual. O arquivo não é exibido nesta página."
      );
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível enviar o PDF."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-wrap linkage-page">
      <div className="eyebrow">
        <span className="rule" /> vinculação manual / 02
      </div>
      <div className="page-title-row">
        <div>
          <h1>Vincule sua conta com calma.</h1>
          <p className="lede">
            São três portas antes do envio: duas credenciais, assinatura no
            portal oficial e consentimento explícito.
          </p>
        </div>
        {identity && (
          <span className="status-chip">{formatStatus(identity.status)}</span>
        )}
      </div>
      <ol className="process-steps">
        <li className={secondCredentialTested ? "done" : "current"}>
          <span>01</span>
          <div>
            <h2>Duas credenciais com acesso testado</h2>
            <p>
              Uma segunda passkey reduz o risco de perda conjunta, mas não o
              elimina. O site não cria uma chave reserva sozinho.
            </p>
            {!hasSecondCredential && (
              <div className="blocked-panel">
                <strong>Adicione uma segunda passkey na conta.</strong>
                <Link className="text-link" href="/conta">
                  Gerenciar passkeys →
                </Link>
              </div>
            )}
            {hasSecondCredential && !secondCredentialTested && (
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => void testSecond()}
              >
                {busy ? "Confirmando…" : "Testar a segunda passkey"}
              </button>
            )}
            {secondCredentialTested && (
              <p className="form-success">
                Duas credenciais têm utilização confirmada pelo servidor.
              </p>
            )}
          </div>
        </li>
        <li className={documentId ? "done" : "current"}>
          <span>02</span>
          <div>
            <h2>Documento e assinatura oficial</h2>
            <p>
              O PDF contém finalidade restrita, ID opaco da conta, resumo da
              chave, desafio e validade de 24 horas.
            </p>
            <button
              className="button button--secondary"
              type="button"
              disabled={!secondCredentialTested || busy || Boolean(documentId)}
              onClick={() => void issueDocument()}
            >
              {documentId
                ? "Documento emitido"
                : busy
                  ? "Emitindo…"
                  : "Emitir PDF de vinculação"}
            </button>
            {documentId && (
              <div className="document-actions">
                <a
                  className="text-link"
                  href={api.identity.documentUrl(documentId)}
                  download
                >
                  Baixar PDF para assinar <span aria-hidden="true">↗</span>
                </a>
                <a
                  className="text-link"
                  href="https://assinador.iti.br"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir assinador.iti.br <span aria-hidden="true">↗</span>
                </a>
                <a
                  className="text-link"
                  href="https://validar.iti.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir validar.iti.gov.br <span aria-hidden="true">↗</span>
                </a>
                <p className="microcopy">
                  Assine no portal oficial e baixe o PDF digital assinado. Não
                  insira a senha gov.br neste site.
                </p>
              </div>
            )}
          </div>
        </li>
        <li
          className={
            identity?.status === "submitted" ||
            identity?.status === "approved" ||
            identity?.status === "rejected"
              ? "done"
              : "current"
          }
        >
          <span>03</span>
          <div>
            <h2>Enviar o PDF assinado</h2>
            <p>
              O arquivo será tratado como evidência não confiável e ficará
              disponível somente para conferência autenticada. Não renderizamos
              o documento dentro do site.
            </p>
            {identity?.status === "submitted" ||
            identity?.status === "approved" ||
            identity?.status === "rejected" ? (
              <p className="form-success">
                Evidência já recebida. Estado atual:{" "}
                {formatStatus(identity.status)}.
              </p>
            ) : (
              <div className="upload-box">
                <label htmlFor="signed-pdf">PDF digital assinado</label>
                <input
                  id="signed-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={chooseFile}
                  disabled={!documentId || busy}
                />
                <p className="field-help">
                  Máximo:{" "}
                  {Math.round(session.configuration.maxPdfBytes / 1024 / 1024)}{" "}
                  MiB. Foto, screenshot e impressão não são aceitos.
                </p>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={event => setConsent(event.target.checked)}
                    disabled={!documentId || busy}
                  />{" "}
                  <span>
                    Consinto com o envio deste PDF para conferência manual e
                    entendo a retenção proposta de até sete dias após a decisão.
                  </span>
                </label>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!documentId || !file || !consent || busy}
                  onClick={() => void submitEvidence()}
                >
                  {busy ? "Enviando…" : "Enviar para conferência"}
                </button>
              </div>
            )}
          </div>
        </li>
      </ol>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <p className="microcopy page-endnote">
        A assinatura prova autoria sob uma credencial aceita; não é
        reconhecimento facial nem Login Único gov.br.
      </p>
    </main>
  );
}
