# Cívica — contexto consolidado da conversa e estado da transferência

**Atualizado em:** 30/10/2026 (horário de Brasília)  
**Projeto:** Cívica — propostas, debate e acompanhamento público  
**Uso deste documento:** handoff de contexto e do estado de trabalho entre o Sandbox/cloud e o computador local. É um resumo organizado da conversa, não uma transcrição literal de cada mensagem.

> **Nota de importação — 01/11/2026:** As seções abaixo registram o snapshot da transferência em 30/10 e não devem ser tratadas como estado atual quando contradisserem os arquivos. A cópia atual está em `C:\Users\MaxPC\Documents\ChatGPT\Civica`; branch `main`, `HEAD` `809ef4a` (`origin/main`). Há alterações locais modificadas e arquivos novos não commitados. A migration `drizzle/0004_claim_submission_timestamps.sql`, os contratos/persistência correspondentes e o editor, validação e revisão de evidências em `client/src/civic/CivicApp.tsx` já estão presentes. Isso corrige a afirmação histórica da seção 7 de que a UI ainda faltava; não confirma execução da migration nem validação dessas mudanças nesta cópia. Não rodei testes durante a organização. Para o índice e precedência documental, consulte [`docs/README.md`](docs/README.md). A seção 10 descreve o estado da cópia no momento da transferência, não o caminho/estado local atual.

> **Continuação — 01/11/2026:** a suíte isolada passou com 190 testes; 3 testes que exigem SQL real foram pulados. Também passaram `pnpm check`, `pnpm lint`, build e `pnpm audit --audit-level=low`. O audit motivou o override reproduzível de `minimatch` para 11.0.1; auditoria seguinte não encontrou vulnerabilidades conhecidas. O runner de testes e o runner de quality foram ajustados para execução via shims Windows. A interface agora recupera a escolha da própria sessão por endpoint separado, testado para não retornar a escolha de outra sessão nem expô-la no detalhe público. O MariaDB não está instalado e o Docker daemon não está rodando nesta máquina; portanto SQL/browser, a migration 0004 e `pnpm quality` completo não foram executados. Não houve migração, checkpoint, push ou publicação. Ver o bloco “Atualização local” em `TODO.md` para o detalhe do fluxo de evidências e a ressalva sobre a asserção HTTP de payload grande removida por travamento do Supertest neste Windows.

> **Infraestrutura — 01/11/2026:** em resposta ao pedido para usar Supabase e Cloudflare, foi criado na organização Sympath o projeto Supabase `Civica` (`tizhiotltchqqyklavox`, região São Paulo) com custo cotado em US$ 0/mês. A migration Postgres `20261101163854_civica_postgres_schema` foi aplicada e a estrutura verificada: 11 tabelas vazias, schema privado, RLS ativo e roles públicas sem privilégios. O runtime Node usa PostgreSQL por padrão, com MySQL restrito a testes locais isolados; há também adaptador PostgreSQL e entrada Cloudflare Worker com SPA/Express/Hyperdrive. O bundle Workers passou em `wrangler deploy --dry-run`. Hyperdrive ainda não foi criado por exigir a senha Postgres, que deve ser definida diretamente nos painéis Supabase/Cloudflare; `wrangler.jsonc` mantém o ID placeholder. A conta tem `foxhole-coe-ops.workers.dev`; o hostname `civica.foxhole-coe-ops.workers.dev` está preparado, mas não publicado. Ver `docs/deployment-supabase-cloudflare.md`.

## 1. Pedido atual

O usuário solicitou mover o trabalho do ambiente cloud para o dispositivo local selecionado, trazer os arquivos do projeto e registrar em Markdown o contexto da conversa. O projeto deve continuar na pasta local `D:\Dev\ManusLocal\Cívica`, sem substituir silenciosamente arquivos locais preexistentes. O pacote contém o repositório completo e o estado ainda não concluído do working tree; dependências instaladas e artefatos de build são regeneráveis e foram deixados de fora.

## 2. Evolução do objetivo

1. A conversa começou com uma pergunta sobre acontecimentos nas eleições brasileiras. O usuário esclareceu que só queria saber se o assistente acompanhava o assunto; não pediu que eleições ou resultados fossem o tema do produto.
2. A primeira ideia de produto era um site de enquetes comunitárias, inicialmente com resiliência P2P. P2P foi retirado do escopo da primeira versão e fica como possibilidade futura, sem garantia de resistência a ataques ou derrubada.
3. Foi discutida autenticação de alta confiança por CPF, biometria facial e eventual gov.br. O usuário não tinha pessoa jurídica nem contratação para os verificadores; houve uma proposta de piloto pessoal baseado em documento assinado no gov.br e passkeys próprias do site.
4. O usuário depois corrigiu explicitamente o objetivo: **o produto não é um projeto de passkey/cadastro**. O foco é uma plataforma cívica para publicar ideias e problemas, relacionar propostas semelhantes, debater, participar e acompanhar projetos, obras e mudanças legislativas.
5. O usuário retirou contas e CPF do escopo atual: “não precisa pensar em contas no momento”; quando contas forem construídas, CPF e conexão autorizada com gov.br são requisitos futuros a serem reavaliados. O protótipo atual não coleta CPF, não pede login Manus, não usa gov.br nem reconhecimento facial.
6. Foi aprovado implementar a primeira versão como demonstração funcional com **sessão experimental sem CPF**. O produto deve começar sem pessoas, votos, obras, autoridades ou resultados fictícios. Conteúdo real inserido no Preview não deve ser confundido com pesquisa representativa, eleição oficial ou voz comprovada de toda a população.
7. Mais tarde, o usuário autorizou correções por fases e a execução de todos os testes após os blockers. A última instrução operacional foi transferir o projeto para local e documentar o contexto, não publicar o site.

## 3. Visão do produto solicitada

A Cívica deve permitir que pessoas de qualquer região, renda ou nível de familiaridade tecnológica possam sugerir problemas/ideias, encontrar propostas relacionadas, debater e votar com entendimento do efeito e da visibilidade de sua participação. A proposta pode tratar de obra, serviço público ou mudança legislativa. A localização do projeto deve ser opcional quando desconhecida ou quando a pessoa não quiser informá-la.

A visão desejada inclui páginas públicas de propostas e seus votos agregados, debate, endereços/fotos quando seguros, dados sobre a localização dos projetos, origem territorial voluntária dos participantes, autoridades e órgãos responsáveis, contatos institucionais, estimativas e gastos, prazos e atrasos demonstráveis, legislação relacionada e casos/julgados pertinentes. A plataforma deve procurar possíveis propostas relacionadas e explicar a correspondência, nunca fundi-las automaticamente nem afirmar que a ausência de resultado prova que nada existe.

O usuário também pediu um mapeamento de perfis políticos por projeto em três dimensões, sem eixo binário esquerda/direita: relações de proximidade entre posições como um grafo. O desenho aprovado restringe esse grafo a posições públicas documentadas de autoridades e, se houver proteção/volume suficientes, coortes voluntárias agregadas; não deve representar cidadãos individuais, inferir ideologia de CPF/votos/texto nem inventar posições. A distância deve ter método, fontes e alternativa textual explicável.

Para apoiar crianças, idosos, pessoas cegas ou com baixa alfabetização, a criação precisa usar linguagem simples, perguntas neutras que organizem a intenção original, possibilidade de voltar sem perder o texto e confirmação antes de publicar. O fluxo não deve depender de IA, áudio, mapa, mouse ou visão. Crianças não devem ser identificadas no piloto; participação, pesquisa ou mídia infantil exige salvaguardas específicas.

## 4. Decisões e salvaguardas vigentes

- **Sem CPF, conta civil ou biometria nesta versão.** Sessões são experimentais e não provam unicidade de pessoas. Não chamar resultados de “uma pessoa, um voto”.
- **Sem P2P por enquanto.** O protótipo usa servidor centralizado; não prometer disponibilidade ou resistência a DDoS.
- **Sem dados semeados para demonstração.** Fixtures são restritos a testes locais isolados. O Preview pode estar vazio.
- **Conteúdo é público no protótipo quando submetido ao fluxo de publicação; explicar a visibilidade antes do envio.** Abertura comunitária ampla continua bloqueada sem moderação, denúncia/retirada, política de dados e avaliação manual de acessibilidade.
- **Separar local do projeto da residência/origem do participante.** Não inferir origem por GPS, IP, EXIF ou voto. Município/UF do participante é uma resposta voluntária, se implementada; pode-se participar sem responder.
- **Privacidade de votos.** Exibir agregados, nunca uma lista cidadão–escolha. IDs de sessão são opacos e derivados por finalidade; localização de projeto não deve ser rotulada como origem do eleitor.
- **Analytics.** Usar limiar/supressão de grupos pequenos e explicar denominador, janela, método, cobertura e exclusões. Isso reduz risco; não é prova de anonimato.
- **Grafo.** Ausência de dado não significa oposição, neutralidade nem distância zero. Coortes não comparáveis devem ser omitidas com explicação; nunca completar o grafo com perfis fictícios.
- **Fotos.** A interface oferece seleção/preview local, mas o upload é recusado pelo servidor enquanto não houver moderação e capacidade real de retirada/exclusão. Não tratar a foto local como publicada.
- **Fontes.** Uma URL ou resultado de busca não equivale a verificação. Distinguir relatos comunitários, hipóteses, estimativas, projeções, lacunas e fontes conferidas; registrar proveniência.
- **Fontes externas ao vivo.** O catálogo do IBGE e buscas legislativas oficiais têm integração parcial; disponibilidade ao vivo do IBGE não foi confirmada no ensaio anterior. O fallback manual deve continuar disponível. Uma busca limitada da Câmara não dá cobertura legislativa nacional ou um dossiê completo. Não há conectores completos de Senado, jurisprudência, custos, contatos municipais ou execução de obras.
- **Publicação.** Nenhum pedido nesta fase autoriza publicação pública. Os gates e o guard de pre-push não devem ser contornados. A configuração registrada estava com publicação automática desativada; confirmar novamente no ambiente local antes de qualquer operação de publicação.

## 5. Arquitetura e organização

O projeto usa React/TypeScript/Vite no cliente, Express/Node no servidor, MySQL e migrations explícitas. O desenho segue Onion: `domain` e `application` não devem depender de Express, MySQL, mapas, fontes externas ou modelos; essas dependências entram por `ports` e `adapters`.

Áreas principais presentes no repositório:

- `shared/civic/`: contratos compartilhados entre cliente, servidor e API.
- `server/civic/domain/`: validação, privacidade, propostas relacionadas, analytics e distâncias do grafo.
- `server/civic/application/`: casos de uso de propostas, votos, debate, claims/dossiês e agregados.
- `server/civic/ports/`: interfaces para persistência e serviços.
- `server/civic/adapters/`: MySQL, fontes oficiais e processamento de mídia.
- `server/civic/http/`: API com sessão experimental, validação, cookies, origem/CSRF e limites.
- `client/src/civic/`: páginas e componentes de exploração, proposta, mapa, analytics, metodologia, privacidade e acessibilidade.
- `drizzle/`: schema/migrações aditivas versionadas.
- `tests/`, `scripts/`, `docs/`: testes isolados, ferramentas, planos, evidências e relatórios.

As páginas declaradas no manifesto incluem home, propostas, sugestão, detalhe/debate, mapa, dados, conexões/grafo, metodologia, privacidade e acessibilidade. O route manifest não é o roteador; ambos precisam permanecer sincronizados.

O piloto anterior de identidade permanece arquivado/documentado e o código legado não deve voltar à navegação ou às rotas cívicas sem uma decisão explícita. Contas futuras não devem se misturar aos dados de participação.

## 6. O que já existe — com limites

- Shell público em português, rotas cívicas e explicação de que a participação é experimental.
- Sessão opaca com cookie, controles de origem/CSRF, limites de mutação e operações protegidas por escopo de sessão.
- Tipos de propostas para obras/serviços e mudanças legislativas, criação guiada, descoberta por texto, páginas de detalhe/debate e votos experimentais (apoio, oposição, precisa de informação), incluindo retirada. A seleção visual do voto não é recuperada ao reabrir a proposta; não foi adicionada enumeração de voto individual.
- Localidade do projeto é opcional e pode ser autodeclarada manualmente sem código IBGE; a ausência não deve inventar uma região. O seletor tenta usar catálogo oficial e precisa permitir fallback manual.
- Busca de propostas relacionadas é limitada pelo acervo/recorte atual; não afirmar que cobre o Brasil ou encontra todas as equivalências.
- Há módulos de contagem territorial, analytics e grafo, mas o Preview foi observado com zero propostas e zero nós. Não há dados suficientes para demonstrar análises reais; o estado vazio precisa permanecer honesto.
- A interface tem um componente de grafo 3D com projeção, controles e alternativa textual, mas ainda faltam metadados/dimensões suficientes na tabela alternativa e dados comparáveis reais.
- Há adaptadores de localidade IBGE e descoberta legislativa da Câmara; endpoints ao vivo não foram confirmados de forma estável no teste anterior. Os resultados exigem revisão humana e podem ser limitados.
- Fotos ficam no navegador e não são enviadas, pois não há fluxo completo de moderação/retirada.
- O assistente de sugestão deve funcionar sem IA. Não há entrevista automatizada por IA ativa; o módulo de assistência não deve mandar texto político a uma API sem consentimento, política e custos explícitos.

## 7. Trabalho mais recente em andamento: alegações/evidências iniciais

A remediação por fases está em andamento. A última fase pretende permitir que uma pessoa acrescente, opcionalmente, até cinco itens de evidência no próprio rascunho e os confira na revisão final. Cada item precisa continuar rotulado como enviado pela comunidade, não como fato conferido. Para “fato documentado”, a interface exige título e URL HTTPS; a plataforma não declara que leu/verificou automaticamente a fonte.

No working tree já foram iniciadas alterações em `shared/civic/contracts.ts`, `server/civic/domain/validation.ts`, `server/civic/application/service.ts`, `server/civic/http/app.ts`, `server/civic/http/app.test.ts`, `server/civic/domain/initial-claims.test.ts` e em arquivos do adaptador MySQL. Foi acrescentada a migration aditiva `drizzle/0004_claim_submission_timestamps.sql` e o migrador lista a versão 0004. O objetivo é separar `submittedAt` de `checkedAt`, persistir proposta e claims iniciais atomicamente e deixar `checked_at` nulo para submissões não conferidas.

**Esta fase não está concluída nem validada.** A interface ainda precisa do editor/preview/revisão de claims. A migration 0004 não foi executada. O último resultado do agente de interface para essa fase foi falha; não inferir que a UI foi implementada. Depois das últimas alterações de integração não foi executado o conjunto completo de testes, lint, typecheck, build ou gate completo. Antes de marcar a fase como pronta: revisar os diffs, fechar tipos e comportamento, escrever/ajustar regressões, rodar testes direcionados, executar migrations somente numa base MariaDB local isolada e depois rodar o gate autorizado.

## 8. Revisão independente e pendências técnicas conhecidas

`docs/civic-code-review.md` contém a revisão read-only e evidências. O parecer anterior marcou 14 lacunas, não vulnerabilidades confirmadas em produção. Entre as pendências mais relevantes:

1. Evidências opcionais não estavam integradas ao fluxo de criação/revisão (a fase atual tenta corrigir isso).
2. O estado de voto não é recuperado na interface ao reabrir, embora a retirada esteja acessível e restrita à sessão.
3. Código IBGE, município e UF podem ser inconsistentes quando há entrada manual; precisa haver rótulo de não confirmado ou validação coerente.
4. Busca de propostas relacionadas tem recorte/limite; explicar o que foi pesquisado e preservar rascunho/decisão de continuar.
5. Origem territorial voluntária do participante ainda não está plenamente utilizável na interface e deve permanecer distinta da localização do projeto.
6. Retenção/expiração de vínculos de voto e localização não tem política completa; não apagar nem definir uma janela arbitrária sem decisão.
7. Métricas precisam de denominador, período, método, exclusões e cobertura; proteger reconstrução por filtros e células pequenas.
8. Proveniência de alegações, revisão humana e versionamento ainda são incompletos.
9. Cobertura das fontes oficiais é limitada; não há dossiê completo de legislação, precedentes, custos ou contatos locais.
10. Falhas de fontes precisam preservar diagnóstico seguro na API; erro não pode virar “nenhum resultado”.
11. A tabela alternativa do grafo precisa expor as variáveis, escala/pesos e distância usadas.
12. Filtro por estágio factual de política pública ainda falta; `published` não significa etapa de obra ou legislação.
13. Metadados antigos de identidade foram corrigidos no HTML.
14. O browser/axe já teve bloqueios anteriores; a verificação automatizada é triagem, não certificação ou avaliação manual com leitores de tela/pessoas.

Além disso, permanecem requisitos de produto ainda não concluídos: moderação/denúncia/retirada, política de privacidade/retensão, fontes específicas por proposta, fotos públicas seguras, acessibilidade manual e revisão de segurança antes de abertura ampla.

## 9. Histórico de testes, Preview e publicação

Os registros completos estão em `docs/civic-validation-report.md`, `docs/civic-code-review.md` e nos relatórios de desenho. Em resumo:

- Em 27/10 houve passagens registradas de TypeScript, lint, build, testes unitários/SSR e SQL local para as partes então cobertas.
- Três execuções completas do `pnpm quality` em 28/10 terminaram sem gate verde. A primeira parou no teste de streaming (assertiva de contagem de `pull`); a segunda passou testes, SQL local e build, mas parou numa expectativa textual do browser; a terceira passou essas etapas e triagem axe nas telas visitadas, mas parou porque havia dois `role=alert` na home e o seletor era ambíguo. A migration/integração ao vivo e o relatório documentam melhor esses eventos.
- Em seguida o usuário autorizou uma campanha de correções por fases. Houve correções direcionadas à home, validação/âncoras do formulário, estado de busca legislativa e região opcional. A última fase de claims ainda não foi validada.
- A medição anterior do IBGE falhou por erro de conexão antes de resposta; o fallback manual foi mantido. O limite de payload dos conectores permanece 4 MiB.
- O Preview anterior respondeu health e APIs em testes HTTP com base local vazia; isso não equivale a publicação pública.
- `pnpm quality` executa checks, testes isolados, teste SQL local, build, Playwright/axe e auditoria. O guard pre-push chama esse gate. Não alterar o hook nem fazer bypass para salvar checkpoint.
- **Não existe URL pública confirmada.** Nenhuma publicação foi feita. `auto_publish` foi consultado anteriormente e estava desligado; confirmar estado antes de nova alteração de configuração.

## 10. Estado do repositório no pacote

Na inspeção imediatamente antes da transferência:

- Diretório cloud: `/home/ubuntu/civica`.
- Branch: `main`.
- HEAD: `809ef4a` (checkpoint anterior de identidade); as mudanças cívicas atuais estão no working tree, ainda não salvas em novo checkpoint.
- Há arquivos modificados e arquivos novos, inclusive UI, API, relatórios, migrations e testes; todos são incluídos no pacote.
- Nenhum `.env`, arquivo de banco (`.db`, `.sqlite`, `.dump`) ou arquivo com nome de secret/credential foi encontrado dentro do projeto na varredura feita. Não foram incluídas variáveis de ambiente, DSN de teste em `/tmp`, banco local MariaDB nem credenciais do host.
- `node_modules` (cerca de 689 MB) e `dist` (build regenerável) são excluídos do ZIP. Instalar pelo lockfile e compilar no destino. O `.git` (cerca de 2,1 MB) é incluído, preservando histórico/branch e os arquivos de hook presentes; nenhum push é efetuado por esta transferência.

## 11. Como retomar no computador local

1. A cópia importada desta conversa está em `C:\Users\MaxPC\Documents\ChatGPT\Civica`. Confira `.git` e `git status --short` antes de editar ou salvar alterações; não presuma que o caminho antigo `D:\Dev\ManusLocal\Cívica` ainda se aplica.
2. Instalar dependências reproduzíveis: `pnpm install --frozen-lockfile` (Node compatível com a versão do projeto, Node 22).
3. Ler primeiro `TODO.md`, este documento, `plan.md`, `DECISIONS.md` e `docs/civic-code-review.md`.
4. Revisar a fase de claims incompleta. Rodar primeiro `pnpm check`, `pnpm lint` e testes unitários direcionados. Um resultado de uma fase não prova que o sistema inteiro passou.
5. Para SQL, usar somente base local com nome `civica_test_*` ou `civica_preview_*`. O migrador bloqueia bancos compartilhados por padrão. Não rodar migração na base gerenciada nem apagar dados.
6. Depois da integração, executar `pnpm quality` (inclui Playwright/axe e auditoria). Corrigir bloqueios com os limites e autorizações vigentes; não enfraquecer seletores nem remover testes para forçar verde.
7. Não publicar. Para novo checkpoint, obedecer ao hook pre-push e confirmar que a configuração de auto-publicação continua desligada. URL pública exige pedido/consentimento específico.

## 12. Preferências relevantes do usuário

Responder em português brasileiro, com linguagem direta e precisa. O usuário prefere que tarefas complexas sejam organizadas em fases e que fatos, hipóteses, decisões e recomendações fiquem separados. Não presumir que uma tela bonita prova segurança, cobertura ou acessibilidade. Não criar registros, votos, perfis ou fontes fictícios. Executar trabalho de baixo impacto dentro da autorização, mas pedir confirmação para publicação pública, gastos, exclusões irreversíveis ou mudanças amplas de acesso. Preservar a portabilidade entre serviços e não pedir segredos no chat.
