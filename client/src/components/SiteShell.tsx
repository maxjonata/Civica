import React, { type ReactNode } from "react";
import { useAppSession } from "@/App";
import { isConfigurationReady } from "@/lib/api";

export default function SiteShell({ children }: { children: ReactNode }) {
  const { session, loading, error } = useAppSession();
  const location =
    typeof window === "undefined" ? "/" : window.location.pathname;
  const ready = isConfigurationReady(session?.configuration);

  return (
    <div className="site">
      <header className="topbar">
        <a href="/" className="brand" aria-label="Cívica, início">
          <span className="brand-mark" aria-hidden="true">
            ↗
          </span>
          <span>Cívica</span>
          <span className="brand-note">piloto</span>
        </a>
        <nav className="topnav" aria-label="Navegação principal">
          <a href="/" className={location === "/" ? "active" : ""}>
            Início
          </a>
          <a
            href="/privacidade"
            className={location === "/privacidade" ? "active" : ""}
          >
            Privacidade
          </a>
          {session?.account ? (
            <a href="/conta" className={location === "/conta" ? "active" : ""}>
              Conta
            </a>
          ) : (
            <a
              href="/acesso"
              className={location === "/acesso" ? "active" : ""}
            >
              Acesso
            </a>
          )}
          {session?.account?.role === "admin" && (
            <a
              href="/revisao"
              className={location === "/revisao" ? "active" : ""}
            >
              Revisão
            </a>
          )}
        </nav>
      </header>
      {error && (
        <div className="system-notice system-notice--error" role="alert">
          {error.message}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && session && !ready && (
        <div className="system-notice" role="status">
          A configuração do piloto ainda não está pronta; cadastro e envio
          permanecem bloqueados.
        </div>
      )}
      {children}
      <footer className="site-footer">
        <span>Um piloto pequeno, com estados verificáveis.</span>
        <a href="/privacidade">Como tratamos os dados</a>
      </footer>
    </div>
  );
}
