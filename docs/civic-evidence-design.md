# Arquitetura de evidências para um protótipo cívico brasileiro

**Verificação das fontes:** 26/10/2026  
**Escopo:** capacidade real de poucas fontes oficiais, sem levantamento de municípios ou pessoas, sem implementação e sem uso de dados pessoais, segredos ou bases privadas.

A conclusão operacional é restrita: Câmara, Senado, LexML, IBGE e o catálogo aberto do STJ oferecem material estruturado que pode sustentar um primeiro dossiê com proveniência. STF, SINAPI e SICRO oferecem consultas ou arquivos oficiais úteis, mas não foram verificados aqui como APIs públicas de leitura geral sem adesão, contrato ou interpretação manual. Nenhuma dessas fontes, isoladamente, produz um dossiê cívico completo. Localização detalhada, competência de um órgão local, contato institucional, execução orçamentária, contrato, cronograma real e atraso exigem fontes específicas da jurisdição e da proposta.

## O que pode ser usado sem contrato ou credencial de aplicação

### Câmara dos Deputados

A API de Dados Abertos da Câmara é uma API REST pública, com documentação Swagger e arquivos completos para download. A documentação lista proposições, autores, temas, órgãos, eventos, votações, orientações de bancada, votos individuais e atualizações; também lista arquivos de despesas da Cota para Exercício da Atividade Parlamentar. Os arquivos e a API são atualizados diariamente em vários conjuntos. Uma consulta mínima ao endpoint de proposições respondeu em JSON com paginação, sem autenticação no teste realizado. [1]

A Câmara é uma fonte adequada para o registro federal de tramitação, audiência, sessão e resultado de votação. Ela não deve ser tratada como fonte de uma obra municipal, de seu custo ou da responsabilidade pessoal de alguém. Há limitações explícitas: nem toda votação é nominal; registros de votos individuais não equivalem automaticamente a decisão sobre o mérito; em algumas votações o objeto da proposição não é identificado; e a cobertura histórica anterior a 2001 não é completa para todos os tipos. Essas ausências precisam aparecer no dossiê como “não localizado” ou “não disponível no conjunto”, nunca como voto contrário, aprovação inexistente ou ausência de participação. [1] [2]

### Senado Federal

A API de Dados Abertos Legislativos do Senado e do Congresso declara acesso público sem autenticação. A documentação oferece JSON, XML e CSV quando disponíveis e cobre processo legislativo, documentos, prazos, relatorias, comissões, sessões, resultados, votações, orientação de bancada, legislação, orçamento e composição institucional. Uma consulta de referência de legislação respondeu em JSON no teste. [3]

A documentação também informa limite de requisições: mais de 10 por segundo pode resultar em HTTP 429, e períodos de alta demanda podem resultar em HTTP 503. Vários serviços antigos estão marcados como depreciados e têm serviços substitutos indicados por cabeçalhos de depreciação, `Sunset` e `Link`. Um protótipo deve registrar a versão e a data da resposta, preferir os recursos atuais de processo e votação e não prometer estabilidade de rotas antigas. [3]

### LexML

Para legislação, proposições e jurisprudência como índice de descoberta, o webservice do acervo LexML é consultável por URLs e retorna XML segundo o protocolo SRU, baseado em busca e recuperação por URL. O portal reúne normas jurídicas, projetos de lei, jurisprudência, doutrina e documentos correlatos, mas isso não significa que todos os textos integrais tenham o mesmo formato, origem, vigência ou cobertura. [4]

O projeto LexML também publica APIs JSON do conteúdo do próprio portal e RSS. Isso é diferente de uma API universal de todo o acervo jurídico brasileiro. O uso recomendado é obter identificadores e metadados, localizar a fonte oficial responsável e então verificar o texto vigente, o ato de publicação e a jurisdição na origem. [5]

### IBGE — localidades e códigos de municípios

A API de Localidades do IBGE fornece JSON sobre divisões político-administrativas e identificadores oficialmente designados pelo Instituto. Há rotas para municípios, estados, regiões, distritos e relações hierárquicas; os identificadores podem ser consultados por código e a resposta pode refletir a hierarquia territorial. [11]

A tabela oficial de códigos explica que o código municipal tem sete dígitos, com os dois primeiros relacionados à Unidade da Federação, e é atualizada para refletir desmembramentos, mudanças de nome, fusões e extinções. O código do IBGE deve ser a chave territorial canônica do dossiê. Ele não prova o endereço de uma intervenção, não geocodifica automaticamente um logradouro e não identifica qual órgão tem competência sobre uma política pública. [12]

### STJ — catálogo de dados abertos e jurisprudência estruturada

O portal de Dados Abertos do STJ informa acesso automatizado por API CKAN e disponibiliza grupos de jurisprudência, consulta processual, precedentes, sessões e Diário da Justiça. O grupo de jurisprudência consultado tinha dez conjuntos com arquivos CSV, JSON e ZIP e indicava licença Creative Commons Atribuição. [8] [9]

Os conjuntos de “espelhos de acórdãos” são uma base estruturada útil para descobrir metadados, ementas e campos documentais de acórdãos selecionados. O próprio catálogo descreve atualização por arquivos e a possibilidade de duplicidade entre extrações; consolidações devem preservar o identificador e a data de extração. Isso não equivale a uma coleção completa de toda a jurisprudência, nem a uma autorização para inferir uma tese jurídica sem ler o inteiro teor e verificar o contexto processual. [9]

O STJ também publica a API Pública Datajud, que cobre metadados de processos, capas e movimentações da Base Nacional de Dados do Poder Judiciário, observados sigilo e proteção de dados das partes. A página remete a termo de uso e a um endpoint próprio. Ela não deve ser classificada como fonte sem credencial/termo para este protótipo: não foi usada nenhuma chave ou credencial exposta no catálogo, e nenhuma requisição autenticada foi feita. Datajud serve principalmente para metadados e movimentações, não como substituto automático do texto integral dos acórdãos. [10]

## O que fica como busca externa, arquivo público ou fonte ainda insuficiente

### STF

O STF oferece pesquisa web de jurisprudência, inteiro teor de acórdãos publicados, súmulas, repercussão geral e publicações temáticas. A página oficial consultada não documenta uma API pública geral de leitura de jurisprudência sem adesão. Portanto, para o protótipo, STF deve ser tratado como busca externa e fonte de documentos oficiais vinculados, com captura manual ou integração futura apenas depois de verificar uma interface pública suportada. [6]

O MNI do STF não é uma API aberta genérica para qualquer usuário: é um protocolo de interoperabilidade entre tribunais e órgãos, com termo de adesão, credenciamento, gestores institucionais, ambiente de homologação e credenciais. Ele existe para envio, devolução, baixa, declínio e peticionamento de processos, não para alimentar automaticamente um catálogo cívico de jurisprudência. [7]

### SINAPI

O SINAPI é mantido conjuntamente por CAIXA e IBGE. A CAIXA publica metodologias, cadernos técnicos, fichas de insumos, composições paramétricas e relatórios mensais; a página informa que, a partir de 2025, os relatórios incluem arquivos XLSX com famílias, coeficientes, manutenções, insumos e composições e arquivos PDF analíticos, de custos e de preços. [13]

O IBGE descreve o SINAPI como uma operação estatística mensal, com custos e índices para Brasil, Grandes Regiões e Unidades da Federação. A metodologia registra itens que não entram no custo padrão, como projetos em geral, licenças, seguros, instalações provisórias, terreno, administração, financiamento e aquisição de equipamentos. [14]

Assim, SINAPI pode fornecer uma **referência de preço unitário ou composição** e uma base para uma **estimativa explicitamente condicionada**. Não deve ser apresentado como custo total de uma obra sem projeto, quantitativos, localidade, data de referência, encargos, regime de desoneração, mobilização, riscos e itens excluídos. A página não oferece uma API pública geral equivalente às APIs legislativas verificadas; no primeiro protótipo, os relatórios são arquivos oficiais consultados e versionados.

### SICRO

O SICRO é publicado pelo DNIT em página de Custos Referenciais, com relatórios, manuais, cadernos de aplicação, cadernos técnicos, normativos e informativos. Os relatórios são organizados por regiões Norte, Nordeste, Centro-Oeste, Sudeste e Sul. [15] [16]

SICRO é adequado apenas quando o escopo e o tipo de serviço forem compatíveis com infraestrutura de transportes e com a metodologia do DNIT. Não é uma tabela universal para qualquer obra urbana. Não foi identificada, nas páginas oficiais consultadas, uma API pública JSON/REST para uso geral; os arquivos e relatórios devem ser buscados e citados pela referência, região, mês/ano, composição, unidade e versão. Até haver fonte suficiente, o dossiê deve exibir “referência de custo disponível em relatório” e não um valor inventado.

### Fontes que ainda serão necessárias conforme a proposta

Sem uma primeira proposta e uma cidade, não é possível preencher, sem inventar, os seguintes campos:

- endereço, coordenada, bairro, distrito ou polígono da intervenção;
- legislação municipal ou estadual vigente e o órgão competente naquele território;
- plano plurianual, orçamento, empenho, contrato, aditivo, medição, pagamento e fiscalização;
- prazo contratual, marco de referência, avanço observado, projeção e justificativa de atraso;
- canal institucional correto de prefeitura, câmara municipal, secretaria, autarquia, concessionária ou órgão regulador;
- debates e votos de câmara municipal ou assembleia estadual;
- licenças ambientais, urbanísticas, fundiárias e autorizações setoriais;
- processos e jurisprudência realmente relacionados ao caso.

Esses dados podem estar em portais oficiais locais, diários oficiais, tribunais de contas, portais de transparência, sistemas de compras, atos normativos, relatórios de fiscalização e páginas institucionais. Eles não podem ser preenchidos por inferência a partir do código do IBGE, de uma notícia, de uma votação federal ou de uma busca por palavras-chave.

## Estrutura mínima do dossiê

Cada dossiê deve começar com uma ficha de escopo, não com uma recomendação. A ficha deve registrar o enunciado da proposta, o que está e não está sendo analisado, município e UF se conhecidos, código IBGE se confirmado, jurisdição, período de referência, estágio da política ou obra e perguntas ainda sem resposta. Se a proposta ou a cidade não existirem, o sistema deve permanecer em estado de descoberta e não gerar uma lista de obras ou problemas.

A unidade central deve ser um **registro de alegação**, ligado a uma ou mais fontes. Para cada alegação, guardar:

- texto curto da alegação, sem linguagem mais forte que a fonte;
- tipo: fato observado, definição normativa, evidência favorável, evidência contrária, hipótese, estimativa, projeção, controvérsia ou informação ausente;
- relação com a proposta: favorável, contrária, neutra ou indeterminada;
- órgão/publicador, URL oficial, título, identificador, data de publicação ou vigência e data de consulta;
- jurisdição e escala: federal, estadual, municipal, judicial, territorial ou estatística;
- trecho, página, campo ou documento que sustenta a alegação;
- transformação feita no dado, se houver, incluindo unidade, arredondamento, atualização monetária ou deduplicação;
- condição de validade, lacuna e fonte que poderia confirmar ou contestar o registro.

“Favorável” e “contrária” descrevem a relação da evidência com a proposta, não a certeza da alegação. Uma fonte pode sustentar uma afirmação sobre custo e outra fonte pode contrariar a quantidade ou o prazo. As duas devem permanecer visíveis, com suas datas e jurisdições, em vez de serem reduzidas a uma nota única.

A seção territorial deve conter o código do IBGE, nome oficial e nível territorial; endereço e coordenadas somente quando vierem de fonte adequada. A seção de competência deve separar: órgão que tem competência normativa; órgão executor; órgão financiador; órgão licenciador; órgão fiscalizador; órgão que publicou o documento; e órgão que apenas aparece como parte interessada. Cada atribuição precisa de base normativa ou institucional citada. Estar situado em um município não basta para atribuir competência à prefeitura.

A seção de contatos deve conter apenas contato institucional oficialmente publicado, como página de atendimento, ouvidoria, telefone geral ou e-mail funcional do órgão. Não deve incluir dados pessoais, contatos presumidos de agentes ou qualquer endereço encontrado fora de uma fonte oficial. Se não houver confirmação para a jurisdição, preencher “contato institucional ainda não localizado”.

A seção de custos deve distinguir, no mínimo, valor contratado, valor empenhado, valor pago, custo de referência, estimativa e projeção. Cada número deve ter moeda, unidade física, quantidade, localidade/região, data-base, fonte, regime de encargos/desoneração quando aplicável, itens incluídos e itens excluídos. SINAPI e SICRO devem entrar como referências de composição ou preço, não como prova de que determinado projeto custa aquele valor.

A seção de prazo deve distinguir data normativa ou contratual, data publicada, data observada, estimativa e projeção. “Atraso” só pode ser usado quando houver uma linha de base identificável e uma data observada comparável. Se houver apenas uma página antiga ou uma previsão não atualizada, escrever “status não confirmado” ou “projeção vencida sem evidência de conclusão”, sem afirmar atraso ou culpa.

## Jurisprudência e legislação sem recomendação jurídica fabricada

LexML pode ajudar a localizar normas e julgados, mas o registro jurídico deve apontar para a fonte oficial responsável. Para uma decisão judicial, o dossiê deve registrar tribunal, classe, número, órgão julgador, relator apenas quando necessário, data, publicação, inteiro teor ou espelho, questão julgada, resultado e situação processual. A ementa ou um fragmento de busca não basta para afirmar uma regra aplicável.

O dossiê deve separar: texto legal identificado; interpretação expressa no julgado; fato do caso concreto; analogia ou hipótese do analista; e recomendação. A aplicação de um precedente a uma proposta nova não é um fato extraído da API. É uma análise jurídica que exige contexto, competência, vigência, distinção factual e revisão profissional. O protótipo deve limitar-se a mostrar “fontes possivelmente relacionadas” e “questões para validação”, sem instruir ajuizamento, atribuir direito líquido e certo ou declarar ilegalidade.

Regras de bloqueio recomendadas para publicação:

1. não publicar conclusão jurídica sem URL oficial, identificador, trecho e jurisdição;
2. não tratar resultado de busca por palavra-chave como precedente aplicável;
3. não converter ausência de resultado em inexistência de processo, norma ou decisão;
4. não converter uma decisão de primeira instância, decisão monocrática, acórdão ou súmula em autoridade equivalente;
5. não chamar uma estimativa de obrigação, prazo legal ou custo certo;
6. quando faltar fonte suficiente, publicar explicitamente “informação ausente” e a pergunta necessária para completar o dossiê;
7. exigir revisão humana jurídica antes de qualquer texto que possa ser lido como aconselhamento.

## Atribuição de responsabilidade sem salto indevido

O dossiê deve usar quatro rótulos diferentes: **competência institucional**, **ato/documento registrado**, **participação documentada** e **responsabilidade reconhecida**. O primeiro vem da norma ou regimento; o segundo vem do documento oficial; o terceiro exige registro de assinatura, voto, decisão ou atuação; o quarto exige uma conclusão formal de órgão competente, como decisão judicial, auditoria, processo administrativo ou outro ato com autoridade para a conclusão.

Não se deve atribuir falha, dano, ilícito ou atraso a uma pessoa porque ela ocupava um cargo, porque seu órgão tinha competência, porque um partido orientou voto ou porque seu nome apareceu em um documento. Na ausência de conclusão oficial, usar formulação neutra: “o órgão publicou”, “o contrato registra”, “a votação registrou”, “a fiscalização apontou” ou “a alegação não foi confirmada”. Nomes individuais não são necessários nesta etapa e não devem ser coletados apenas para completar uma narrativa.

## Proveniência, atualidade e contraditório

Cada captura deve conservar a URL, o publicador, o título, o identificador, a data de consulta, a data de publicação/atualização e a jurisdição. A fonte deve ser classificada como API, arquivo estruturado, página de busca, documento oficial, ato normativo, estatística ou notícia institucional. A data de consulta não substitui a data de vigência; as duas devem aparecer separadas.

Para cada tema, o dossiê deve procurar ao menos uma fonte que sustente e uma que possa contrariar a alegação quando ambas forem plausíveis. Se a busca não localizar evidência contrária, o resultado deve dizer “não localizada na consulta realizada”, e não “não existe”. Se dois documentos oficiais divergirem, ambos ficam no registro com datas, versões e órgão responsável; a divergência torna-se uma questão aberta.

As APIs legislativas devem ser consultadas com paginação, limites conservadores e versionamento. O Senado informa limites e depreciações; a Câmara alerta para campos cujo significado depende do tipo de votação; o STJ alerta, por seus arquivos incrementais, que pode haver duplicidades. Esses comportamentos precisam ser parte da proveniência, não detalhes ocultos de uma coleta automática. [1] [3] [9]

## Classificação prática das fontes para o protótipo

**Pode entrar como fonte estruturada sem contrato ou credencial de aplicação, sujeita aos termos e limites publicados:** API REST da Câmara; API legislativa do Senado; consulta SRU/XML do acervo LexML; API de Localidades do IBGE; API CKAN e arquivos públicos do catálogo do STJ. A implementação futura deve confirmar, no momento do uso, termos, licenças, limites e mudanças de versão. [1] [3] [4] [8] [11]

**Pode entrar como fonte oficial, mas por busca ou arquivo e não como API geral verificada:** pesquisa de jurisprudência do STF; pesquisa de jurisprudência do STJ; relatórios e documentos do SINAPI; relatórios e manuais do SICRO. A interface ou arquivo deve ser citado diretamente e a interpretação deve ficar visível no dossiê. [6] [13] [15]

**Não deve ser tratado como acesso sem contrato/credencial neste desenho:** MNI do STF, que exige adesão institucional; Datajud quando o acesso exigir chave e aceitação de termos; qualquer portal municipal, tribunal de contas ou órgão estadual que ainda não tenha sido identificado para uma proposta concreta. Nenhuma credencial encontrada em uma página pública deve ser reutilizada ou colocada no relatório. [7] [10]

A arquitetura é deliberadamente incompleta: ela suporta um dossiê auditável para uma proposta identificada, mas não promete cobertura completa do Brasil, recomendação automática, automação nacional, identificação exaustiva de autoridades ou cálculo confiável de custos sem projeto e dados locais.

## Referências

[1]: https://dadosabertos.camara.leg.br/swagger/api.html "API Dados Abertos da Câmara dos Deputados"
[2]: https://dadosabertos.camara.leg.br/ "Dados Abertos da Câmara dos Deputados"
[3]: https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html "API de Dados Abertos Legislativos do Senado Federal e Congresso Nacional"
[4]: https://www12.senado.leg.br/dados-abertos/legislativo/legislacao/acervo-do-portal-lexml "Acervo do portal LexML — Dados Abertos do Senado"
[5]: https://projeto.lexml.gov.br/transparencia/dados-abertos "LexML — Dados Abertos"
[6]: https://portal.stf.jus.br/jurisprudencia/ "Pesquisa de jurisprudência do Supremo Tribunal Federal"
[7]: https://portal.stf.jus.br/textos/verTexto.asp?servico=processoIntegracaoInformacaoGeral&pagina=mni "STF — MNI: Modelo Nacional de Interoperabilidade"
[8]: https://dadosabertos.web.stj.jus.br/ "Portal de Dados Abertos do STJ"
[9]: https://dadosabertos.web.stj.jus.br/group/jurisprudencia "STJ — Grupo de dados abertos de jurisprudência"
[10]: https://dadosabertos.web.stj.jus.br/dataset/api-publica-datajud "STJ — API Pública Datajud"
[11]: https://servicodados.ibge.gov.br/api/docs/localidades "IBGE — API de localidades"
[12]: https://www.ibge.gov.br/explica/codigos-dos-municipios.php "IBGE — Códigos dos municípios"
[13]: http://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/paginas/default.aspx "CAIXA — SINAPI"
[14]: https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9270-sistema-nacional-de-pesquisa-de-custos-e-indices-da-construcao-civil.html "IBGE — SINAPI: custos e índices da construção civil"
[15]: https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro "DNIT — SICRO"
[16]: https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro/relatorios/relatorios-sicro "DNIT — Relatórios SICRO"
