import React from "react";

export default function Privacy() {
  return (
    <main className="page-wrap narrow-page privacy-page">
      <div className="eyebrow">
        <span className="rule" /> nota de privacidade
      </div>
      <h1>Dados reais exigem limites reais.</h1>
      <p className="lede">
        Este piloto trata uma conta e uma evidência de assinatura para testar o
        vínculo manual. Ele não é um serviço público de identidade, nem uma
        enquete aberta.
      </p>
      <div className="prose-block">
        <h2>O que pode existir</h2>
        <p>
          A conta guarda um identificador opaco, apelido e metadados necessários
          das passkeys. O PDF assinado é conteúdo não confiável, protegido antes
          de persistir e acessível somente por rotas autenticadas.
        </p>
        <h2>O que não fazemos</h2>
        <p>
          Não usamos Login Único gov.br, não pedimos senha gov.br, não fazemos
          reconhecimento facial e não carregamos logos ou APIs de governo como
          se fossem parte do site. Não há comunidade, CNPJ, votos ou resultados
          nesta etapa.
        </p>
        <h2>Retenção proposta</h2>
        <p>
          A evidência cifrada pode ser descartada até sete dias após a decisão.
          Isso não promete apagar cópias em backups ou no serviço oficial de
          validação. A confirmação de base legal, operadores e resposta a
          incidentes continua pendente antes de ampliar o piloto.
        </p>
        <h2>Limite de isolamento</h2>
        <p>
          Conta e identidade podem compartilhar processo e banco neste piloto.
          Isso <strong>não é isolamento completo</strong>; um comprometimento
          operacional poderia alcançar todo o conjunto. Por isso a coleta
          comunitária permanece fechada.
        </p>
      </div>
    </main>
  );
}
