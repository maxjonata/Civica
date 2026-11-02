import React from "react";
import { useAppSession } from "@/App";
import { isConfigurationReady } from "@/lib/api";
import type { SessionView } from "@shared/pilot";

export default function Home({
  configuration,
}: {
  configuration?: SessionView["configuration"];
}) {
  const { session } = useAppSession();
  const currentConfiguration = configuration ?? session?.configuration;
  const ready = isConfigurationReady(currentConfiguration);

  return (
    <main>
      <section className="editorial-hero page-wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="rule" /> vínculo aberto / 01
          </p>
          <h1>Uma conta verificável, sem atalhos.</h1>
          <p className="lede">
            O Cívica é um piloto para aprender a vincular uma conta a uma
            identidade assinada, com passkey própria e conferência manual. O
            processo é explícito porque confiança não deve ser uma caixa-preta.
          </p>
          <div className="hero-meta">
            <span>Sem Login gov.br</span>
            <span>Sem biometria no site</span>
            <span>Sem opinião coletada</span>
          </div>
        </div>
        <aside className="editorial-aside" aria-labelledby="pilot-access-title">
          <p className="section-index">Acesso ao piloto</p>
          <h2 id="pilot-access-title">Primeiro, uma chave que seja sua.</h2>
          <p>
            Entre ou cadastre um apelido com convite. A passkey fica vinculada
            ao domínio deste site; nenhuma senha gov.br é inserida aqui.
          </p>
          {session?.account ? (
            <a className="button button--primary" href="/conta">
              Abrir minha conta <span aria-hidden="true">↗</span>
            </a>
          ) : ready ? (
            <a className="button button--primary" href="/acesso">
              Entrar ou cadastrar <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <div className="blocked-panel" role="status">
              <strong>Cadastro em espera.</strong>
              <span>
                A configuração de proteção ainda não está pronta. Nenhum
                cadastro é iniciado antes disso.
              </span>
            </div>
          )}
          <a className="text-link" href="/privacidade">
            Ler limites e retenção <span aria-hidden="true">→</span>
          </a>
        </aside>
      </section>

      <section className="page-wrap manifesto-grid" aria-labelledby="how-title">
        <div>
          <p className="section-index">O que acontece</p>
          <h2 id="how-title">Três passos, nenhuma promessa escondida.</h2>
        </div>
        <ol className="step-list">
          <li>
            <span>01</span>
            <div>
              <h3>Passkey local</h3>
              <p>
                Uma credencial descobrível abre e protege sua conta. Perder
                todas as chaves pode bloquear o acesso.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Assinatura oficial</h3>
              <p>
                Você gera um PDF restrito, assina no portal oficial gov.br e
                baixa o arquivo digital assinado.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Conferência manual</h3>
              <p>
                O operador consulta o VALIDAR oficial e registra uma decisão,
                sem raspar o portal nem fingir automação.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="page-wrap quiet-note">
        <p>
          <strong>Enquetes ainda não fazem parte deste piloto.</strong> Não há
          participantes, resultados ou documentos de demonstração nesta tela.
        </p>
      </section>
    </main>
  );
}
