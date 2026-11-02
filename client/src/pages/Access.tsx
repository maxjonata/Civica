import React, { FormEvent, useState } from "react";
import { useAppSession } from "@/App";
import { api, ApiError, isConfigurationReady } from "@/lib/api";
import type { SessionView } from "@shared/pilot";

export default function Access({
  configuration,
  initialMode = "login",
}: {
  configuration?: SessionView["configuration"];
  initialMode?: "login" | "register";
}) {
  const { session, refresh } = useAppSession();
  const config = configuration ?? session?.configuration;
  const ready = isConfigurationReady(config);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [nickname, setNickname] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.account) {
    return (
      <main className="page-wrap narrow-page">
        <div className="eyebrow">
          <span className="rule" /> sessão aberta
        </div>
        <h1>Você já está dentro.</h1>
        <p className="lede">
          A conta {session.account.nickname} está autenticada neste navegador.
        </p>
        <a className="button button--primary" href="/conta">
          Ir para a conta
        </a>
      </main>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await api.auth.login();
      else await api.auth.register(nickname.trim(), invite.trim());
      await refresh();
      if (typeof window !== "undefined") window.location.assign("/conta");
    } catch (nextError) {
      setError(
        nextError instanceof ApiError
          ? nextError.message
          : "Não foi possível concluir a autenticação."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-wrap access-page">
      <div className="eyebrow">
        <span className="rule" /> acesso local
      </div>
      <div className="form-layout">
        <section className="form-intro">
          <h1>
            {mode === "login" ? "Abra sua conta." : "Comece pelo seu apelido."}
          </h1>
          <p className="lede">
            Use uma passkey do próprio dispositivo. O acesso acontece nesta
            aplicação e não pedimos a senha do gov.br.
          </p>
          <p className="microcopy">
            Acesso por passkey não é recuperação de identidade civil. Mantenha
            uma segunda chave em local seguro.
          </p>
        </section>
        <form className="editorial-form" onSubmit={submit} noValidate>
          <div className="segmented" role="group" aria-label="Tipo de acesso">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              disabled={!ready}
            >
              Cadastrar
            </button>
          </div>
          {mode === "register" && (
            <>
              <label htmlFor="nickname">Apelido público</label>
              <input
                id="nickname"
                name="nickname"
                autoComplete="nickname"
                minLength={2}
                maxLength={40}
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
              />
              <p className="field-help">Não inclua CPF ou nome civil.</p>
              <label htmlFor="invite">Convite de uso único</label>
              <input
                id="invite"
                name="invite"
                autoComplete="off"
                value={invite}
                onChange={e => setInvite(e.target.value)}
                required
              />
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {!ready ? (
            <div className="blocked-panel" role="status">
              <strong>Fluxo bloqueado.</strong>
              <span>
                A configuração de origem e proteção do piloto não está pronta. O
                botão de autenticação permanece indisponível.
              </span>
            </div>
          ) : (
            <button
              className="button button--primary button--full"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Aguardando passkey…"
                : mode === "login"
                  ? "Continuar com passkey"
                  : "Criar conta com passkey"}
            </button>
          )}
          <p className="form-footnote">
            Ao continuar, você verá cada etapa antes de qualquer envio de
            documento. <a href="/privacidade">Leia a privacidade.</a>
          </p>
        </form>
      </div>
    </main>
  );
}
