# Ambiente, segredos e recuperação do Cívica

Este documento registra onde ficam os arquivos e dados necessários para reconstruir o ambiente depois de formatar ou trocar de computador. Os valores secretos ficam fora do repositório.

## Onde guardar cada coisa

| Item | Onde fica | Vai para GitHub? |
| --- | --- | --- |
| Código, migrations, `wrangler.jsonc`, `.env.example` e instruções | Repositório `maxjonata/Civica` | Sim |
| Configuração local do Node e `DATABASE_URL` | Arquivo local `.env`, criado a partir de `.env.example` | Não |
| Senha do usuário Postgres e connection string de recuperação | Gerenciador de senhas, na entrada “Cívica — Supabase” | Não |
| Connection string usada pelo Worker em produção | Configuração Hyperdrive no painel Cloudflare | Não; somente o ID Hyperdrive vai em `wrangler.jsonc` |
| Login Cloudflare, Supabase e GitHub, códigos de recuperação e MFA | Gerenciador de senhas e armazenamento seguro dos códigos de recuperação | Não |
| Schema do banco | `supabase/migrations/` | Sim |
| Dados do banco | Projeto Supabase remoto e backups próprios quando houver dados importantes | Não |

O repositório é público. Nunca adicione `.env`, `.dev.vars`, senhas, connection strings, tokens de API ou códigos de recuperação ao Git, mesmo em uma branch privada. O `.gitignore` bloqueia esses arquivos; `.env.example` contém apenas nomes e valores vazios.

## Configuração que já pode ser reconstruída

- Projeto Supabase: `Civica`, ref `tizhiotltchqqyklavox`, organização `Sympath`.
- Migração inicial: `supabase/migrations/20261101163854_civica_postgres_schema.sql`.
- Worker Cloudflare: nome `civica`, configuração versionada em `wrangler.jsonc`.
- `wrangler.jsonc` ainda tem `REPLACE_WITH_HYPERDRIVE_ID`. O Worker não está implantado; falta criar Hyperdrive e substituir esse marcador pelo ID não secreto.
- O Worker usa o binding `HYPERDRIVE`; a senha do banco deve ficar na connection string gerenciada pelo Hyperdrive.

Não é necessário criar chaves `service_role` ou `anon` do Supabase para o runtime atual: o servidor usa Postgres diretamente. Não crie nem exponha essas chaves por conveniência.

## Preparar este computador

1. Instale Git, Node.js 22 e pnpm `10.34.5`.
2. Clone `https://github.com/maxjonata/Civica.git` e execute `pnpm install --frozen-lockfile`.
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL` somente se for usar o servidor Node local. Recupere o valor do gerenciador de senhas ou redefina a senha do banco no painel Supabase e atualize a entrada segura.
4. Para trabalhar com o Supabase CLI, autentique-se novamente e vincule o projeto com `supabase link --project-ref tizhiotltchqqyklavox`.
5. Para Cloudflare, autentique o Wrangler com `pnpm exec wrangler login`. Quando Hyperdrive for criado, atualize seu ID em `wrangler.jsonc`; a connection string fica no recurso Hyperdrive, não no arquivo local nem no Git.

O `.env.example` cobre a configuração básica do servidor local. As variáveis `MANUS_API_URL` e `MANUS_API_BROWSER_KEY` são opcionais para a integração externa de mapas/fontes; deixe-as vazias se esse recurso não for usado.

## Chaves do piloto legado

Os comandos do piloto legado de identidade podem usar `CIVICA_DOCUMENT_KEY`, `CIVICA_CPF_KEY` e `CIVICA_BACKUP_KEY`. Elas não são necessárias para as rotas cívicas atuais. Se você tiver criado dados cifrados ou exportações com esses comandos, guarde cada chave na entrada segura “Cívica — piloto legado”, separada dos arquivos de backup. Sem as chaves originais, os dados cifrados não poderão ser recuperados. Não gere valores substitutos para tentar abrir backups existentes.

## Depois de qualquer mudança

Atualize este inventário quando criar Hyperdrive, mudar o projeto ou adicionar uma nova variável. Registre apenas nomes de variáveis, nomes dos recursos e IDs não secretos; mantenha valores secretos no gerenciador de senhas e nos serviços que os consomem.
