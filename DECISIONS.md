

## Continuação do protótipo cívico — 27/10/2026

O plano cívico foi aprovado pelo usuário; a sessão experimental sem CPF está no escopo atual, enquanto contas e integração gov.br ficam para o futuro. O produto atual é um protótipo para visualizar e testar a ideia, não um sistema público pronto. Não semear entidades ou votos fictícios na base gerenciada.

Por orientação explícita do usuário, manter o limite de payload em 4 MiB, adiar a correção da asserção de streaming que exige uma contagem exata de `pull`, usar fallback manual quando a fonte ao vivo falhar e registrar integrações não validadas como pendência. Cada falha permite uma tentativa de correção; o smoke browser falhou de novo ao encontrar dois alertas na home. O usuário pediu que essa pendência seja registrada e que o teste não seja repetido nesta etapa.

Também ficam no TODO dois defeitos da validação do formulário: âncora incorreta/inexistente para o erro do código municipal e possível sobrescrita de erros de etapas diferentes ao procurar propostas relacionadas. Nenhuma correção desses dois itens foi aplicada.


## Estado de continuação — 28/10/2026

O guard local pre-push executa o pipeline completo, incluindo o teste de browser que o usuário suspendeu. Não foi executado push nem contornado o hook. A configuração de publicação automática foi consultada e está desativada (`auto_publish: false`). Salvar checkpoint permanece pendente, separado de qualquer publicação.

A caixa de voto passou a oferecer retirada independentemente da escolha em memória, aproveitando a remoção já restrita à sessão/proposta. A interface explica que a escolha anterior não é recuperada; nenhuma leitura pública de voto individual foi adicionada. Dezessete testes direcionados, tipagem, lint e build passaram, sem repetir browser.


## Gate de publicação — 28/10/2026

O usuário autorizou uma execução do gate completo para viabilizar o checkpoint. TypeScript e lint passaram; a suíte unitária parou em uma asserção de streaming (`pulls` esperado 1, observado 2) enquanto abort/cancelamento e o limite de 4 MiB foram confirmados. Conforme a instrução de limitar tentativas, não houve correção nem nova execução. As etapas SQL, build, browser e auditoria do gate não rodaram. O hook pre-push não foi contornado; sem checkpoint não há URL pública e nenhuma publicação foi feita.


## Resultado da segunda execução do gate — 28/10/2026

Os testes unitários, SQL locais, tipagem, lint e build passaram. Playwright/axe parou porque uma asserção ainda esperava a frase antiga de retirada. A mensagem da UI foi alterada de propósito para não afirmar que havia um voto se não havia; não ajustei o teste após a falha nem repeti o gate. A auditoria de dependências não foi executada nessa tentativa. Gate não verde: sem push/checkpoint ou URL pública. Pedir nova autorização antes de corrigir/rodar novamente.


## Terceira execução autorizada do gate — 28/10/2026

A expectativa de retirada foi atualizada conforme autorizado. Testes unitários, SQL locais, TypeScript, lint e build passaram; axe passou nas páginas exercitadas. O Playwright parou no estado de erro da home porque o seletor estrito encontrou dois `role=alert` com a mesma falha. Não houve outra correção ou repetição. A auditoria não rodou. Sem gate verde, o hook impede checkpoint; nenhuma URL pública foi criada. Consultar o usuário antes de qualquer nova investigação/reexecução.


## Nova autorização de correção por fases — 28/10/2026

O usuário autorizou corrigir progressivamente as lacunas encontradas e executar todos os testes, incluindo novas correções do browser. Isso supersede a orientação anterior de não repetir neste escopo. Manter o limite de payload em 4 MiB, bases de teste locais, sem bypass do hook e sem publicação automática. A publicação pública continua separada e exige confirmação; a versão interativa ainda tem lacunas de moderação e privacidade documentadas.


## Infraestrutura Supabase + Cloudflare — 01/11/2026

Por pedido explícito do usuário, o runtime principal migra para PostgreSQL Supabase e Cloudflare Workers com Hyperdrive. Foi criado o projeto Supabase `Civica` em `sa-east-1` após consulta confirmar custo de US$ 0/mês. O schema remoto fica no namespace privado `civica`, com RLS ativo e sem acesso das roles `anon`/`authenticated`; não foram copiados dados. MySQL permanece apenas para os testes locais legados e fica restrito pelo servidor a `CIVICA_TEST_MODE=1` com DSN `civica_test_*` local. A configuração/deploy público do Worker permanece pendente da criação Hyperdrive com a senha configurada diretamente nos painéis dos provedores; segredos não devem ser enviados pelo chat. Não considerar essa mudança um lançamento público.
