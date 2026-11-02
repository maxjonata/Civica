# Supabase e Cloudflare

## Estado em 01/11/2026

- Projeto Supabase `Civica`, ref `tizhiotltchqqyklavox`, organização `Sympath`, região `sa-east-1`; criado após cotação de US$ 0/mês.
- Migration `20261101163854_civica_postgres_schema` aplicada pelo conector Supabase e verificada: 11 tabelas em `civica`, sem dados, RLS habilitado, roles públicas sem privilégios.
- Projeto Worker ainda não publicado. A conta Cloudflare tem o subdomínio `foxhole-coe-ops.workers.dev`; a origem configurada para o futuro Worker é `https://civica.foxhole-coe-ops.workers.dev`.
- `wrangler.jsonc` contém `HYPERDRIVE` com ID substituto até existir uma configuração Hyperdrive para o Postgres Supabase.
- Uma consulta de verificação confirmou que `anon` não tem `USAGE` no schema nem leitura da tabela de propostas; a contagem de propostas é zero. A análise Postgres também aceitou a expressão `ILIKE ... ESCAPE` usada pelo adaptador.

## Últimos passos de conexão

1. No painel Supabase do projeto `Civica`, defina uma senha forte para o usuário Postgres e use a tela **Connect** para copiar a connection string Postgres em modo session.
2. No Cloudflare, crie uma configuração Hyperdrive chamada `civica-postgres` com essa connection string. A senha fica somente na configuração gerenciada do Hyperdrive; não a coloque em arquivo, terminal compartilhado ou chat.
3. Copie o ID da configuração Hyperdrive para `hyperdrive[0].id` em `wrangler.jsonc` e rode `pnpm cf:typegen`.
4. Valide o bundle local com `pnpm cf:dry-run`. Para abrir localmente, configure um `DATABASE_URL` Postgres local em `.env` e use `pnpm dev`; o servidor local também pode conectar ao Supabase com uma connection string mantida só no `.env`.
5. `pnpm cf:deploy` cria uma versão pública em `workers.dev`. Não foi executado nesta etapa. Antes de executá-lo, confirme que origin, connection e todas as variáveis estão corretas e reveja se o estado do produto pode ficar acessível publicamente.

O browser E2E existente ainda usa MariaDB isolado local. O novo adaptador Postgres tem testes unitários, mas não foi exercitado contra a base remota; o schema remoto foi inspecionado e confirmado sem dados de aplicação.
