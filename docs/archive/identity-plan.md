# Cívica — plano do piloto de conta e identidade

Status: aprovado pelo usuário em 26/10/2026 às 00h05. A implementação inteira seguirá TDD (teste falhando, implementação mínima, refatoração); o plano não é comprovação de um sistema executado. Cívica é um nome provisório. Esta etapa implementa a conta e a vinculação inicial acordadas; o módulo de enquetes será a próxima etapa, sem resultados ou participantes de demonstração inventados.

## Escopo desta etapa

Entregar cadastro e acesso por passkey do próprio site, sem exigir conta Manus; conta persistente; geração de documento de vinculação para assinatura no portal oficial gov.br; submissão privada do PDF assinado; conferência manual e registro da decisão; consulta do estado da vinculação; gestão de passkeys e encerramento de sessão. A pessoa usa sua conta gov.br prata/ouro no portal oficial, nunca informa senha gov.br ao site e não assina a cada acesso.

O exemplo é real, inicialmente restrito ao próprio usuário. Não criar CPFs, perfis, assinaturas válidas, aprovações, enquetes ou resultados fictícios para aparentar funcionamento. Testes automatizados exercitam regras e entradas adversariais em isolamento; não substituem a cerimônia real de passkey ou a conferência real de uma assinatura. A validação positiva completa dependerá das ações do usuário em seu dispositivo. Não solicitar documentos pessoais no chat.

P2P, reconhecimento facial no site, Login Único gov.br, inferência de opinião por IA e qualquer ponderação tecnocrática de votos estão fora desta etapa. A assinatura prova autoria sob uma credencial aceita, não presença facial atual. Não garantir uma pessoa por CPF enquanto a identificação verificável do signatário e sua regra de unicidade não forem demonstradas no piloto.

## Implementação e estrutura

Reutilizar React/TypeScript/Vite no navegador, Express no servidor e MySQL gerenciado. O container usa Node 22; adotar as bibliotecas @simplewebauthn/server e @simplewebauthn/browser em versões fixadas e compatíveis. Não implementar primitivas WebAuthn manualmente. Usar biblioteca consolidada de geração de PDF para um documento simples, sem JavaScript, imagens externas ou outros recursos ativos. A implementação fixou pnpm 10.34.5 em lugar do 10.18.0 do modelo inicial, preservando instalação por lockfile congelado e permissões restritas de scripts.

As regras do domínio não importam Express, Drizzle, SDK Manus, PDF nem SimpleWebAuthn. Casos de uso dependem de portas; adaptadores implementam essas portas. A conta possui identificador interno aleatório independente do provedor. Substituir integração de identidade exige vinculação autenticada e unicidade, não apenas mudar o botão de login.

- `server/domain/`: conta, estados de vinculação, expiração e invariantes.
- `server/application/`: casos de uso de cadastro, login, gerenciamento de chaves e vinculação.
- `server/ports/`: contratos de repositório, autenticação, sessão, documento e decisão manual.
- `server/adapters/`: SimpleWebAuthn, repositórios MySQL, geração de PDF e verificação manual gov.br.
- `server/http/`: endpoints, validação de entrada, proteção de origem, limites e autenticação.
- `client/src/pages/` e `client/src/components/`: acesso, conta, vinculação, status e revisão administrativa.
- `drizzle/`: migrações SQL versionadas; manter migração inicial existente, sem exclusões destrutivas. O piloto usa uma linha JSON MySQL com transação serializada e limite de 8 MiB, não um ORM nem armazenamento escalável de participantes. Limite operacional: duas contas no máximo, para titular e eventual operador.
- `tests/` e `scripts/`: testes isolados, verificações locais, exportação e restauração.

Remover o uso de OAuth Manus dos fluxos da aplicação, do contexto de autenticação e dos callbacks expostos. Nenhum cookie automático do Preview pode criar conta, sessão ou privilégio. A visibilidade da plataforma é separada da autenticação do site. O código atual é apenas o modelo inicial e não deve receber identidade real antes dessa remoção: bloquear callbacks antigos, emissão de tokens do modelo, autenticação por Bearer herdada e elevação automática por OWNER_OPEN_ID. Não usar localStorage ou sessionStorage para tokens ou cópias de identidade. Remover ou desabilitar caminhos herdados de upload público e o limite global de 50 MiB; aplicar limites pequenos específicos antes de ler os corpos.

## Cadastro e acesso posterior

O cadastro começa com um apelido público, sem coletar CPF em campo livre. Gerar identificador de usuário WebAuthn opaco e aleatório. A conta inicial fica não vinculada e não recebe privilégios de participação verificada. Para limitar abuso, o piloto terá admissão controlada por convite de uso único, sem permitir cadastro irrestrito nem conceder papel administrativo no formulário.

Desafios WebAuthn ficam no servidor, vinculados a um contexto de navegador, tipo de operação e conta quando aplicável. Expiram em cinco minutos e são consumidos atomicamente, inclusive após tentativa inválida; repetição ou concorrência não pode criar duas contas/chaves/sessões. Exigir verificação local de usuário e credencial descobrível; validar assinatura, desafio, origem esperada e RP ID. Guardar somente chave pública, identificador de credencial, dados de transporte e metadados necessários; não biometria nem chave privada. Tratar contadores conforme a biblioteca, inclusive chaves sincronizadas com contador zero.

Usar sessões opacas aleatórias, com apenas resumo criptográfico do token na base, expiração absoluta, expiração por inatividade e revogação no logout. Cookies HttpOnly, Secure e SameSite=None para HTTPS Preview; compensar com verificação de origem e proteção CSRF em mudanças de estado. Não armazenar sessão em localStorage. Em HTTP local permitido apenas para testes, manter configuração separada e explícita, sem inferir HTTPS pelo host interno do proxy.

Operações de inclusão ou exclusão de passkey e administração exigem autenticação recente. Permitir uma segunda passkey e impedir remoção da última. Antes da submissão real do documento, exigir uma segunda credencial cadastrada e teste de acesso por ela; informar que duas credenciais no mesmo dispositivo ou sincronizadas no mesmo provedor não eliminam o risco de perda conjunta. Não adicionar recuperação por e-mail, CPF informado ou decisão administrativa silenciosa nesta etapa. A perda de todas as chaves pode bloquear o acesso. Recuperação civil será projetada separadamente, sem criar outra conta verificada para a mesma pessoa.

## Origem e portabilidade

RP ID e origens permitidas são configuração explícita do operador, nunca aceitos arbitrariamente a partir de input do navegador, cabeçalho Host ou domínio universal. Passkeys são vinculadas ao domínio: mover hospedagem preservando o domínio é diferente de mudar o domínio. Não prometer que credenciais do Preview funcionam automaticamente no domínio publicado. A interface deve informar quando for necessário cadastrar uma chave no domínio final mediante vinculação autenticada, antes da mudança. Não enfraquecer a verificação de origem para contornar limitações do Preview.

A cerimônia no dispositivo pode não funcionar no iframe do Preview. Nesse caso manter o fluxo real e usar abertura de topo autorizada pela plataforma; não simular autenticação nem escolher novo RP ID por conveniência.

## Documento e revisão manual

Gerar documento com finalidade restrita à vinculação da conta, nome do site, identificador opaco da conta, resumo da chave pública vinculada, desafio aleatório exclusivo, data de emissão e validade de 24 horas. Não incluir cessão de direitos, procuração ou autorização genérica. O participante revisa e assina no portal oficial; baixa o PDF digital assinado, não foto, screenshot ou impressão.

A submissão autenticada limita tamanho a 2 MiB e recebe o PDF como conteúdo não confiável. Não executar, renderizar embutido nem extrair conteúdo complexo no servidor. Guardar uma única evidência pendente por desafio, calcular resumo do arquivo e cifrar seu conteúdo antes de persistir. Usar AES-256-GCM por biblioteca nativa, com nonce único e dados autenticados, chave específica mantida fora do banco/repositório e identificador de versão da chave. Não usar armazenamento de assets com URLs públicas.

O administrador baixa o arquivo por endpoint autenticado, com resposta privada/no-store e attachment, e faz a conferência no VALIDAR oficial. Confere assinatura reconhecida, integridade, identidade do signatário, conteúdo efetivamente assinado, conta/chave/desafio e validade. Relatório ou resultado declarado pelo participante não autoriza aprovação. Resultado inválido, indeterminado ou sem identificação verificável permanece não aprovado. Não automatizar ou raspar o portal como se fosse API livre.

A decisão registra operador, horário, SHA-256 dos bytes exatos do PDF, resultado de conformidade conferido pelo operador, origem da assinatura reconhecida, confirmação de conteúdo coberto, desafio, conta e resumo da chave vinculada. Registrar referência/versão do relatório oficial quando disponível, sem publicar nem duplicar dados pessoais desnecessários. Separar estados: assinatura conferida, identidade identificável, unicidade civil demonstrada e revisão independente. Não transformar simples assinatura válida em CPF confiável. Rejeição não implica que o cidadão cometeu fraude. Aprovação e consumo do desafio são uma transação; replay, conflito ou decisão concorrente falham. A vinculação será rotulada como verificação manual, não como reconhecimento facial ou login gov.br.

Quando o piloto demonstrar um CPF autenticado na evidência, manter apenas índice pseudônimo com HMAC e chave própria para unicidade, além da evidência mínima necessária. HMAC não é anonimização; não usar hash simples de CPF. Não coletar campos do certificado sem finalidade. Rotação e eventual mudança de provedor não podem apagar a regra de unicidade. Se não houver identificador suficiente, não conceder status que prometa unicidade civil.

O papel administrativo será atribuído por bootstrap controlado, de uso único e indisponível por cadastro público. Não inferir administrador do primeiro usuário, nome, e-mail ou cookie Manus. No piloto do próprio titular, revisão feita por ele não será apresentada como conferência independente. Os agentes revisam código e segurança; não atestam identidade civil.

## Limites de isolamento e dados reais

Arquitetura Onion e autorização por endpoint não fornecem isolamento operacional. Neste piloto de usuário único, autenticação e identidade podem compartilhar o processo e o banco gerenciado, com criptografia e controle de acesso; isso deixa risco de comprometimento integral do processo. Não abrir coleta de documentos da comunidade sob alegação de isolamento completo. Antes de ampliar, separar serviço de identidade, credenciais de banco, chaves e permissões da infraestrutura de enquetes, e avaliar base legal, retenção, operadores, recuperação e resposta a incidentes.

Nenhum documento, CPF, token ou conteúdo de assinatura vai a logs, analytics, repositório, URLs públicas, mensagens de erro, modelos de IA ou relatórios de testes. Não adicionar analytics de terceiros nas páginas de conta e identidade. O documento assinado não contém opiniões ou respostas a enquetes. Retenção proposta do PDF cifrado: até sete dias após a decisão; descarte pelo processo de retenção ou ação autenticada do operador, preservando apenas registro mínimo da decisão conforme finalidade e base legal a confirmar. Não prometer eliminação imediata de cópias em backups ou no serviço oficial de validação. O piloto informará essas condições antes da submissão real.

Segredos ausentes bloqueiam upload, aprovação e recursos dependentes; não derivar chaves de proteção de CPF/documento a partir de segredo de sessão Manus. Configurar valores pela interface protegida de segredos, sem pedir que sejam colados em chat. Não publicar coleta real antes de confirmar que as chaves necessárias e controles estão ativos.

## Qualidade, revisão e recuperação

Cada lote de código deve passar por diagnósticos TypeScript, lint, testes, build e análise de dependências. Os testes incluem rejeição de desafio expirado/reutilizado, origem e RP ID incorretos, ausência de verificação de usuário, credencial desconhecida, CSRF, autorização por conta e por papel, limites de upload, estados de decisão e conflitos simultâneos. Medir as invariantes e resultados; cobertura de linhas não comprova segurança. Usar apenas ambientes temporários isolados para testes adversariais e de concorrência, sem acesso ao DATABASE_URL gerenciado nem à identidade real do usuário.

O isolamento de testes precisa ser executável: o processo de testes não recebe segredos de identidade nem o DATABASE_URL gerenciado, e o adaptador de testes só aceita TEST_DATABASE_URL de um banco temporário explicitamente permitido. Abortar se houver referência ao banco compartilhado ou tentativa de carregar evidência real; demonstrar essa recusa por teste. Separar modo de verificação positiva com o próprio usuário de execução de testes adversariais. Uma inspeção ou um arquivo de configuração não comprovam isolamento.

Solicitar uma revisão crítica independente do plano e uma revisão read-only da implementação. Corrigir falhas materiais e verificar os caminhos afetados. As revisões por agentes não equivalem a auditoria humana especializada. Testes e ataques são restritos ao projeto e a ambientes controlados; não testar gov.br/ITI ou terceiros.

Criar um comando reprodutível de quality gates e um pipeline versionado. Não afirmar que proteção de branch, CI remota ou revisão periódica estão ativos apenas porque há arquivos YAML: o repositório canônico é Manus, não GitHub Actions. Verificar suporte real antes de configurar revisões periódicas; declarar pendente o que depender de hospedagem, conta, agenda ou custo não escolhido.

Preparar exportação cifrada dos dados do piloto e restauração em banco isolado, com comparação de registros e integridade. Guardar chaves de recuperação fora do backup; backup sem chave não é restaurável. Automação regular e destino independente de backup precisam ser configurados antes de uso comunitário. Arquivos temporários de container não são backup. Código e configuração serão versionados, sem documentos pessoais ou segredos. Sem gastos ou publicação pública automática nesta etapa.

## Interface e desenho

Alternativas visuais consideradas: modernismo editorial cívico, probabilidade amostrada 0,04; terminal cartográfico sóbrio, 0,07; formulário documental clássico, 0,02. Essas probabilidades são apenas do processo de seleção visual, não avaliação de qualidade. Escolha: modernismo editorial cívico.

**Movimento:** modernismo editorial, com formulários e registros legíveis, sem aparência de órgão oficial. **Princípios:** hierarquia tipográfica, ações explícitas, estados verificáveis e acessibilidade. **Cores:** fundo branco quente, texto grafite e azul-petróleo; âmbar para pendência e vermelho apenas para erros. **Layout:** páginas de leitura e formulários em coluna, navegação horizontal discreta e trilha de etapas; evitar dashboard de cards redundantes. **Elementos:** números de etapa, linhas editoriais e selos textuais de estado, sem selos que sugiram aval governamental.

**Interação:** um objetivo por tela, confirmação antes de enviar evidência ou remover chave, erros específicos sem expor dados, foco de teclado visível e rótulos persistentes. **Animação:** transições curtas de estado, sem contadores decorativos; respeitar prefers-reduced-motion. **Tipografia:** famílias de sistema sans-serif para leitura e monoespaçada para desafios/resumos, sem carregar fontes externas nas telas sensíveis. **Essência:** participação comunitária com identificação transparente; personalidade sóbria, verificável e direta. **Voz:** “Sua conta ainda não foi vinculada.” e “Assine no portal oficial e envie o PDF digital.” **Marca:** Cívica provisória com símbolo tipográfico de vínculo aberto, sem brasão ou logo gov.br. **Cor de assinatura:** azul-petróleo #155E63. Sem imagens decorativas ou participantes inventados.

## Entrega desta etapa

Apresentar o piloto em Preview, com dados vazios e estados reais. O usuário executa a cerimônia de passkey e assina o documento no seu próprio dispositivo. Antes de qualquer upload, confirmar o aviso e a configuração de proteção. Evidenciar o que foi testado automaticamente, o que foi testado com a conta real e o que continua pendente. Publicação pública e abertura a terceiros exigem confirmação específica após resolver as limitações materiais de identidade e isolamento.

Fontes técnicas: https://simplewebauthn.dev/docs/packages/server ; https://simplewebauthn.dev/docs/advanced/passkeys ; https://www.gov.br/pt-br/servicos/assinatura-eletronica ; https://validar.iti.gov.br/duvidas.html ; https://www.w3.org/TR/webauthn-3/ .
