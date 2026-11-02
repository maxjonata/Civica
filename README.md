# Cívica — participação cívica experimental

Protótipo para registrar propostas e problemas públicos, facilitar o debate e explorar dados documentados. **Ainda não é uma plataforma pública de coleta comunitária, uma eleição ou uma pesquisa representativa.** O projeto não tem P2P, contas, CPF, integração gov.br ou reconhecimento facial ativos.

## O que funciona nesta etapa

- Navegação pública por propostas, detalhes, debate e estado vazio; criação guiada em quatro etapas e busca determinística por textos possivelmente relacionados.
- Sessão experimental sem cadastro, com token opaco no servidor; voto por sessão e proposta que pode ser alterado ou retirado. Totais são agregados e protegidos por limiar; não demonstram “uma pessoa, um voto”.
- Local do projeto separado da origem do participante. UF e município podem ser escolhidos de listas oficiais do IBGE; se a consulta falhar, há entrada manual, sem GPS ou localização por IP.
- Dossiê manual com alegações tipadas e links de fonte; busca por palavra-chave na Câmara dos Deputados, sempre marcada para revisão humana.
- Analytics inicial de propostas por tipo e regiões informadas; os dados são experimentais, incompletos e sujeitos a auto-seleção.
- Grafo tridimensional ajustável por teclado, com distâncias originais e tabela equivalente. Sem posições verificáveis, ele permanece vazio; nenhum perfil político fictício é inserido.
- Páginas de metodologia, privacidade e acessibilidade. Em vez de inferir a intenção de uma pessoa, o sistema mostra fontes, limitações e lacunas.

## Limites importantes

A integração ao vivo não está uniformemente validada. Em uma medição recente, as chamadas ao IBGE terminaram em falha TLS antes de headers ou corpo; uma consulta limitada a oito itens da Câmara respondeu HTTP 200, o que não comprova cobertura geral nem disponibilidade contínua. A entrada manual de localidade continua habilitada. O limite de resposta permanece em 4 MiB; uma asserção de streaming está registrada no TODO como pendente.

A página de mapa oferece lista textual, não um mapa cartográfico com marcadores. Custos, cronogramas, contatos, legislação e jurisprudência não são pesquisados nem verificados de forma abrangente; itens do dossiê são contribuições da comunidade e precisam de revisão. O grafo não contém perfis de autoridades enquanto não houver posições públicas verificáveis. Não há origem voluntária de quem vota nem cruzamentos pessoais nos analytics.

Fotos ficam somente como prévia local no navegador e **não são enviadas nem publicadas**. O backend recusa uploads enquanto não houver revisão humana e remoção efetiva de bytes. A contribuição no debate exige pseudônimo nesta versão. Ainda não há denúncia, moderação operacional, política completa de retenção, backup externo, plantão, proteção contra DDoS ou revisão jurídica especializada. Não inserir dados pessoais, informações sigilosas ou conteúdo de terceiros.

A versão está preparada para Preview de teste, não para abertura pública. Não foram usados dados, votos, cidadãos, projetos, autoridades ou julgados fictícios na aplicação; dados sintéticos existem somente em bancos locais isolados de teste.

## Stack e estrutura

React 19, TypeScript, Vite 7, Node 22, Express 4, PostgreSQL do Supabase e pnpm 10.34.5. O runtime primário usa `PostgresCivicRepository`; Cloudflare Workers serve a SPA e o Express por meio do binding Hyperdrive. `worker.ts` e `wrangler.jsonc` preparam esse runtime, mas ainda não há Worker implantado. O projeto Supabase `Civica` foi criado na região `sa-east-1`; a migration `supabase/migrations/20261101163854_civica_postgres_schema.sql` foi aplicada e verificada. O esquema tem 11 tabelas vazias em schema privado com RLS habilitado; nenhum dado foi copiado.

As migrations `drizzle/0002_civic.sql` a `drizzle/0004_claim_submission_timestamps.sql` e o adaptador MySQL permanecem para os testes isolados/browser locais. O servidor só aceita MySQL quando `CIVICA_TEST_MODE=1` e a base passa a validação local `civica_test_*`; o runtime normal requer PostgreSQL. O módulo legado de passkeys permanece no repositório, sem fazer parte da navegação nem das rotas cívicas ativas.

## Qualidade e testes

```sh
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` executa TypeScript, lint, suíte isolada, testes SQL em banco local, build, fluxo Playwright com axe e auditoria de dependências. O histórico inicial de 27–28/10, incluindo gates que pararam, está em `docs/civic-validation-report.md`; o TODO registra as validações posteriores das Fases 1 e 2, que passaram browser/axe e usaram apenas banco isolado local. Nesta cópia, em 01/11/2026, passaram TypeScript, lint, build, dry-run Workers e 194 testes isolados (3 testes SQL foram ignorados por não haver MariaDB local); a auditoria passou após a correção do advisory atual de `minimatch`. O adaptador Postgres ainda não passou por integração real via `pg`; Browser/SQL e deploy não foram executados nesta cópia nesta sessão; não há gate completo atual. Nenhum resultado automatizado é certificação WCAG, auditoria formal ou garantia de segurança.

Os testes SQL/browser antigos criam bases MariaDB locais não pessoais com prefixo `civica_test_*`, restritas ao usuário local, sem herdar `DATABASE_URL` gerenciado e sem `DROP`. `pnpm test:civic-browser` exige MariaDB local e Chromium/Playwright. As respostas sintéticas de localidades nesse teste existem somente nessa base isolada; elas não são servidas pelo aplicativo. A nova persistência PostgreSQL tem testes unitários de adaptador; uma instância de Postgres local para integração ainda não foi configurada.

## Operação segura

A migration PostgreSQL do Supabase já está aplicada. O Cloudflare Worker ainda precisa de uma configuração Hyperdrive apontando ao Postgres Supabase, do respectivo ID em `wrangler.jsonc` e de `CIVICA_ORIGIN` correspondente ao hostname final. O dashboard do Cloudflare não tinha Worker, Pages nem domínio ao fazer a verificação; não houve deploy público. Configure a conexão diretamente no dashboard de Hyperdrive/segredos do provedor e nunca registre credenciais no código, Git ou chat. `pnpm migrate:civic:mysql-test` destina-se somente às bases locais MariaDB dos testes antigos; o próprio script bloqueia DSNs compartilhados.

Nenhum Worker ou publicação pública foi feito. Preview, commit, checkpoint e publicação são estados diferentes. Revisão automatizada ou por agente não substitui teste manual com NVDA/VoiceOver, pessoas de diferentes perfis, responsável de moderação, avaliação de privacidade/segurança e processo de resposta a incidentes.

Para localizar o contexto sem confundir o piloto antigo de identidade com o produto cívico atual, comece por [`docs/README.md`](docs/README.md). Consulte também `plan.md`, `TODO.md`, `DECISIONS.md`, `docs/civic-validation-report.md` e `docs/civic-implementation-sources.md` para critérios, decisões, evidências e pendências.
