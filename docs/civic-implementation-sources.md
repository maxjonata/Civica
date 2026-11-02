# Fontes verificadas para implementação cívica

Consulta em 27/10/2026; este arquivo registra endpoints e limites de integração, não prova cobertura total nem valida cada dado futuramente retornado.

## Câmara dos Deputados

API oficial de proposições: <https://dadosabertos.camara.leg.br/api/v2/proposicoes>. Busca por palavras usa `keywords`, `itens`, `ordem` e `ordenarPor`; integração de descoberta proposta limita `itens` a 8, ordenação decrescente por ID, fixa o hostname, valida o campo `uri` e marca toda correspondência como `keyword_match_requires_human_review`. Uma correspondência lexical não demonstra relação jurídica/material.

Em 27/10/2026, uma consulta pública com `keywords=mobilidade urbana&itens=2&ordem=DESC&ordenarPor=id` retornou HTTP 200 e JSON com o envelope `dados[]` e registros `id`, `uri`, `siglaTipo`, `numero`, `ano`, `ementa` e `dataApresentacao`. Os dois itens observados pareciam proposições correntes; isso não foi tratado como resultado completo nem como fonte relevante para qualquer sugestão individual.

## IBGE — localidades

API oficial: <https://servicodados.ibge.gov.br/api/v1/localidades>. Rotas usadas pelo adaptador: `/estados` e `/estados/{código-IBGE-de-2-dígitos}/municipios`. Em 27/10/2026, `/estados?orderBy=nome` retornou HTTP 200; o cliente Python `urllib` não decodificou a resposta gzip nessa tentativa. O adaptador executa com `fetch` nativo Node, que decodifica a transferência; a resposta deve ainda passar validação de status, Content-Type, formato e tamanho. Não confundir falha da ferramenta de consulta isolada com confirmação de dados inválidos no endpoint.

## Mapas gerenciados do projeto

O contrato do ambiente documenta o proxy em `$MANUS_API_URL/v1/maps/proxy`. API JS para browser: `/v1/maps/proxy/maps/api/js?key=<MANUS_API_BROWSER_KEY>&libraries=...`. Estática: `/v1/maps/proxy/maps/api/staticmap`. Geocoding: `/maps/api/geocode/json` recebe endereço ou coordenadas. A integração deve usar somente a chave de navegador publicamente concebida para esse fim; nunca expor `MANUS_API_KEY`. Nenhuma coordenada/autolocalização do participante deve ser enviada automaticamente. A referência operacional do projeto é `/home/ubuntu/skills/webdev/references/maps.md`; disponibilidade e limites de requests permanecem sujeitos ao serviço fornecido.

## Assistência de redação

O contrato operacional do projeto documenta `POST $MANUS_API_URL/v1/chat/completions` com `Authorization: Bearer $MANUS_API_KEY`. Chamadas debitam créditos do projeto. A interface deve pedir consentimento explícito imediatamente antes de cada chamada paga, explicar que o texto será enviado ao serviço Manus AI, limitar o payload à descrição da ideia, não fazer busca externa e devolver somente rascunho a ser revisado pela pessoa. O modelo e formato devem ser revalidados no catálogo webdev em execução antes do uso. Em erro sem saída útil, não repetir a chamada sem autorização.

## Páginas de referência locais

- Contrato geral de serviços: `/home/ubuntu/skills/webdev/references/service-api.md`.
- Contrato de mapas: `/home/ubuntu/skills/webdev/references/maps.md`.
- Contrato de saída estruturada/erros do LLM: `/home/ubuntu/skills/webdev/references/llm.md`.
- Desenho inicial de fontes e limites: `docs/civic-evidence-design.md`.

## Catálogo de IA deste projeto

Consulta não gerativa em 27/10/2026 a `GET $BUILT_IN_FORGE_API_URL/v1/models` (credencial não exibida): HTTP 200, 14 IDs listados. A lista inclui `gpt-6-luna`, `gpt-6-sol` e `gpt-6.1-sol`; três IDs de Claude aparecem marcados “currently unsupported”. Esse catálogo webdev devolveu capacidades/preços nulos e descrição vazia para os modelos GPT listados; por isso a consulta só comprova disponibilidade do ID, não esquema JSON, qualidade, custo ou limite. Não foi feita chamada de completion, não houve consumo de crédito e ainda é necessário tratar a saída como texto não confiável e validar localmente. A interface exigirá consentimento expresso antes da chamada.


## Medição pontual dos payloads (27/10/2026)

Foi feita uma única leitura de diagnóstico por endpoint, com timeout de 20 segundos e teto temporário de 64 MiB para a medição; o teto de produção de 4 MiB não foi alterado.

A busca de proposições da Câmara com `keywords=mobilidade` e `itens=8` respondeu HTTP 200 em `application/json`. O corpo integral mediu 4.371 bytes; o servidor não enviou `Content-Length`. A forma JSON foi um objeto com `dados` contendo 8 registros e `links` com `self`, `next`, `first` e `last`. Cada item observado tinha `id`, `siglaTipo`, `numero`, `ano`, `dataApresentacao`, `ementa` e `uri`. Consulta medida: [endpoint de proposições da Câmara](https://dadosabertos.camara.leg.br/api/v2/proposicoes?keywords=mobilidade&itens=8&ordem=DESC&ordenarPor=id).

As chamadas de diagnóstico para a lista de UFs e para municípios de São Paulo terminaram com EOF na negociação SSL antes de receber headers ou corpo; por isso, não há tamanho observado dessas respostas e elas não foram repetidas. A documentação do IBGE descreve UFs e municípios por UF como arrays JSON. A documentação da Câmara diferencia a API, destinada a dados selecionados em partes, de arquivos para conjuntos completos maiores. [1] [2]

A observação da Câmara é de uma consulta limitada a 8 registros e não prova o tamanho máximo de outras consultas. O limite de payload continua sendo uma defesa operacional; respostas maiores devem ser tratadas por paginação ou limites específicos medidos por fonte, não por leitura ilimitada em memória. O teste unitário do fluxo sintético acima de 4 MiB ainda tem uma asserção pendente sobre o número de chamadas a `pull`; conforme decisão do usuário, essa correção está adiada.

### Referências

[1]: https://servicodados.ibge.gov.br/api/docs/localidades "Documentação oficial da API de Localidades do IBGE"
[2]: https://dadosabertos.camara.leg.br/swagger/api.html "Documentação oficial da API Dados Abertos da Câmara dos Deputados"
