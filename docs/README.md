# Mapa da documentação da Cívica

Este arquivo é o índice para retomar o projeto. A documentação está em português, como a interface e os registros do projeto.

## Ordem de referência

Quando documentos divergirem, use esta ordem:

1. **Código, migrações e testes presentes no working tree** descrevem o estado implementado agora. A presença do código, sozinha, não prova que passou em testes, foi migrado ou foi publicado.
2. [`TODO.md`](../TODO.md) é a lista operacional de pendências e fases autorizadas.
3. [`DECISIONS.md`](../DECISIONS.md) guarda decisões explícitas de produto e operação.
4. [`README.md`](../README.md) resume o produto, os limites e os resultados de validação registrados.
5. [`plan.md`](../plan.md) guarda os critérios e a direção de produto em mais detalhe.
6. [`CONTEXTO_DA_CONVERSA.md`](../CONTEXTO_DA_CONVERSA.md) é o histórico de transferência. Datas e estados de implementação nesse arquivo são snapshots e podem estar desatualizados; confira o repositório e os relatórios datados.

Os relatórios de validação e revisão são evidência histórica datada. Não substituem uma execução atual nem certificam segurança, acessibilidade ou prontidão pública.

## Documentos atuais

| Documento | Finalidade |
|---|---|
| [`civic-validation-report.md`](civic-validation-report.md) | Resultados e falhas observadas em execuções datadas; separa etapas aprovadas das que não terminaram. |
| [`civic-code-review.md`](civic-code-review.md) | Revisão read-only da implementação cívica e lacunas identificadas naquela revisão. |
| [`civic-implementation-sources.md`](civic-implementation-sources.md) | Endpoints, medições e limites das fontes consultadas; não promete cobertura contínua. |
| [`deployment-supabase-cloudflare.md`](deployment-supabase-cloudflare.md) | Estado da migração de infraestrutura, configuração Supabase e passos pendentes de Hyperdrive/deploy. |
| [`civic-accessibility-design.md`](civic-accessibility-design.md) | Critérios de acessibilidade e experiência. |
| [`civic-privacy-design.md`](civic-privacy-design.md) | Requisitos de privacidade, participação e localização. |
| [`civic-evidence-design.md`](civic-evidence-design.md) | Proveniência, evidências e limites de interpretação. |
| [`independent-review.md`](independent-review.md) | Revisão read-only do piloto de identidade/backup e limites dessa revisão. |
| [`tdd-auth.md`](tdd-auth.md), [`tdd-identity.md`](tdd-identity.md), [`tdd-ui.md`](tdd-ui.md), [`tdd-backup-review.md`](tdd-backup-review.md) | Evidências históricas de TDD e do piloto anterior de identidade. |
| [`validation-report.md`](validation-report.md) | Validação histórica do piloto de identidade; não descreve o estado do produto cívico atual. |
| [`archive/identity-plan.md`](archive/identity-plan.md), [`archive/identity-TODO.md`](archive/identity-TODO.md) | Planejamento antigo de conta/passkey, mantido apenas como arquivo histórico. |

## Código por área

- `client/src/civic/`: experiência cívica, descoberta, formulário de proposta, detalhes, fontes, analytics e grafo.
- `client/src/pages/`: páginas de acesso/conta legadas e casca/navegação do cliente.
- `shared/civic/`: contratos entre interface, API e domínio.
- `server/civic/domain/`: regras e validações independentes de infraestrutura.
- `server/civic/application/`: serviços e casos de uso.
- `server/civic/ports/`: contratos de persistência e dependências externas.
- `server/civic/adapters/`: PostgreSQL/Supabase para o runtime, MySQL isolado de testes legados, fontes oficiais e mídia.
- `server/civic/http/`: endpoints cívicos e configuração HTTP.
- `server/domain/`, `server/application/`, `server/adapters/`, `server/http/`: base do piloto anterior de identidade e segurança. Sua existência não significa que identidade faça parte do fluxo cívico ativo.
- `supabase/migrations/`: migration PostgreSQL do runtime; a versão `20261101163854` foi aplicada ao projeto Supabase `Civica` e verificada em 01/11/2026.
- `drizzle/`: migrações MySQL versionadas para os testes locais legados; `0002` inicia o esquema cívico, `0003` permite localidade opcional e `0004` adiciona timestamps de submissão de alegações.
- `worker.ts` e `wrangler.jsonc`: entrada Cloudflare Workers, assets Vite e binding Hyperdrive. O ID Hyperdrive permanece como placeholder; não houve deploy.
- `tests/` e arquivos `*.test.*`: regressões e verificações. Veja os scripts em `package.json`; não presuma que uma execução recente ocorreu só porque existe um teste.
- `scripts/`: gates de qualidade, testes isolados, migração cívica e ferramentas de operação local.

## Retomada segura

1. Leia `TODO.md`, `DECISIONS.md`, `README.md` e este índice.
2. Confira `git status --short` antes de editar: a cópia importada contém mudanças locais ainda não commitadas.
3. Para estado e limitações, confira o relatório mais recente em `civic-validation-report.md` e compare com os arquivos efetivos.
4. O runtime principal usa Postgres Supabase. A conexão do Worker exige Hyperdrive configurado no Cloudflare; não compartilhe a senha do banco em código, Git ou chat. O binding ID e o `CIVICA_ORIGIN` precisam corresponder ao ambiente antes de publicar.
5. Migrations MySQL e bancos `civica_test_*` ficam somente no harness local legado. Não execute `pnpm migrate:civic:mysql-test` contra uma base compartilhada.
6. Publicação, checkpoint e execução de testes completos são ações separadas; nesta cópia a migration Supabase foi aplicada, mas Worker/deploy ainda não existem.

