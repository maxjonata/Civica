# Cívica — propostas, debate e acompanhamento público

**Estado em 27/10/2026:** plano revisado para confirmação. O produto é participação cívica, não cadastro/passkey. Este documento substitui a orientação do próximo build, mas não comprova funcionalidades implementadas. Plano e TODO anteriores estão preservados em `docs/archive/`; código e dados anteriores não serão apagados.

## a. Sumário da crítica

O fluxo central é sugerir, compreender, debater, votar e acompanhar. Contas não podem continuar bloqueando esse fluxo no protótipo. CPF com dígitos verificadores corretos não comprova titularidade, pessoa única, idade ou residência. Ligar CPF, voto, localização e preferência política cria um cadastro de alto risco desnecessário ao teste.

“Todos os dados possíveis” e “acessibilidade perfeita” não são garantias verificáveis. Buscar evidências relevantes, inclusive contrárias à proposta, declarar lacunas e oferecer acesso equivalente sem visão, mouse, áudio, mapa ou 3D. As limitações devem acompanhar cada dado, não ficar escondidas num aviso genérico.

## b. Pontos de análise e desenho do produto

### 1. Próxima entrega: protótipo conectado no Preview

Reutilizar React/TypeScript/Vite e Express. A direção de hospedagem atualizada em 01/11/2026 usa Supabase Postgres para persistência e Cloudflare Workers/Hyperdrive para servir a SPA e a API. MySQL fica restrito aos testes locais herdados enquanto eles forem migrados. Substituir a experiência inicial de identidade pela plataforma pública em português brasileiro. Consulta de propostas, debate, fontes e totais sem conta. Sugestão, comentário e voto funcionam por sessão experimental sem Manus, passkey, senha ou acesso ao gov.br.

Começar vazio, aceitar propostas reais inseridas pelo usuário e consultar fontes reais quando houver assunto e local suficientes. Não semear votos, cidadãos, obras, autoridades ou julgados fictícios para preencher telas. Fixtures de teste existem somente em ambiente isolado. Estados vazios devem ser úteis, com ação clara e sem gráficos inventados.

Entrega inicialmente para experimentação no Preview, não coleta comunitária irrestrita. Explicar antes do envio que o conteúdo poderá ser visto por quem acessar o protótipo. Salvar código/checkpoint não equivale a publicar. Publicação ampla continua separada e depende de confirmação específica.

### 2. Explorar, sugerir e debater

Navegação: **Explorar propostas**, **Fazer uma sugestão**, **Mapa**, **Dados e comparações**. Busca e filtros por tema, obra/serviço ou mudança legislativa, município/UF e estágio; estados de carregamento, erro recuperável e nenhum resultado distintos.

Criação guiada: o que precisa mudar; quem/o que é afetado; onde se aplica; evidências opcionais; revisão final. Perguntas adequadas ao tipo da proposta, sem exigir conhecimento jurídico ou de orçamento. Permitir voltar e corrigir sem perder o rascunho. Confirmar texto, localização, fotos e visibilidade antes de publicar.

Antes de enviar, procurar propostas relacionadas no acervo existente, explicar a semelhança e oferecer abrir/complementar a existente ou continuar com outra proposta. Não fundir automaticamente, bloquear toda proposta parecida nem apagar texto ao redirecionar. Manter relações navegáveis entre propostas.

Detalhe: resumo claro, problema, mudança pretendida, área afetada, fotos com descrição, perguntas abertas, propostas relacionadas, debate, votos e dossiê. Debate com argumentos/perguntas/evidências favoráveis ou contrárias; pseudônimo opcional separado do voto; renderização segura de conteúdo não confiável. Denúncia e retirada por autorização específica do conteúdo; nenhum privilégio de moderação concedido a visitante. Moderador responsável e processo de retirada precisam existir antes da abertura comunitária.

### 3. Participação de teste e identidade futura

O servidor emite um token aleatório de sessão experimental em cookie protegido. Controle de repetição por token/proposta, não por identidade civil. Um voto por token/proposta, alterável/retirável, com atualização transacional e prevenção de duplicação por concorrência, duplo clique ou repetição após falha. Opções explícitas: apoiar, discordar ou precisar de mais informações; revisão da escolha e feedback acessível.

Resultados públicos são totais e metodologia, nunca listas de cidadão–escolha, identificadores, pseudônimos de voto ou horários individualizados. Explicar “voto experimental por sessão”, não “uma pessoa, um voto”, eleição oficial ou representatividade populacional. Sem conta não significa antifraude civil garantido.

**Mudança proposta para aprovação:** substituir o CPF de teste por identificador opaco. Se for indispensável demonstrar o campo, validar apenas formato/dígitos no navegador e descartar antes de qualquer chamada, sem associar CPF à sessão. Não enviar, guardar, publicar ou incluir CPF em logs, URLs, IA ou analytics. O campo não identifica a pessoa X nem permite recuperar suas escolhas.

Guardar CPF e eventual conexão autorizada ao gov.br como requisitos futuros. Integração gov.br não é garantida. Preservar o módulo anterior, mas deixar cadastro/assinatura/revisão fora da navegação e dos endpoints ativos do produto cívico. Identidade futura deverá ter serviço, permissões e dados separados de participação; não basta separar pastas.

### 4. Localização e fotos

Separar local do projeto e origem do participante. Proposta pode informar município/UF, bairro, referência ou endereço de equipamento/intervenção; não pedir residência do autor. Origem do participante: município/UF opcional e autodeclarado; não inferir por GPS, IP ou EXIF. Participação sem localização ou preferência continua possível.

Mapa opcional dos projetos com marcadores nomeados e filtros. Lista e busca textual equivalentes sempre disponíveis. Serviço de mapas integrado, validado em execução e carregado por escolha; indisponibilidade não bloqueia formulário ou lista. Não inventar coordenadas. Restringir precisão quando expuser pessoas ou locais protegidos; endereço exato de obra pública não se confunde com residência de autor/votante.

Foto opcional, com descrição textual e preview/remover antes do envio. Validar formato raster, bytes e pixels antes de processamento; redecodificar, remover metadados no servidor e não publicar original. Bloquear arquivos ativos, inválidos e descompressão excessiva. Revisar exposição de rostos, crianças, placas, documentos e endereços residenciais; mídia sem segurança confirmada permanece não pública ou é recusada. Detector automático não garante anonimização. Originais não vão para URLs públicas, Git ou logs. Retirada precisa corresponder à capacidade real de apagar bytes; ocultar URL não é exclusão física.

### 5. Ajuda para formular ideias

Entrevista curta, neutra e em linguagem simples, em texto, para organizar a intenção original, pedir informação faltante e sugerir um resumo. A pessoa corrige e confirma antes de publicar. Fluxo completo funciona sem IA e sem microfone.

Assistência de IA opcional com explicação do texto enviado e possibilidade de recusa, sem CPF, perfil de voto ou áudio de menores. Leitura em voz alta por ação explícita, com informação sobre voz disponível e possíveis serviços do sistema; não presumir processamento local de toda voz do navegador. Ditado nativo pode ser usado nos campos. Gravação própria/transcrição remota não são necessárias para este build; ficam para etapa com política e consentimento específicos.

O público-alvo inclui crianças, idosos e baixa alfabetização. Não pedir dados identificadores de crianças no teste inicial. Abertura para menores, mídia/áudio e pesquisa com crianças exigem protocolo de melhor interesse, assistência e consentimento quando aplicável, não apenas checkbox genérico.

### 6. Dossiê de obras e mudanças legislativas

Seções por proposta: escopo/local; órgãos e competências; contatos institucionais; custos; cronograma; legislação relacionada; jurisprudência; posições públicas documentadas; fontes, controvérsias e lacunas. Seção vazia não pode aparentar análise concluída.

Cada alegação registra natureza — relato, fato documentado, hipótese, estimativa, projeção ou informação ausente —, publicador, URL, identificador/trecho, jurisdição, data da fonte e da consulta. Distinguir evidência favorável, contrária, neutra e relação ainda não confirmada. Uma fonte oficial não comprova automaticamente a interpretação da aplicação. Preservar correções e versões.

Conectores iniciais: IBGE/localidades; descoberta legislativa por APIs oficiais suportadas da Câmara/Senado; referências e consultas oficiais para normas, jurisprudência e custos. A implementação deve distinguir fonte realmente consultada de link de busca externo. Câmara/Senado não substituem contratos, legislação ou contatos municipais. Falha/ausência de resultado tem estado claro; não vira “não existe”. Não contornar restrições, adotar APIs institucionais sem habilitação ou reutilizar credenciais encontradas em páginas.

Competência institucional, execução, financiamento, fiscalização, participação documentada e responsabilidade formalmente reconhecida são coisas diferentes. Cada atribuição a órgão/autoridade precisa de ato/fonte e período pertinente. Não atribuir ilícito, culpa ou atraso pelo cargo ou partido. Mostrar somente contatos institucionais publicados oficialmente; sem fonte, “órgão/contato ainda não confirmado”.

Custos: separar referência, estimativa, valor contratado, empenhado e pago. Calculadora de itens/quantitativos com moeda, unidade, quantidade, local/data-base, fonte, encargos quando aplicáveis, inclusões/exclusões e hipóteses. Sem entrada suficiente não há total confiável: pedir informação, não inventar preço SINAPI/SICRO. Esses acervos são referências de composição/preço, não orçamento automático de obra. Nenhuma estimativa substitui projeto de engenharia.

Cronograma: datas oficiais, metas desejadas e cenários estimados separados. Comparação de atraso só com linha de base identificável e status observado; projeção vencida sozinha não comprova atraso/culpa. Mostrar premissas/dias e não inventar avanço de obra.

Mudança legislativa: normas/partes relacionadas e julgados localizados com fonte, vigência, tribunal/identificador/data e contexto. Separar texto, interpretação da fonte e hipótese de relação com a proposta. Palavra-chave não demonstra precedente aplicável nem corroboração. Conclusão jurídica automatizada é preliminar e precisa de revisão adequada; sem casos inventados ou certeza jurídica. Cobertura completa do Brasil não será prometida.

### 7. Analytics geográficos e de participação

Painel por proposta, tema, território e período: propostas, participação experimental quando contável, totais/distribuição de escolhas, debate, cobertura territorial autodeclarada e completude dos dossiês. Cada métrica traz unidade, denominador, período, atualização, método e exclusões. Não chamar sessões de brasileiros verificados nem popularidade de mérito técnico.

Origem dos votos/preferências somente em agregados protegidos, sem mapa de moradores ou exportação individual. Limiar inicial de pelo menos 10 participantes experimentais por célula, com supressão complementar quando totais permitirem reconstrução; impedir cruzamentos arbitrários, combinações raras e subtração por filtros. O limiar reduz risco, não comprova anonimato. Abaixo disso, informar amostra insuficiente. Comprovar regras em testes isolados, não semear cidadãos no protótipo para preencher gráficos.

Contagem por perfil somente para respostas opcionais explicitamente autodeclaradas sobre prioridades/posições temáticas, com finalidade clara e possibilidade de não responder. Não inferir ideologia, partido ou persuasibilidade de cidadãos pelo CPF, texto ou votos. Não publicar perfil individual ou gerar candidato ideal personalizado. Quem não respondeu não entra em inferência de categoria. Estatística territorial considera apenas localização fornecida voluntariamente.

### 8. Grafo de proximidade em três dimensões

Representar projetos e posições documentadas de autoridades públicas, e coortes autodeclaradas apenas quando volume/proteção permitirem. Não representar cidadãos individuais. Sem eixo fixo esquerda/direita, partidos como posição presumida, rótulos binários ou “melhor perfil”. Proximidade é semelhança dos atributos/posições disponíveis, não ideologia verdadeira ou intenção oculta.

Métrica publicada e versionada: temas comuns, posições declaradas/documentadas, pesos, escala e cobertura; ausência não significa oposição, neutralidade ou distância zero. Calcular somente com variáveis comuns suficientes. Projeção em 3D para exploração, com distorção/limites explícitos; distância numérica original vem na tabela. Não inventar posições por IA ou estereótipo de partido. Mostrar fontes/data de cada posição e relação por projeto. Sem comparabilidade, “dados insuficientes”.

3D opt-in, sem giro automático. Busca/seleção/controles por teclado, lista/tabela equivalente com pares, dimensões, fontes, cobertura e distância. GPU/visualização indisponível não impede compreender os dados. Grafo vazio não pode ser preenchido com perfis fictícios para parecer funcional.

### 9. Implementação, estrutura e dependências

Manter Onion: domínio sem Express, MySQL, modelo, mapas ou biblioteca de mídia. Casos de uso dependem de portas substituíveis. Organização de código não será chamada de isolamento operacional.

- `shared/civic/`: contratos públicos, enums, schemas e proveniência; sem CPF/documentos de identidade.
- `server/civic/domain/`: propostas/relações, voto, privacidade/contagem, custos/prazos e distâncias.
- `server/civic/application/`: criar/revisar, relacionados, debate, votar/retirar, dossiês e agregados.
- `server/civic/ports/`: repositórios, fontes, assistência, mídia, geocodificação, relógio e aleatoriedade.
- `server/civic/adapters/`: MySQL, IBGE/legislativo, IA/mapas integrados e normalização raster.
- `server/civic/http/`: leitura pública e mutações com sessão experimental, origem/CSRF, limites e schemas estritos.
- `client/src/civic/`: shell e componentes acessíveis, páginas de descoberta/criação/detalhe, mapa, analytics, grafo e metodologia.
- `migrations/civic/`: tabelas normalizadas, migrações aditivas versionadas e índices/restrições de concorrência. Não reutilizar snapshot JSON/limite de duas contas como banco de toda a plataforma.
- `tests/civic/`, `scripts/`, `docs/`: testes isolados, operação, método e evidências. Preservar testes anteriores em escopo separado; não removê-los para ocultar regressões.

Frontend via Vite no desenvolvimento, Express/container no build, APIs `/api/civic/*` no mesmo origin; honrar PORT/porta configurada. Rotas previstas: `/`, `/propostas`, `/sugerir`, `/propostas/:id`, `/mapa`, `/dados`, `/conexoes`, `/metodologia`, `/privacidade`, `/acessibilidade`. Manifesto deve listar apenas páginas implementadas. API/asset inexistente não vira HTML; erro real não vira resultado vazio ou 404 falso.

Banco gerenciado é compartilhado por desenvolvimento/publicação. Não apagar piloto anterior. Testes adversariais/fixtures/concorrência só em base local isolada, sem DSN/segredos gerenciados. Propostas/votos duráveis em banco, nunca somente filesystem efêmero/memória. Mídia sensível não vai a assets públicos. Migração é explícita, versionada e não executa destructivamente a cada início.

Manter Node 22, versões fixadas e lockfile. Selecionar bibliotecas mantidas para mídia, 3D e acessibilidade, com permissões de instalação mínimas e auditoria; não criar criptografia própria. IA/mapas usam capacidades integradas; não requerem as três chaves do piloto de identidade.

Candidatos verificados no catálogo de 26/10: `gpt-6-luna` para assistência linguística simples, `gpt-6.1-sol` para análise factual complexa; revalidar disponibilidade/contrato antes de executar. Chamada server-side, schema, limites, timeout, cota/rate limit, erro recuperável e custo informado antes do uso. Não iniciar pesquisa paga a cada visita/filtro. Nenhum modelo é autoridade jurídica e falha de IA não bloqueia formulário manual. Não mandar preferências políticas individuais para pesquisa de dossiês.

Conteúdo externo é dado, não instrução. Sem executar HTML/Markdown inseguro ou fazer fetch livre de URL do usuário. Conectores com domínios/rotas permitidos, limites de resposta/tempo e proteção SSRF. Guardar link informado não significa verificar seu conteúdo.

### 10. Segurança, execução e limites de alegações

TDD, integração controlada, SQL/concorrência, navegador e triagem de acessibilidade, com revisão independente da implementação. Corrigir falhas materiais sem prometer todos os ataques possíveis. Um gate local/YAML não comprova CI remota, revisão humana constante, backup externo ou rotina agendada em operação.

**Orientação adicional do usuário em 27/10/2026:** para cada erro, no máximo uma tentativa de correção. Se essa tentativa falhar, interromper a resolução daquele erro e perguntar ao usuário; não repetir automaticamente.

Sem abertura ampla antes de responsáveis por moderação/privacidade, política de dados/retirada, controle de abuso, recuperação, revisão jurídica adequada e avaliação manual de acessibilidade. Sem promessa de resistência DDoS, sigilo criptográfico de eleição, unicidade civil ou disponibilidade contínua. P2P continua adiado. Não fazer gastos externos/publicação ampla sem autorização específica.

## Design e acessibilidade

Reutilizar a identidade sóbria do projeto, corrigindo os problemas de acesso. Sem hero decorativo: o foco é o conteúdo da comunidade.

**Movimento:** design editorial funcional de serviço público, sem imitar identidade oficial. **Princípios:** conteúdo primeiro, uma decisão principal por etapa, estado explícito e alternativas equivalentes. **Cores:** base clara, texto escuro, teal para ação e âmbar para aviso, com contraste medido e sem semântica partidária; cor nunca sozinha. Corrigir o foco atual de contraste insuficiente com contorno verificável em todos os fundos.

**Layout:** coluna de leitura e contexto lateral quando há espaço; propostas em lista com filtros; detalhe por seções/divulgação progressiva. Sem dashboard ornamental como entrada obrigatória. **Assinaturas:** separadores finos, fontes/estados textuais e relações discretas; sem selo de verificação inexistente. **Interação:** botões textuais grandes e controles nativos; sem navegação essencial escondida por rolagem horizontal nem scroll infinito obrigatório.

**Animação:** sem autoplay, giro ou movimento essencial; feedback breve respeitando reduced-motion. **Tipografia:** sistema, sem dependência remota, corpo base 18 px/entrelinha confortável; headings claros sem compressão extrema e monospace apenas para metadados quando útil. **Marca:** Cívica, provisório — compreender propostas e participar com transparência; clara, sóbria e verificável. **Voz:** “O que você gostaria de mudar?”; “Leia o resumo. Depois, escolha como participar.” Evitar “vontade do povo” como sinônimo de amostra voluntária.

**Wordmark:** preservar sinal discreto existente, sem brasão/vínculo oficial; metadados apenas com asset real. **Cor assinatura:** teal profundo atual com variantes de contraste verificadas.

Meta WCAG 2.2 A/AA aplicável ao escopo, não acessibilidade perfeita garantida. Idioma, títulos, h1 e landmarks; primeiro foco em pular conteúdo; foco/anúncio ao trocar rota; label/ajuda/erro associado e resumo focável; seleção com estado programático; mensagens por status sem excesso; teclado completo; sem informação apenas por cor, ícone, gráfico, mapa ou áudio.

Texto normal mínimo 4,5:1; estados/componentes significativos 3:1; alvos principais 44 px como escolha do produto; zoom 200% e reflow 320 CSS px/equivalente a 400%, sem perda funcional. Mapa/grafo/tabela complexa podem requerer duas dimensões, mas têm alternativa equivalente. Preferências de texto/alto contraste do sistema funcionam; não usar overlay que prometa consertar HTML inadequado.

Axe/Playwright são triagem e regressão, não certificação. NVDA/VoiceOver e usuários representativos exigem execução real; declarar pendente se indisponível. Defeito conhecido que impeça sugerir, compreender ou votar bloqueia abertura comunitária.

## c. Sugestões para fortalecimento e ordem da entrega

Após confirmação deste escopo e da proteção de participação, atualizar TODO com critérios completos e implementar partes conectadas: domínio/API/dados e shell; descoberta/criação/detalhe/debate/voto; fontes/locais/mídia/assistência; agregados/grafo/metodologia. Delegar fronteiras independentes com contratos claros; coordenação integra e trata riscos.

O próximo ponto de avaliação deve ser um fluxo funcional no Preview, não outra tela de cadastro. Entregar resumo de funções reais, fontes conectadas, testes executados e pendências materiais. Integração não validada ou ausência de dados comparáveis não pode ser substituída por demonstração falsa ou item marcado completo.

Bases independentes incorporadas: `docs/civic-accessibility-design.md`, `docs/civic-privacy-design.md`, `docs/civic-evidence-design.md`. São revisões de desenho, não auditorias de uma implementação ainda inexistente.


## Remediação por fases — autorização de 28/10/2026

O usuário solicitou correção progressiva das lacunas identificadas e execução de todos os testes. Esta orientação autoriza corrigir o blocker do browser e os achados de código; a antiga decisão de adiar correções/repetições de teste fica supersedida para esta campanha. O limite de payload permanece em 4 MiB. Testes e migrações continuam restritos a bases locais isoladas; não tocar na base gerenciada nem publicar durante a remediação.

**Fase 1 — estabilizar formulário e estado de erro:** corrigir o alerta duplicado na home com falha recuperável; consertar validação por etapa e foco/âncoras; validar a recuperação e a mensagem no Playwright sem ocultar alertas via seletor permissivo.

**Fase 2 — intake íntegro:** tornar a localização opcional/explicitamente não confirmada de ponta a ponta; validar tuplas IBGE quando houver catálogo, preservando fallback manual; incluir evidências opcionais no rascunho e na revisão antes da publicação; manter proposta e evidências consistentes/atômicas. Corrigir busca de relações para informar o escopo pesquisado, paginação/limites e decisões abrir/complementar/continuar sem apagar rascunho.

**Fase 3 — voto e retenção:** recuperar somente a escolha da sessão atual, manter retirada segura, testar concorrência/idempotência e fechar vínculos de expiração. Não inventar uma janela de retenção ou regra de permanência de totais após purga; preparar o modelo e pedir ao usuário a decisão de política antes de ativar exclusão automática.

**Fase 4 — analytics e proveniência:** separar origem voluntária do participante da localização do projeto; dar a cada métrica unidade, denominador, período, método, cobertura e exclusões; proteger combinações/células pequenas. Tornar proveniência e estado de conferência de dossiês explícitos, distinguindo relato, fato, estimativa e ausência.

**Fase 5 — fontes e estágio:** melhorar erros/paginação e rotulagem de consultas reais; adicionar novos conectores apenas após validação de endpoints e jurisdições suportadas, sem alegar cobertura nacional. Separar visibilidade/publicação de estágio factual; sem fonte, estágio não confirmado.

**Fase 6 — grafo e acessibilidade:** versão transparente de métrica/escala/pesos, pares comparáveis e motivos de exclusão; tabela textual com valores usados, fontes e distância; foco/teclado sem depender do SVG, e axe/browser nas rotas/estados relevantes. Testes automatizados são triagem, não certificação ou substituto de NVDA/VoiceOver e usuários.

**Fechamento:** aplicar regressões por mudança, SQL exclusivamente local e uma execução completa do gate após as fases integradas; corrigir os achados e pedir uma revisão independente read-only final. Checkpoint e eventual publicação são passos separados: não publicar automaticamente. A abertura pública segue bloqueada enquanto moderação/denúncia, política de privacidade/retirada e avaliação de acessibilidade manual estiverem ausentes; pedir confirmação específica antes de qualquer publicação pública.
