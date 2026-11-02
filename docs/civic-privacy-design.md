# Cívica — revisão crítica independente de privacidade e integridade

**Data:** 26/10/2026  
**Modo:** revisão read-only; nenhum código, banco, segredo, navegador compartilhado ou dado pessoal foi usado.  
**Escopo:** novo conceito de plataforma pública de ideias/problemas, endereços e fotos, debate, votos e analytics geográficos/políticos. Este documento contém riscos e recomendações de desenho para protótipo. Não é parecer jurídico definitivo.

## Conclusão de bloqueio

O novo escopo não deve ser acoplado ao fluxo de conta, passkey ou vinculação gov.br que hoje existe no repositório. O estado comprovado do projeto é um piloto restrito de conta e identidade manual, sem enquetes, votação pública ou identidade real registrada ([`docs/DECISIONS.md`](../DECISIONS.md), [`docs/validation-report.md`](validation-report.md)). As decisões atuais também reconhecem que o processo e o banco ainda não oferecem isolamento operacional de identidade e participação. Portanto, a abertura comunitária exige uma arquitetura e uma revisão novas, não apenas telas ou campos adicionais.

Para o protótipo seguro, a decisão recomendada é **não coletar CPF, opinião política identificável, geolocalização automática ou voto nominal**. É aceitável testar fluxo e contagem com um identificador opaco de participante de teste, município/UF fornecido voluntariamente e dados sintéticos ou controlados. Mesmo sem usar a dicotomia esquerda/direita, uma preferência política vinculada ou razoavelmente atribuível a uma pessoa continua sendo informação de alto risco: a LGPD inclui opinião política na definição de dado pessoal sensível e alcança tratamentos que revelem esse tipo de dado.[1]

## Riscos materiais

### 1. CPF com dígitos válidos não autentica e não resolve Sybil

O dígito verificador apenas testa uma propriedade matemática do número informado. Ele não demonstra posse, titularidade, existência atual, idade, residência, unicidade civil ou intenção de voto. Um atacante pode gerar ou reutilizar números que passam no checksum, automatizar vários navegadores e votar muitas vezes. O aplicativo não pode apresentar isso como “uma pessoa, um voto”, “identidade verificada” ou prevenção de fraude.

O perigo aumenta se o CPF for usado como chave, mesmo cifrado ou com hash: ele passa a ser um identificador persistente que permite vincular voto, município, horário, comentário, endereço e foto. HMAC/hash não transforma CPF em dado anônimo; somente reduz algumas formas de exposição. O protótipo não precisa desse vínculo.

**Decisão D1 — CPF fora da rede:** não incluir CPF em requisições, banco, logs, analytics, URLs, mensagens de erro, fixtures ou relatórios. Se um teste de interface precisar demonstrar o campo, a validação de formato/checksum deve ocorrer apenas no navegador, com valor descartado antes de qualquer chamada de rede. A mensagem deve dizer explicitamente que isso não é autenticação e não garante unicidade. Para testes automatizados, usar fixtures não pessoais, não CPFs plausíveis.

### 2. União CPF–opinião–localização cria um registro político identificável

A combinação de CPF, escolha, município/UF, endereço do problema, timestamp, IP, navegador, comentário e foto pode identificar ou reidentificar a pessoa mesmo quando o nome não é exibido. A mesma combinação permite retaliação, discriminação, assédio ou pressão política. “Sem contas” não elimina o risco: cookies, IPs, identificadores de dispositivo, links compartilháveis e metadados de mídia podem reconstituir uma conta informal.

**Decisão D2 — separação de finalidades:** o identificador opaco de teste, a escolha do voto, a localização auto-informada e as preferências voluntárias devem ter campos e serviços separados. A camada pública de analytics não recebe uma chave que permita unir esses conjuntos. Não exportar registros por participante. Se a contagem exigir controle de repetição durante um experimento, manter um token aleatório de escopo curto e finalidade única, sem CPF, endereço, IP ou conteúdo da escolha; expirar e apagar o vínculo ao final do teste.

### 3. Inferência individual de opinião política

Votos em assuntos públicos, respostas a questionários, textos de debate e distâncias calculadas entre posições podem revelar preferência política, ainda que a interface não use “esquerda” e “direita”. Um classificador que atribua ideologia, partido, candidato ou “perfil político” ao indivíduo cria uma inferência sensível. A inferência pode estar errada, ser usada fora do contexto ou atingir pessoas que nunca aceitaram esse uso.

**Decisão D3 — não inferir indivíduo:** não calcular, armazenar, exibir ou compartilhar um perfil político individual. Não converter um conjunto de votos em rótulo ideológico, “candidato ideal”, recomendação eleitoral ou audiência para propaganda direcionada. Não usar IA para inferir opinião, persuasibilidade, partido ou orientação política.

É possível realizar análise agregada somente quando a categoria é **explicitamente autodeclarada**, opcional, documentada e não ligada a um participante identificável. A tela deve explicar a pergunta, finalidade, versão da classificação, ausência de representatividade e possibilidade de não responder. Uma resposta a um tema não deve ser reinterpretada como identidade ideológica.

### 4. Grafo 3D pode ser uma máquina de perfilamento e falsa precisão

Um grafo de distâncias entre participantes pode revelar quem se parece com quem, permitir reidentificação em grupos pequenos e induzir a leitura de que uma distância numérica é uma verdade política. O efeito visual 3D também pode esconder decisões de peso, normalização, dados ausentes e mudança de versão. Um grafo público de cidadãos não é aceitável para este protótipo.

**Decisão D4 — grafo de objetos públicos:** priorizar grafo de projetos/ideias e posições documentadas de autoridades públicas, com fonte, data, trecho ou justificativa e aviso de que a posição é uma representação do material público, não uma declaração absoluta. Como alternativa, usar apenas coortes de preferências explicitamente autodeclaradas, sem identificadores, com grupos pequenos suprimidos.

Toda distância publicada deve ter uma métrica legível e versionada: variáveis usadas, escala, pesos, normalização, tratamento de não resposta, período, fonte e limites. A interface deve oferecer uma tabela alternativa com as dimensões, respostas ou posições documentadas e a distância resultante; o grafo não pode ser a única explicação. Mostrar tamanho da amostra e incerteza. Não calcular candidato ideal nem recomendação direcionada a partir de perfil privado.

### 5. Endereços e geografia podem causar doxxing

O endereço exato de uma casa, escola, abrigo, comércio pequeno ou ocorrência pode identificar moradores, vítimas ou denunciantes. A origem geográfica dos votantes é uma finalidade diferente da localização do problema. IP, GPS ou geocodificação automática acrescentariam dados que o participante não escolheu fornecer e podem produzir falsa precisão.

**Decisão D5 — localização mínima e voluntária:** para origem do participante, aceitar somente município/UF auto-informado, opcional, sem GPS, sem leitura de IP para mostrar localização e sem endereço residencial. Para o problema, preferir bairro, ponto aproximado ou célula geográfica suficientemente ampla; não publicar o endereço residencial do autor. Separar e proteger a localização do problema da origem auto-informada do votante.

Analytics geográficos devem ser agregados, não um mapa de pontos individuais. Suprimir resultados quando o grupo for pequeno ou quando a combinação município/UF, tema, período e coorte permitir reidentificação; não tratar um limiar como garantia matemática. Considerar uma região mais ampla quando necessário. Mostrar denominador, cobertura, fonte auto-informada, possibilidade de erro e que a amostra não representa toda a população.

### 6. Fotos, EXIF, crianças e pessoas de terceiros

Fotos podem conter GPS e horário em EXIF, rostos, crianças, placas, documentos, telas, uniformes, números de casa e cenas que denunciam uma pessoa. O autor do upload pode não ter autorização para publicar a imagem de terceiros. Uma imagem de um problema público pode, sem intenção, expor a casa ou a vítima. O original também é um ativo de risco mesmo que a cópia pública seja borrada.

A LGPD exige que o tratamento de crianças seja realizado no melhor interesse; a orientação preliminar da ANPD destaca consentimento específico e em destaque de responsável quando essa hipótese for utilizada e restrições ao repasse a terceiros.[1] [4] Não presumir consentimento pela simples inclusão da foto em um formulário.

**Decisão D6 — mídia em quarentena:** aceitar somente formatos e tamanhos necessários, tratar upload como conteúdo não confiável, bloquear conteúdo ativo e manter revisão antes de publicar. Remover EXIF/GPS e outros metadados antes de persistir a versão pública; não manter o original por conveniência. Detectar e, quando possível, borrar rostos, crianças, placas e documentos; caso não seja possível garantir a remoção, rejeitar ou solicitar nova foto. Proibir doxxing, telefone, documento, endereço residencial identificável e exposição de terceiros. Oferecer denúncia e retirada rápida, com registro mínimo da decisão.

### 7. Votos públicos ligados a nomes violam a expectativa de sigilo

Uma lista pública com “nome — escolha” permite perseguição, coerção e construção de listas políticas. Apelido, avatar, horário e comentário podem reidentificar a escolha mesmo sem nome civil. A integridade do resultado também sofre se as pessoas deixarem de votar livremente por medo de exposição.

**Decisão D7 — publicidade só de totais:** por padrão, publicar totais por opção/projeto e metodologia de contagem, nunca nomes, apelidos, IDs, horários ou linhas de voto que possam ser ligados à escolha. Não oferecer endpoint de enumeração de cédulas. A confirmação do voto deve ser privada, sem recibo que permita provar a terceiros como a pessoa votou. Totais por município ou coorte também ficam ocultos quando a célula for pequena ou combinável com outra informação.

Debate público pode usar pseudônimo separado do voto, com moderação, limites e canal de remoção. O pseudônimo não deve ser a mesma chave do participante, do voto ou da localização.

### 8. Sem conta não há prova de pessoa única

Um protótipo sem contas e sem autenticação pode demonstrar experiência e contagem, mas não pode prometer unicidade civil. Limitar por cookie, IP ou navegador reduz abuso casual e não distingue casa compartilhada, VPN, rede móvel, reinstalação ou bot. Bloqueio agressivo também pode excluir pessoas legítimas.

**Decisão D8 — nome correto da garantia:** emitir, para cada execução controlada de teste, um ID opaco aleatório de participante. Ele serve somente para o experimento e não identifica uma pessoa. O servidor deve emitir o token; não aceitar um ID escolhido pelo cliente como prova. Aplicar rate limit, expiração, detecção de automação e auditoria de contagem, mas declarar “um voto por token de teste” ou “resultado experimental”, nunca “um voto por pessoa”. Não transformar logs antifraude em perfil persistente.

### 9. Integridade do resultado e do analytics

Sem regras publicadas, a mesma base pode produzir números diferentes depois de excluir duplicatas, corrigir localização, moderar comentários ou alterar a métrica do grafo. Somar respostas individuais em grupos pequenos pode vazar escolhas. Um operador com acesso conjunto à identidade e aos votos pode remover ou inserir votos sem trilha verificável.

**Decisão D9 — contagem reproduzível:** documentar antes do teste a unidade de contagem, janela temporal, elegibilidade do token, tratamento de repetição, correções, exclusões, não resposta, arredondamento e versão do esquema. Manter eventos internos append-only ou trilha de auditoria protegida, com autorização por função e sem publicar o evento bruto. Gerar um read model agregado para o público. Registrar mudanças e recalcular totais de forma reproduzível; não editar silenciosamente o resultado.

**Decisão D10 — separação operacional:** não compartilhar o banco, chaves ou permissões do fluxo de identidade gov.br com o serviço de participação. O módulo público não deve receber CPF nem passkey. No futuro, se CPF+gov.br for avaliado, o serviço de identidade deverá ficar separado e entregar apenas uma prova mínima, de finalidade e enquete limitadas, sem revelar CPF ao serviço de opinião. Isso ainda exigirá análise de base legal, retenção, direitos do titular e risco de vinculação; não é uma consequência automática de integrar gov.br.

## Desenho mínimo recomendado para o protótipo

1. **Ideias/problemas:** texto moderado, categoria, estado e localização aproximada do problema. Endereço preciso só quando indispensável à operação e nunca como endereço do autor; não exibir coordenada fina por padrão.
2. **Mídia:** upload opcional em quarentena; limites pequenos antes da leitura; normalização para uma cópia pública; remoção de EXIF; revisão de faces, crianças, placas, documentos e doxxing; nenhum URL público para o original.
3. **Participação:** ID opaco aleatório por experimento, sem conta e sem CPF. O token não prova uma pessoa e não deve aparecer em páginas públicas. Explicar honestamente a proteção contra repetição disponível.
4. **Origem:** município/UF digitado ou selecionado voluntariamente. Sem GPS, endereço residencial, geolocalização por IP ou enriquecimento externo. Agregar e suprimir células pequenas; divulgar denominador, incerteza e viés de auto-seleção.
5. **Voto:** escolha separada de debate e localização. Publicar somente totais e método. Não publicar nome, pseudônimo, ID, hora ou conteúdo de voto por participante.
6. **Preferências:** sem inferência. Se houver coorte, a pessoa escolhe explicitamente responder, a pergunta e o rótulo ficam documentados, a resposta não é vinculada ao voto e grupos pequenos são suprimidos. Nada de ranking de candidato ideal ou propaganda personalizada.
7. **Grafo:** somente projetos/ideias e posições de autoridades públicas documentadas; métrica versionada, fontes e datas; tabela equivalente; incerteza e limitações visíveis. Não representar participantes individuais.
8. **Privacidade operacional:** aviso claro antes de cada finalidade, recusas sem penalidade, canal para acesso/correção/eliminação/oposição quando aplicável, retenção por classe de dado, descarte verificável e política de incidentes. Não enviar dados sensíveis a analytics de terceiros; minimizar logs e query strings.
9. **Acesso e segurança:** menor privilégio, contas administrativas separadas, MFA para quem acessar dados, auditoria de ações, chaves separadas, backups cifrados e restauração em ambiente isolado. A ANPD recomenda coletar apenas o necessário, restringir acesso por necessidade e usar medidas como pseudonimização quando dados sensíveis forem armazenados.[3]

## Gates antes de qualquer coleta pública

- Fechar inventário de dados, finalidades, agentes, operadores, compartilhamentos, retenção e canal de direitos. Cada campo deve ter uma finalidade; “pode ser útil depois” não é justificativa.
- Elaborar RIPD antes da abertura, incluindo voto, localização, texto, mídia, crianças, analytics, grafo e controles de reidentificação. A ANPD recomenda o RIPD antes do início quando o tratamento puder gerar alto risco e aponta dados sensíveis e dados de crianças como critérios relevantes de alto risco.[2]
- Executar testes de privacidade e integridade em ambiente separado: ausência de CPF na rede e no armazenamento, ausência de join público entre voto e localização, supressão de células pequenas, limpeza de EXIF, rejeição de mídia perigosa, impossibilidade de endpoint nominal e recomputação de totais.
- Fazer revisão humana de moderação, abuso e pedidos de retirada. Definir quem pode ver o original em quarentena, por quanto tempo e como a cópia é removida de backups e caches.
- Publicar a metodologia, as limitações de unicidade, a métrica do grafo, os denominadores e a política de correção. Não publicar enquanto a interface sugerir que checksum é identidade ou que totais agregados são representatividade populacional.
- Separar o futuro serviço de identidade do serviço de participação antes de considerar CPF+gov.br. Nenhum documento, biometria, senha gov.br ou login deve ser introduzido no protótipo atual.

## Decisões materiais resumidas

- **D1:** CPF opcional não vai à rede nem é gravado; checksum não é autenticação.
- **D2:** nenhuma união persistente entre participante, voto, origem, mídia e debate na superfície pública.
- **D3:** não inferir ideologia ou opinião política individual; não gerar perfil privado para persuasão.
- **D4:** grafo de projetos e posições públicas documentadas; coortes somente autodeclaradas, sem identificação, com grupos pequenos suprimidos e incerteza visível; tabela alternativa obrigatória.
- **D5:** município/UF voluntário e grosseiro; sem GPS, IP geográfico ou localização residencial do votante.
- **D6:** mídia em quarentena, EXIF removido, faces/crianças/placas/documentos protegidos, combate a doxxing e retirada disponível.
- **D7:** votos públicos como totais agregados, nunca nomes ligados às escolhas; confirmação privada.
- **D8:** ID opaco de participante de teste, com limites honestos; não prometer “uma pessoa, um voto”.
- **D9:** contagem, deduplicação, métrica e correções versionadas e auditáveis.
- **D10:** identidade futura e participação em serviços, chaves e permissões separados; CPF+gov.br não é etapa do protótipo.

Estas recomendações reduzem exposição e falsas garantias, mas não provam anonimato, segurança absoluta, representatividade ou conformidade jurídica por si sós. A decisão final de tratamento deve ser feita pelo controlador com responsável de privacidade e revisão jurídica especializada antes da coleta pública.

## Referências

[1]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm "Lei nº 13.709/2018 (LGPD), texto oficial"
[2]: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd "ANPD — Relatório de Impacto à Proteção de Dados Pessoais (RIPD)"
[3]: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte "ANPD — Guia orientativo sobre segurança da informação para agentes de tratamento de pequeno porte"
[4]: https://www.gov.br/anpd/pt-br/assuntos/noticias-periodo-eleitoral/aberta-tomada-de-subsidios-sobre-tratamento-de-dados-pessoais-de-criancas-e-adolescentes/2022.09.06_EstudoTcnicoCrianaseAdolescentes.pdf/@@display-file/file "ANPD — Estudo preliminar sobre tratamento de dados pessoais de crianças e adolescentes"
