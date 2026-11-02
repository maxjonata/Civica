# Cívica — validação do protótipo cívico

**Data:** 27/10/2026. **Estado:** protótipo em desenvolvimento no Preview; não publicado publicamente. Este relatório complementa o relatório histórico de identidade em `docs/validation-report.md`; não substitui nem reinterpreta seus resultados.

## Verificações recentes

| Verificação | Resultado observado |
|---|---|
| TypeScript (`pnpm check`) | Passou em 27/10, após as alterações de estados de erro, fallback textual e apresentação do grafo. |
| ESLint (`pnpm lint`) | Passou na mesma execução. |
| Build (`pnpm build`) | Passou; Vite e entrypoints Node foram produzidos. |
| Renderização SSR cívica | 3 testes passaram com `node scripts/test-isolated.mjs client/src/civic/civic-red.test.tsx`. |
| Playwright/axe — telas e fallback | O log reportou zero violações nos tags WCAG selecionados nas telas de início, localidade manual, formulário, detalhe/debate, propostas, mapa, dados, conexões, metodologia, privacidade e acessibilidade. Isto é triagem automatizada; não é certificação WCAG nem prova de uso com NVDA/VoiceOver ou pessoas. |
| Playwright — fluxo completo | **Não passou até o fim.** Depois da checagem das páginas, a asserção da página inicial esperava um único `role=alert`, mas encontrou dois. Uma única tentativa de ajuste do seletor ainda encontrou dois elementos e terminou em erro estrito. O usuário determinou registrar a pendência e não repetir o teste nesta etapa. Portanto não se declara o smoke E2E concluído, embora as etapas anteriores à falha tenham produzido os resultados acima. |
| Testes de fonte/streaming | Mantém-se pendente uma asserção de uma suíte de 13 testes relacionada à contagem exata de chamadas `pull`. O limite de payload permanece 4 MiB. Não houve nova tentativa de correção. |
| Fontes oficiais ao vivo | A integração manual de localidade permanece disponível como fallback. A disponibilidade real do endpoint IBGE não foi confirmada no ensaio anterior; detalhe e medição estão em `docs/civic-implementation-sources.md`. A busca medida na Câmara não equivale a cobertura nacional/completa. |

## Pendências explícitas da interface

1. A validação visual da etapa de localidade aponta a mensagem do código municipal para uma âncora que não está pareada corretamente com o campo.
2. O acionamento da busca de propostas relacionadas pode sobrescrever erros de validação de etapas diferentes.
3. O smoke browser precisa de um teste focado que diferencie os dois alertas na home; não repetir até nova autorização, conforme decisão atual.
4. Completar validadores e fluxos de API externos sem transformar indisponibilidade em uma lista vazia. A falha ao vivo do IBGE não prova que o serviço não tenha dados.

Os três primeiros pontos foram registrados no TODO. Os dois problemas de formulário não foram alterados após uma tentativa direta sem aplicação; o usuário escolheu deixá-los como pendências e continuar. O smoke browser não foi repetido após a última falha.

## Limites

Axe/Playwright não certificam acessibilidade total. Não foi feita avaliação manual com leitores de tela ou participantes. A publicação pública, a abertura comunitária sem moderação e uma alegação de representatividade permanecem fora do que esta evidência permite afirmar. Este relatório não prova auditoria especializada, CI remota, monitoramento contínuo, backup externo ou disponibilidade de todas as integrações.


## Atualização após a revisão independente — 28/10/2026

- Uma revisão independente somente de leitura encontrou 14 lacunas materiais ou concretas. O parecer detalhado, evidências por módulo e direções de correção estão em `docs/civic-code-review.md`; permanecem abertas no TODO. Só foram corrigidos nesta etapa o estado vazio da busca legislativa e os metadados HTML, além das alterações de carregamento/erro registradas acima.
- Depois desses ajustes, passaram `pnpm check`, `pnpm lint`, `pnpm build` e oito testes unitários/SSR direcionados, incluindo os cinco estados da busca legislativa. O ciclo RED/GREEN da nova máquina de estados foi registrado nos testes; o GREEN passou.
- A checagem HTTP do Preview retornou `200` para health, home, manifesto e APIs. Foram comparadas as dez rotas do manifesto com a função `routePage`; a lista pública retornou zero propostas e o grafo, zero nós. Isso confirma estado vazio no Preview local, não dados públicos ou produção.
- O usuário determinou não repetir o teste Playwright/browser após a asserção de dois alertas na home. Nenhum browser foi iniciado nesta atualização; o E2E completo continua pendente. O erro específico da API da Câmara, as integrações do IBGE e demais lacunas da revisão seguem no TODO.
- Nenhum checkpoint canônico ou publicação pública foi realizado nesta atualização.


## Continuação — retirada de voto acessível

A caixa de voto agora renderiza “Retirar minha escolha” independentemente de haver uma escolha na memória da tela. A mensagem explica que a seleção anterior não é recuperada; se houver voto dessa sessão, o endpoint existente faz a retirada pelo resumo de escopo da sessão/proposta. A alteração não cria endpoint público de leitura de escolhas nem promete recuperar o voto na UI.

O teste SSR reproduziu em RED a ausência do botão; a correção passou em GREEN. A execução direcionada final passou 17 testes (cinco de estados legislativos, quatro SSR/cliente e oito HTTP), além de TypeScript, lint e build. Isso não é prova de reload por navegador ou de cerimônia de votação completa. O browser continua sem nova execução.

O checkpoint não foi enviado: o guard pre-push chama `pnpm quality`, que executaria o browser suspenso. A proteção não foi contornada. `GET config` confirmou publicação automática desativada. Código e documentação permanecem no working tree do projeto; não há checkpoint canônico novo nem publicação pública confirmados.


## Gate completo autorizado — 28/10/2026

Foi executada uma vez a autorização do usuário para `pnpm quality`. TypeScript e ESLint passaram; a etapa `TDD isolated suite` falhou antes das etapas SQL, build, Playwright/axe ou auditoria. Resultado agregado do Vitest: 30 arquivos aprovados, um arquivo com falha, um arquivo pulado; 161 testes passaram, um falhou e três foram pulados.

Falha única: `server/civic/adapters/official-sources.test.ts`, teste “stops and cancels a streaming body as soon as it exceeds the payload limit”. O teste esperava exatamente `pulls === 1`, mas observou `2`; no mesmo teste, abort, cancelamento e rejeição por corpo acima do limite foram confirmados. O limite de 4 MiB permanece. Nenhuma segunda tentativa de correção ou execução foi feita.

Como o gate parou antes das etapas seguintes, esta execução **não** revalidou os testes SQL, build, browser/axe nem auditoria. O browser não foi executado nesta tentativa. O hook pre-push executa o gate completo, então não foi feito push/checkpoint e não há URL pública. Publicação automática está desligada; nada foi publicado.


## Segunda execução autorizada do gate — 28/10/2026

O teste focado após adicionar `highWaterMark: 0` passou: 13/13 testes do adaptador, mantendo `MAX_PAYLOAD_BYTES` em 4 MiB e as verificações de aborto/cancelamento. A segunda execução de `pnpm quality` passou TypeScript, lint, 31 arquivos de testes isolados (162 passaram, 3 foram pulados), 3 testes SQL somente em bases locais e build.

O Playwright/axe começou, reportou zero violações nos tags selecionados em início, fallback manual, formulário e detalhe/debate, mas interrompeu o fluxo ao esperar o texto antigo `Escolha retirada desta sessão experimental.`. A interface havia sido corrigida para uma mensagem mais precisa que cobre tanto presença quanto ausência de voto removido: “Retirada concluída para esta sessão experimental. Se havia uma escolha, ela foi removida.” O próximo passo seria alinhar expectativa/copy; por instrução, não houve tentativa de correção ou nova execução. A auditoria de dependências não foi alcançada.

A execução não completou `pnpm quality`; portanto o pre-push continua bloqueado. Nenhum checkpoint, push ou publicação pública foi realizado. Não existe ainda URL pública para compartilhar.


## Terceira execução autorizada do gate — 28/10/2026

A alteração exclusiva da expectativa de retirada passou a etapa anterior. A terceira execução de `pnpm quality` passou TypeScript, ESLint, 31 arquivos de teste (162 passaram, 3 foram ignorados), três testes SQL locais e build. Playwright/axe não encontrou violações nos tags selecionados em início, fallback manual, formulário, detalhe/debate e nas páginas `/propostas`, `/mapa`, `/dados`, `/conexoes`, `/metodologia`, `/privacidade` e `/acessibilidade`.

O fluxo E2E parou depois, no estado de erro recuperável da home: `main .civic-home [role=alert]` resolveu dois alertas, ambos com a mesma mensagem de falha; um deles inclui o botão “Tentar novamente”. O seletor estrito lançou erro de ambiguidade. Não se investigou qual camada produz cada alerta, não foi feita nova correção nem repetição. A auditoria de dependências não foi alcançada.

Com o gate ainda não verde, o guard pre-push permanece impeditivo. Nenhum push/checkpoint ou publicação pública foi realizado; não há URL pública. É necessária nova autorização para investigar o alerta duplicado e tentar outro ciclo.
