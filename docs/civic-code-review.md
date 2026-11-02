# Revisão independente do código cívico

**Data:** 27/10/2026. **Método:** inspeção somente de leitura do código e dos critérios aprovados. O revisor não editou arquivos, não executou navegador/E2E, não chamou fontes externas, não alterou serviços/configuração e não publicou. Os achados abaixo indicam lacunas do protótipo, não vulnerabilidades confirmadas em produção.

## Achados materiais

1. **Localidade do projeto é obrigatória, embora deva ser opcional — alta.** `client/src/civic/CivicApp.tsx`, `shared/civic/contracts.ts` e `server/civic/domain/validation.ts` exigem código, município, UF e área. Isso bloqueia sugestões sem local conhecido ou que não devam divulgar uma região. Modelar ausência/indeterminação explicitamente, sem coordenadas inventadas.

2. **Evidência opcional não participa da criação nem da revisão final — alta.** `CreateProposalInput` e o envio da proposta não incluem alegações/fontes; a etapa de mídia só mantém fotos localmente. Alegações são acrescentadas depois no detalhe. A confirmação antes de publicar, portanto, não revisa todo o conteúdo público. Incluir evidência opcional no rascunho e revisão, sem obrigar evidência.

3. **A escolha visual da sessão não é recuperada ao reabrir a proposta — média; acesso à retirada corrigido depois da revisão.** `VoteBox` começa sem escolha e não há consulta no contrato/repositório para recuperar apenas o estado da sessão atual. O bloqueio da retirada foi removido: o botão é agora sempre renderizado, com explicação de que a seleção anterior não é carregada, e usa a operação de retirada restrita à sessão. A regressão SSR passou, mas não houve novo teste de reload por navegador. A recuperação visual da escolha continua pendente; não criar enumeração pública.

4. **Código IBGE, município e UF podem ser incompatíveis — média/alta.** O servidor valida formatos, mas não a relação entre os três valores; entrada manual aceita texto livre e o serviço persiste o que foi enviado. Isso permite que uma localização contraditória contamine filtros/agregações. Validar contra catálogo quando disponível; caso contrário, marcar o local como não confirmado.

5. **Busca de relações não abrange o acervo todo — média.** `CivicService.related` consulta somente até 100 propostas recentes do mesmo tipo e município, e o algoritmo mantém o filtro de tipo. Uma proposta semelhante fora desse recorte pode ser reportada como não localizada. Ampliar com limites explícitos/paginação e deixar clara a limitação, sem bloquear propostas novas.

6. **Origem de participante está separada no backend, mas não está utilizável na interface e os rótulos misturam finalidades — alta.** Há persistência por token/proposta, mas não há contrato/chamada de cliente para autodeclaração. O agregado da tela de analytics chama “localização do projeto” registros que seriam origem de participante. Separar finalidade, consentimento, método e rótulos, publicando apenas agregados protegidos.

7. **Expiração da sessão não elimina os vínculos de voto/origem — média/alta.** Sessões expiram na leitura, mas votos mantêm `voter_scope_hash` e registros territoriais não têm retenção/limpeza definida. Votos antigos continuam nos totais sem janela documentada. Definir retenção/janela e limpeza demonstrável antes de alegar descarte do vínculo.

8. **Analytics e totais não carregam metadados suficientes — média/alta.** Contratos/read models e UI não exibem, para cada métrica, denominador, período/janela, exclusões e versão/método. Usuários não conseguem interpretar quem/qual intervalo compõe os números. Acrescentar esses metadados aos contratos e apresentá-los junto aos resultados.

9. **Proveniência do dossiê é incompleta — média/alta.** Campos de fonte são opcionais; publicador, identificador/trecho, jurisdição e data de consulta não são exigidos/exibidos, e não há fluxo de conferência/versionamento. Busca da Câmara é transitória e não vira alegação vinculada. Distinguir contribuição não conferida de fonte verificada e tornar proveniência reproduzível.

10. **Cobertura de fontes oficiais é muito menor que o escopo — média/alta.** Existem adaptadores IBGE e Câmara, mas não Senado, normas, jurisprudência ou custos. A busca por palavras-chave não deve ser tratada como dossiê completo. Implementar somente conectores oficialmente suportados, com status e limitações por fonte.

11. **A API de busca legislativa ainda perde o diagnóstico específico da fonte — média; estado vazio da UI corrigido depois da revisão.** `safeError` converte falhas `OfficialSourceError` em `service_unavailable`, perdendo o código específico antes da UI. Após a revisão, `LegislativeSources` foi atualizado para separar idle, carregamento, erro, vazio e resultados, com cinco testes unitários passando; erro e ausência já não são confundidos na apresentação. Ainda falta preservar na API o código seguro específico e manter a mensagem da fonte quando disponível.

12. **Tabela alternativa do grafo não mostra os valores usados na distância — média.** A tabela apresenta perfis e fontes, mas não os valores das dimensões/posições que sustentam a comparação. Sem isso, o grafo visual não tem alternativa realmente equivalente para conferir a métrica. Incluir dimensões e valores, escala/pesos e distância original.

13. **Filtro por estágio de proposta não existe — média.** Interface, API e modelo não têm campo/contrato para estágio, embora a navegação aprovada inclua esse filtro. Só adicionar estados com definições e proveniência; não equiparar `published` a estágio de política pública.

14. **Metadados base ainda descreviam o piloto de identidade — baixa, concreta.** O revisor identificou descrição e título desatualizados em `client/index.html`. Corrigidos no working tree; o build foi refeito e a home servida por HTTP confirmou o novo título. Não foi feita verificação por navegador; checkpoint ainda não confirmado.

## Limitações corretamente comunicadas

- Fotos ficam no navegador e não são enviadas; a API recusa upload sem revisão humana/remoção real.
- A home identifica o Preview como demonstração e informa ausência de moderação/denúncia comunitária.
- Votos são rotulados como experimentais por sessão, sem CPF, pessoa única ou representatividade.
- A página de locais oferece lista textual e não inventa marcadores; o grafo mantém estado vazio honesto quando não há dados.
- Alegações comunitárias são distinguidas de fonte consultada; correspondências da Câmara são marcadas para revisão humana.

## Evidência complementar após a revisão

Uma checagem HTTP (não browser/E2E) no Preview retornou `200` para `/api/health`, home e manifesto. `/api/civic/proposals` respondeu lista vazia; `/api/civic/analytics` retornou estrutura agregada; `/api/civic/graph` retornou zero nós. Isso demonstra um Preview conectado ao estado local vazio, não publicação pública nem dados de produção.

## Pontos sem evidência suficiente

A inspeção original não comprovou migração aplicada, fontes disponíveis, concorrência/replay operacional, conformidade WCAG, leitores de tela, retenção de backups, monitoramento ou publicação. A checagem HTTP posterior confirmou health e respostas da API no Preview, mas não torna válidos esses outros itens.
