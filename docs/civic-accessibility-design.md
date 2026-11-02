# Revisão independente de acessibilidade — Cívica

**Data da revisão:** 26 de outubro de 2026  
**Modo:** leitura do código e da documentação, somente leitura; nenhum código foi alterado, nenhum navegador compartilhado foi aberto e nenhum dado pessoal, segredo ou banco foi acessado.

O principal risco de escopo é material: o repositório atual ainda é um piloto de identidade, passkey e vinculação manual. As rotas existentes são `/`, `/acesso`, `/conta`, `/vinculacao`, `/revisao` e `/privacidade`; não encontrei fluxos públicos de sugestão, endereço, foto, debate, voto, mapa ou analytics. A própria página inicial informa que enquetes ainda não fazem parte do piloto. Portanto, esta revisão não afirma que o produto pedido já exista nem inventa uma avaliação de telas ausentes. Os critérios abaixo são a porta de entrada para o futuro produto público, e os achados do código atual são separados dos requisitos ainda não implementados.

## Critério de aceite: acessível de forma verificável, sem prometer perfeição

A meta de lançamento deve ser **WCAG 2.2 nível AA para cada página, estado e fluxo incluído no escopo**, isto é, todos os critérios A e AA aplicáveis, com tecnologias de acessibilidade suportadas. O escopo precisa nomear, no mínimo: página inicial, busca/lista e detalhe de sugestão, criação de sugestão, upload de foto, localização, debate, voto, confirmação, resultados/analytics, alternativa de mapa/grafo, estados vazios, erro, carregamento, sucesso, modal e sessão sem conta.

Isso é um critério testável, não uma garantia de acessibilidade perfeita. O próprio WAI explica que ferramentas não conseguem verificar todos os aspectos, podem produzir resultados incorretos e apenas ajudam a avaliação; julgamento humano continua necessário [25]. A metodologia WCAG-EM recomenda definir o escopo, explorar os ativos, selecionar amostra representativa, avaliar e relatar, além de envolver usuários reais com deficiência [26]. Mesmo uma página conforme o mínimo pode continuar inacessível para algumas pessoas; WCAG deve ser um piso, não uma promessa de que toda pessoa conseguirá usar tudo [8].

A liberação deve exigir, para cada fluxo essencial:

- zero defeitos críticos que impeçam completar a tarefa com teclado, leitor de tela, zoom/reflow ou sem visão;
- zero violação conhecida de WCAG 2.2 A/AA no escopo, salvo exceção documentada, com alternativa equivalente e decisão explícita de risco;
- revisão automatizada e testes Playwright como triagem, revisão manual por teclado/zoom/contraste e execução real com **NVDA** e **VoiceOver** em combinações de navegador suportadas;
- testes moderados com pessoas cegas ou com baixa visão, pessoas idosas, pessoas com baixa alfabetização e usuários de teclado/voz. Crianças só entram em pesquisa com protocolo de proteção, responsável e assentimento adequados;
- um relatório por fluxo que registre navegador, sistema operacional, tecnologia assistiva, passos, resultado, evidência e limitações. “axe passou” ou “o Lighthouse deu nota alta” não é critério de aceite isolado.

## Achados materiais no código atual

### 1. O produto descrito ainda não está no código — bloqueador de escopo

O Cívica atual não permite validar a acessibilidade de uma plataforma de participação pública porque os fluxos públicos pedidos ainda não estão presentes. Não há como declarar conformidade para voto, debate, foto, mapa, analytics ou grafo 3D sem páginas e estados reais. Antes de qualquer revisão final, o time deve produzir uma matriz de rotas e estados e incluir esses fluxos no escopo WCAG-EM.

### 2. Não há skip link no shell — barreira relevante para teclado e leitor de tela

`SiteShell.tsx` começa pela marca e pela navegação e depois renderiza o conteúdo. Não há link “Pular para o conteúdo principal” antes da navegação. Em páginas longas, a pessoa que navega por teclado ou leitor de tela precisa atravessar repetidamente o cabeçalho. O produto público deve ter um skip link como primeiro foco visível e um destino único no `main`; também deve manter landmarks (`header`, `nav`, `main`, `footer`) consistentes.

### 3. O indicador de foco declarado está abaixo de 3:1 no fundo principal — provável falha AA

O CSS define `outline: 3px solid #b78b34` sobre o fundo `#f5f3ed`. O contraste calculado é **2,80:1**. WCAG 2.2 exige 3:1 para a informação visual necessária para identificar controles e estados, inclusive foco [22], além de exigir foco visível [11]. É um achado estático; a confirmação final deve medir todos os fundos e estados renderizados, inclusive botões teal, cartões, overlays e foco dentro de modais. O critério de desenvolvimento deve exigir um indicador persistente, espesso e distinguível em cada estado, sem depender só de mudança de cor.

### 4. Navegação móvel com rolagem horizontal — risco de descoberta e zoom

No breakpoint de 760 px, `.topnav` usa `overflow-x: auto`. Isso pode ser aceitável para um conjunto secundário em alguns contextos, mas é uma barreira provável para pessoas idosas, com baixa visão ou que aumentem muito o zoom se a navegação essencial ficar parcialmente escondida. A versão pública deve expor todos os destinos essenciais sem exigir descobrir rolagem horizontal; no teste de 400% a página não pode perder informação nem função e, fora exceções justificadas como mapas e tabelas, não pode exigir rolagem em duas dimensões [14].

### 5. Estados de acesso dependem de classe visual, sem estado semântico explícito

Em `Access.tsx`, “Entrar” e “Cadastrar” são dois botões dentro de `role="group"`; o botão escolhido recebe apenas a classe visual `selected`. Para tecnologia assistiva, a seleção atual não está explicitamente exposta como estado. Usar um `fieldset`/`legend` com radios nativos é a opção mais simples; se forem botões alternáveis, cada um precisa expor nome, papel, estado e mudança de estado. WCAG 4.1.2 exige que isso seja determinável e atualizável por tecnologia assistiva [9]. O mesmo cuidado será necessário para filtros, voto selecionado, marcadores e controles do analytics.

### 6. Erros e sucessos existem, mas a associação e o foco ainda não estão comprovados

O código usa `role="alert"` para erros e `role="status"` para mensagens, o que é uma boa direção. Porém, no fluxo de upload, não há associação explícita entre o erro e o campo que o causou, nem resumo de erros com links para os campos, nem gerenciamento de foco visível para a primeira falha. WAI recomenda identificar o campo em texto, explicar como corrigir, listar erros no topo quando útil, ligar cada item ao campo e associar a mensagem ao controle [5] [17] [18]. Isso deve ser testado com NVDA e VoiceOver, não inferido apenas pelo DOM.

## Requisitos essenciais para o produto público

### Estrutura, foco e navegação

Cada página deve ter título único e descritivo, um `h1` claro, headings em hierarquia lógica e landmarks previsíveis. Os headings devem dizer o assunto da seção, não apenas “Detalhes” ou “Opções”; headings e labels descritivos ajudam especialmente pessoas com limitações visuais, cognitivas e de memória [24]. O conteúdo principal deve ser alcançável por skip link. Mudanças de rota devem anunciar título/heading e colocar foco em um destino lógico sem devolver a pessoa ao topo de forma inesperada.

Toda função precisa ser operável por teclado, sem depender de arrastar, apontar, gesto ou tempo entre teclas [10]. O Tab deve seguir a ordem da tarefa: escolher tipo de sugestão, descrever, localizar, anexar, revisar e publicar. Não pode haver foco em elemento sem função, foco duplicado em wrappers e nem armadilha de teclado. Modais devem receber foco, conter o foco enquanto abertos, fechar por botão e, quando apropriado, Escape, e devolver foco ao acionador.

O foco deve permanecer visível e não ser totalmente ocultado por cabeçalho, rodapé fixo, aviso, chat ou banner. WCAG 2.2 trata especificamente conteúdo autoral que cobre o componente focado [13]. Testar Tab/Shift+Tab com banners abertos, zoom de 200% e 400%, viewport estreito e teclado virtual.

### Formulário de sugestão como wizard curto e previsível

Não transformar uma denúncia em um formulário longo de uma só vez. Dividir em etapas lógicas: **o que aconteceu**, **onde**, **evidência opcional**, **revisar e publicar**. Repetir instruções essenciais em cada etapa, indicar “Etapa 2 de 4” no título da página e no `h1`, marcar etapa atual e concluídas programaticamente, preservar o que já foi digitado e permitir voltar sem apagar dados. O tutorial WAI recomenda dividir formulários longos, agrupar controles logicamente, informar progresso, destacar etapas opcionais e evitar limite de tempo [3].

Cada campo deve ter label visível, nome programático correspondente, instrução curta e indicação explícita de obrigatório/opcional. Não usar apenas placeholder como label. Para endereço, aceitar formatos locais e alternativas ao mapa: rua, número, bairro, referência, CEP opcional e localização aproximada. Não obrigar uma precisão que possa revelar a residência de uma pessoa. Para fotos, informar formatos, tamanho, quantidade, finalidade e retenção antes da seleção.

Antes de publicar, mostrar uma revisão em linguagem simples: categoria, texto, endereço ou área escolhida, fotos/áudios anexados, visibilidade pública e o efeito da publicação. Exigir uma ação final inequívoca, por exemplo “Publicar esta sugestão”, separada de “Voltar e corrigir”. Depois, informar sucesso e identificador em texto; oferecer desfazer/retirar quando a política permitir. O guia de validação recomenda confirmação, revisão/correção e undo para ações importantes [4]. Mesmo quando a publicação não for uma transação legal, esse é o padrão de segurança apropriado para voto e participação pública.

### Erros, carregamento e regiões ao vivo

No envio inválido, o topo deve anunciar “Há X erros”, listar cada campo pelo label, explicar o problema em palavras simples, dar exemplo do formato correto e oferecer link para o campo. O campo deve receber estado inválido e descrição associada; o foco pode ir ao resumo ou ao primeiro erro, desde que o restante seja descobrível e o retorno seja previsível. Não depender de vermelho, ícone ou borda.

Mensagens de sucesso, falha, “salvando”, “upload concluído” e “N resultados” devem ser texto, visíveis e programaticamente anunciáveis sem deslocar o foco quando não houver mudança de contexto. WCAG 4.1.3 cobre exatamente mensagens de status que aparecem sem receber foco [16]. Usar `status`/região polida para mudanças não urgentes e alerta somente para erro que exija atenção imediata; não anunciar cada tecla nem interromper a leitura continuamente.

### Linguagem, baixa alfabetização e decisão consciente

Usar frases curtas, palavras comuns, uma instrução por vez, exemplos concretos e verbos de ação. Explicar “público” como “qualquer pessoa poderá ver”, “área aproximada” como “o local será arredondado” e “voto” como “registrar seu apoio nesta opção”. Evitar metáforas, siglas sem explicação e microcopy que dependa de conhecimento cívico prévio. O guia cognitivo do W3C recomenda linguagem clara, pequenos blocos, relações visíveis entre controle e conteúdo, ajuda para evitar erros e explicação das consequências [6].

Oferecer leitura em voz alta ou versão falada como complemento, sem remover o texto e sem exigir áudio. Texto e alternativas devem usar o idioma da página e não colocar informação essencial apenas em ícone, mapa, cor ou áudio. WCAG reconhece que texto alternativo pode ser renderizado visualmente, em áudio ou de forma tátil [8]; a orientação de nível AAA sobre leitura fácil é uma boa meta de qualidade para o público geral, mas não deve ser apresentada como se fosse requisito AA [28].

### Contraste, zoom, reflow e alvos

Adotar como mínimos verificáveis:

- texto normal em contraste de pelo menos 4,5:1 e texto grande em 3:1 [20];
- bordas/estados de controles, foco e partes significativas de gráficos em pelo menos 3:1 [22];
- nenhuma informação transmitida somente por cor; usar texto, forma, padrão ou posição além da cor;
- texto ampliável a 200% sem recorte, sobreposição ou perda de função [21];
- página funcional a 400% no equivalente a 320 CSS px de largura, com rolagem em apenas um eixo para conteúdo comum; mapas, gráficos complexos e tabelas podem ser exceções de duas dimensões, mas continuam obrigados a oferecer alternativa compreensível [14];
- espaçamento de texto aumentado segundo WCAG 1.4.12 sem perda de conteúdo, e sem depender de tamanho fixo que quebre controles;
- alvo mínimo WCAG de 24 por 24 CSS px ou espaçamento equivalente [15]. Como requisito de produto para idosos e pessoas com tremor, usar **44 por 44 CSS px como meta para controles primários**, com margem entre ações destrutivas, sem alegar que 44 é o limiar normativo WCAG;
- tamanho, estado e limite do upload informados também em texto; botão de arquivo não pode ser apenas um ícone.

### Fotos, endereço, upload e alternativas

O upload deve usar controle nativo ou equivalente com nome acessível, aceitar somente os tipos necessários, validar no cliente e no servidor, indicar progresso e permitir cancelar/remover antes de publicar. A miniatura precisa ter alternativa textual; a foto publicada deve poder receber uma descrição curta do que é relevante para entender o problema. WAI exige texto alternativo para imagens e alternativa longa/estruturada para conteúdo complexo [7] [8].

Não capturar geolocalização automaticamente como pré-requisito. Se houver permissão do navegador, explicar antes a finalidade, mostrar o resultado e permitir ajustar, arredondar ou remover o endereço. A localização exata de uma casa, escola ou criança pode ser informação sensível; o padrão seguro é não compartilhar mais precisão do que a tarefa necessita.

### Mapas e grafo 3D: opt-in, nunca única forma de compreender

O mapa deve ser uma melhoria opcional, não a única maneira de escolher ou entender um local. Sempre existir uma lista pesquisável de ocorrências e um formulário textual de endereço/área. Cada marcador precisa ter nome acessível, estado e destino; os controles de zoom, camadas e filtros devem funcionar pelo teclado. Um mapa complexo precisa de descrição curta e descrição longa com a informação essencial; o WAI lista mapas, gráficos e diagramas como imagens complexas que exigem alternativa textual [7].

Analytics deve mostrar, junto do gráfico, um resumo textual de tendência, período, unidade, fonte, data de atualização e limitações. Oferecer uma tabela de dados com caption, cabeçalhos, unidades e a mesma informação do gráfico; no mobile, permitir leitura por linhas/cartões sem esconder dados. O grafo 3D deve ser opt-in e nunca bloquear a tabela, lista ou resumo. Se houver pontos, nós ou relações interativas, expor uma lista navegável e uma forma de buscar por nome/status, não exigir que a pessoa compreenda profundidade, cor ou movimento. Para mapas e visualizações densas, a exceção de alvo pequeno só é aceitável quando a posição é essencial; o próprio W3C recomenda funcionalidade equivalente por outro meio [15].

### Debate, voto e feedback público

Cada voto deve ser um controle nomeado com ação e estado explícitos: “Apoiar proposta X”, “Apoio registrado” ou “Retirar meu apoio”. Não usar apenas ícone de coração, cor ou contador. Desabilitar repetição durante o envio, anunciar o resultado, informar se o voto pode ser alterado e mostrar confirmação antes de registrar ações irreversíveis ou socialmente significativas. O fluxo deve funcionar sem conta, mas “sem conta” não pode significar sem feedback, sem proteção contra duplo clique ou sem possibilidade de corrigir uma ativação acidental.

Comentários devem ter heading ou nome do tópico, autor/apelido, data, conteúdo e ações com nomes completos. Filtros, ordenação e “carregar mais” devem comunicar a mudança sem mover foco; não usar scroll infinito como única forma de alcançar debates antigos. Conteúdo moderado, removido ou fechado precisa de estado textual claro. Caso a plataforma permita editar/remover, explicar consequência e oferecer confirmação/undo quando possível. O princípio de confirmação/correção do WCAG 3.3.4 é obrigatório para dados importantes nos casos que ele cobre e é uma recomendação prudente para publicar/votar [19].

## Voz, leitura e risco de terceiros

A entrada por voz pode ajudar pessoas com baixa destreza, baixa alfabetização ou dificuldade de digitação, mas não deve substituir teclado, texto e leitura por tecnologia assistiva. Preferir a ditagem nativa do sistema ou processamento local quando possível. Se o produto gravar áudio ou enviar áudio para um fornecedor de transcrição, deve:

- pedir ação explícita e contextual, informando quem processa, para quê, por quanto tempo, onde fica, quem recebe e como apagar;
- começar desligado, indicar claramente “gravando”, permitir pausar/parar, ouvir ou ler o resultado, editar a transcrição e excluir o áudio antes da publicação;
- não publicar transcrição automática sem revisão humana do usuário; distinguir texto digitado de texto transcrito;
- oferecer o mesmo fluxo em texto e não bloquear a participação se microfone, navegador ou serviço de voz falhar;
- evitar nomes, endereços residenciais, documentos e outras informações desnecessárias no áudio;
- não fazer “entrevista” gravada por padrão. Pesquisa ou entrevista deve ter finalidade, roteiro, consentimento separado do uso do produto, retirada possível e opção de responder por texto;
- não enviar áudio de menores a terceiros por conveniência. Para crianças, o risco inclui identificação por voz, nome, escola, rotina, endereço, contexto familiar e reutilização do áudio para treino ou outros fins. O consentimento precisa ser compreensível, informado e reversível; a participação da criança deve ser voluntária e não condicionada à gravação. Se a finalidade não for indispensável, não coletar áudio.

Os Princípios de Privacidade do W3C dizem que consentimento deve ser informado, raro, intencional, temporário e revogável; que não se deve pedir consentimento quando a pessoa não tem informação suficiente para decidir; e que grupos vulneráveis, inclusive crianças e idosos, exigem consideração no desenho [27]. Isso reforça uma decisão de produto: voz é canal opcional, não atalho para coletar mais dados.

## Plano mínimo de testes por fluxo

1. **Descobrir e ler:** abrir cada rota com zoom padrão, 200% e 400%; validar título, `h1`, landmarks, skip link, headings, idioma e ausência de texto cortado.
2. **Teclado:** usar apenas Tab, Shift+Tab, Enter, Espaço, setas e Escape; completar busca, filtro, sugestão, upload, revisão, voto, debate, tabela e alternativa do mapa. Registrar ordem, foco visível, foco coberto, armadilhas e retorno após modal.
3. **Formulário:** deixar cada obrigatório vazio, inserir formato inválido, recusar localização/microfone, interromper upload e perder/recarregar conexão. Confirmar resumo de erros, links para campos, instruções, foco e preservação dos dados.
4. **Leitor de tela real:** repetir os fluxos com NVDA e navegador suportado no Windows e VoiceOver/Safari em macOS ou iOS. Confirmar nome, papel, valor, estado selecionado, progresso, upload, tabela, status, erro, diálogo e confirmação. Testar leitura por headings, landmarks e links.
5. **Baixa visão/idosos:** contraste e foco sobre todos os fundos; 200%/400%; texto ampliado; alvos primários de 44 px; ausência de dependência de cor; fotos e mapas com alternativa.
6. **Analytics:** desligar CSS/visualização ou usar leitor de tela; ainda assim localizar todos os projetos, números, unidades, período, tendência, fonte e data por texto/tabela. Ativar o grafo somente depois de entender o resumo.
7. **Voz e áudio:** recusar permissão, parar no meio, corrigir uma transcrição, apagar antes do envio e verificar exatamente qual aviso de compartilhamento é anunciado e lido. Não usar voz real de criança em teste de desenvolvimento.
8. **Usuários reais:** observar se a pessoa entende o que será público, qual ação o botão executa, qual opção está selecionada, onde está o erro e se o voto/publicação foi concluído. Registrar abandono e erro de interpretação, não apenas sucesso técnico.

## O que axe e Playwright cobrem — e o que não cobrem

**axe ou outra ferramenta automatizada** é apropriada para encontrar parte de nomes/labels ausentes, roles inválidos, IDs duplicados, contraste em pares estáticos, alguns estados ARIA, imagens sem `alt` e problemas estruturais. Isso reduz regressões, mas não prova que o label é compreensível, que o heading descreve o conteúdo, que o foco aparece em todos os fundos, que o mapa tem uma alternativa equivalente, que a confirmação é consciente, que a ordem faz sentido para a tarefa ou que uma pessoa de baixa alfabetização entendeu a consequência.

**Playwright** é apropriado para repetir rotas, estados de erro/sucesso, Tab/Shift+Tab, foco após ações, mensagens no DOM, upload, responsividade, ausência de overflow conhecido e checks de contrato. Ele não reproduz a experiência completa de NVDA ou VoiceOver, não valida fala, braille, pronúncia, carga cognitiva, compreensão de linguagem, uso real por voz, uso de mapa sem visão ou percepção de foco por uma pessoa com baixa visão. Um teste DOM verde também pode acompanhar uma experiência de leitor de tela quebrada.

**NVDA e VoiceOver reais** expõem problemas que só aparecem no anúncio e na navegação por árvore: nome errado, estado não anunciado, foco devolvido ao lugar errado, live region excessiva ou silenciosa, tabela ilegível e conteúdo visual sem equivalente. Ainda assim, cada combinação é uma amostra; versões, navegador, sistema operacional e configurações mudam o resultado. Por isso, a evidência adequada é a combinação de automatizado, Playwright, revisão manual e usuários reais — não a substituição de um pelo outro.

Não foram executados axe, Playwright de acessibilidade, NVDA ou VoiceOver nesta revisão. O relatório atual é uma revisão estática do código e uma especificação de aceite; não deve ser apresentado como auditoria WCAG concluída.

## Recomendações essenciais e ordem de trabalho

1. Corrigir o escopo do produto: modelar as rotas e estados públicos de sugestão, localização, foto, debate, voto e analytics antes de declarar qualquer nível de conformidade.
2. No shell, incluir skip link, títulos de rota, landmarks, foco de navegação e alternativa à rolagem horizontal essencial.
3. Corrigir e medir o indicador de foco; o valor atual de 2,80:1 sobre o fundo principal é insuficiente como ponto de partida.
4. Padronizar controles nativos, labels visíveis, grupos (`fieldset`/`legend` quando apropriado), estados semânticos e associação de ajuda/erro.
5. Construir o wizard com progresso anunciado, salvamento, revisão completa e publicação/voto conscientes, além de resumo de erros e status.
6. Projetar mapa e grafo 3D como aprimoramentos opcionais sobre lista, texto, tabela e resumo equivalentes.
7. Definir uma política de fotos, endereço, áudio e dados de menores antes de habilitar upload ou voz; minimização e apagamento devem existir no produto, não só no texto de privacidade.
8. Adicionar gates de axe/Playwright, roteiros manuais e sessões reais com NVDA/VoiceOver e usuários representativos. Reavaliar a cada mudança de componentes, conteúdo, navegador suportado ou fornecedor de voz.

## References

[1]: https://www.w3.org/WAI/WCAG22/quickref/ "How to Meet WCAG 2.2: Quick Reference"
[2]: https://www.w3.org/WAI/tutorials/forms/ "Forms Tutorial"
[3]: https://www.w3.org/WAI/tutorials/forms/multi-page/ "Multi-page Forms"
[4]: https://www.w3.org/WAI/tutorials/forms/validation/ "Validating Input"
[5]: https://www.w3.org/WAI/tutorials/forms/notifications/ "User Notification"
[6]: https://www.w3.org/TR/coga-usable/ "Making Content Usable for People with Cognitive and Learning Disabilities"
[7]: https://www.w3.org/WAI/tutorials/images/complex/ "Complex Images"
[8]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-content "Understanding Success Criterion 1.1.1: Non-text Content"
[9]: https://www.w3.org/WAI/WCAG22/Understanding/name-role-value "Understanding Success Criterion 4.1.2: Name, Role, Value"
[10]: https://www.w3.org/WAI/WCAG22/Understanding/keyboard "Understanding Success Criterion 2.1.1: Keyboard"
[11]: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible "Understanding Success Criterion 2.4.7: Focus Visible"
[12]: https://www.w3.org/WAI/WCAG22/Understanding/focus-order "Understanding Success Criterion 2.4.3: Focus Order"
[13]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum "Understanding Success Criterion 2.4.11: Focus Not Obscured (Minimum)"
[14]: https://www.w3.org/WAI/WCAG22/Understanding/reflow "Understanding Success Criterion 1.4.10: Reflow"
[15]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum "Understanding Success Criterion 2.5.8: Target Size (Minimum)"
[16]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages "Understanding Success Criterion 4.1.3: Status Messages"
[17]: https://www.w3.org/WAI/WCAG22/Understanding/error-identification "Understanding Success Criterion 3.3.1: Error Identification"
[18]: https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion "Understanding Success Criterion 3.3.3: Error Suggestion"
[19]: https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data "Understanding Success Criterion 3.3.4: Error Prevention (Legal, Financial, Data)"
[20]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum "Understanding Success Criterion 1.4.3: Contrast (Minimum)"
[21]: https://www.w3.org/WAI/WCAG22/Understanding/resize-text "Understanding Success Criterion 1.4.4: Resize Text"
[22]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast "Understanding Success Criterion 1.4.11: Non-text Contrast"
[23]: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions "Understanding Success Criterion 3.3.2: Labels or Instructions"
[24]: https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels "Understanding Success Criterion 2.4.6: Headings and Labels"
[25]: https://www.w3.org/WAI/test-evaluate/tools/selecting/ "Selecting Web Accessibility Evaluation Tools"
[26]: https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/ "WCAG-EM Overview: WCAG Evaluation Methodology"
[27]: https://www.w3.org/TR/privacy-principles/ "Privacy Principles"
[28]: https://www.w3.org/WAI/WCAG22/Understanding/reading-level "Understanding Success Criterion 3.1.5: Reading Level"
