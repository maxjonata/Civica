# Piloto de conta e identidade — resultados

- [x] **Conta persistente com passkey própria.** Cadastro por apelido e convite de uso único; sem CPF em campo livre, conta Manus, identidade de Preview simulada ou papel administrativo automático. Chave descobrível, verificação local de usuário obrigatória, origem e RP ID fixados pelo operador. Desafios vinculados ao navegador e operação, expiram em cinco minutos e são consumidos atomicamente inclusive em falha. Login, logout, expiração e revogação reais com tokens opacos resumidos na base, cookies HttpOnly/Secure e proteção de origem/CSRF. Não usar localStorage/sessionStorage para credenciais.

- [x] **Gestão de acesso e limite de recuperação.** Adicionar e remover passkeys apenas com autenticação recente; não remover última chave ou permitir recuperação por CPF/e-mail/admin silencioso. Exigir segunda credencial com acesso testado antes de receber documento real e informar risco de perda conjunta. Domínio do Preview e domínio final não são automaticamente intercambiáveis.

- [x] **Documento de vinculação e evidência privada.** PDF com finalidade restrita, conta opaca, resumo da chave, desafio exclusivo, emissão e validade de 24 horas; assinatura pelo próprio usuário no portal oficial gov.br, nunca senha gov.br no site. Upload autenticado de no máximo 2 MiB, sem executar/renderizar/extrair conteúdo complexo. Cifrar antes de persistir, sem URLs públicas, assets, logs ou envio a IA. Chaves ausentes bloqueiam operação. Aviso e consentimento de envio explícitos, sem conteúdo de enquetes no documento.

- [x] **Conferência manual e estados honestos.** Administração por bootstrap operacional de uso único, nunca primeiro cadastro ou OWNER_OPEN_ID. Download privado attachment/no-store; conferência no VALIDAR realizada pelo operador, não raspagem/API presumida. Registro de hash exato, assinatura/origem/conteúdo/conta/chave/desafio e decisão; inválido/indeterminado não vira aprovação. Distinguir assinatura, identidade, unicidade civil demonstrada e independência da revisão. CPF verificado apenas vira índice HMAC protegido; assinatura não é reconhecimento facial nem Login Único gov.br. Transação impede replay e dupla decisão.

- [ ] **Retenção e recuperação do piloto.** Descarte de evidência cifrada até sete dias após decisão, com registro mínimo e execução verificável. Não prometer eliminação de backups/ITI. Exportação cifrada e restauração testada em base isolada, custódia de chave separada; rotina periódica/destino externo não serão declarados ativos sem execução. Código/configuração portáveis e versionados sem documentos ou segredos. P2P e coleta comunitária fora desta etapa; isolamento de processo/banco ainda é limite do piloto próprio.

- [x] **TDD e segurança empírica.** Para cada comportamento: escrever e executar o teste falhando (RED), implementar para passar (GREEN), refatorar preservando os testes. Cobrir falhas, entradas adversariais, replay, concorrência, CSRF, autorização, expiração, limites e estados. Testes positivos artificiais são exclusivamente protocolos/dados de teste isolados, nunca perfis, CPFs, assinaturas gov.br, votos ou aprovações usados como demonstração real. Runner não recebe DATABASE_URL gerenciado, documentos nem segredos reais; banco de testes temporário tem nome/origem explicitamente permitidos. Evidenciar recusa a base compartilhada. A cerimônia real e assinatura serão feitas pelo usuário, não simuladas como concluídas.

- [x] **Gates e revisão independente.** Diagnósticos, lint, testes, build e auditoria de dependências reprodutíveis. Revisão read-only por agente independente, correção de problemas concretos e rechecagem dos caminhos afetados. CI YAML não equivale a CI remota/branch protection/revisões periódicas ativos. Sem testes contra gov.br/ITI/terceiros. Sem gastos nem publicação automática.

- [ ] **Interface real do piloto.** Acesso, conta, vinculação, status e revisão em português; estados vazios, nome Cívica provisório, sem participantes/documentos/resultados inventados. Acessível e sem aparência de governo. Mostrar limites, bloqueios e ausência de automação de identidade. Preparar Preview e checkpoint; não declarar site público antes da publicação específica e confirmada.

## Evidências e pendências

Resultados marcados correspondem ao código e aos testes executados, não a uma identidade civil já verificada. Gates finais passaram; 104 testes isolados e 3 SQL passaram. Browser completo passou com dois autenticadores virtuais e baseline/negativos criptográficos. Ver docs/validation-report.md.

Retenção: mecanismos explícitos/oportunísticos e restore isolado comprovados; agendamento 24×7, destino externo e custódia independente ainda pendentes. Nenhum documento real foi recebido.

Interface: Preview saudável em build de produção, seis rotas no manifesto, conta anônima real e coleta bloqueada sem chaves; checkpoint canônico ainda será confirmado. Cerimônia física/gov.br e publicação pública não estão concluídas.
