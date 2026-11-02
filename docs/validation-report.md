# Cívica — validação da primeira etapa

**Data:** 26/10/2026. **Escopo:** código de conta por passkey e vinculação manual por assinatura; não uma plataforma eleitoral publicada.

## Resultado verificável

Foram implementados conta persistente por passkey própria, convite de uso único, sessão/CSRF, gestão de chaves, documento de vínculo, envio cifrado privado, conferência manual por operador e estados separados. OAuth/tRPC/Bearer e uploads públicos herdados não autenticam nem recebem a evidência. Não há login Manus na aplicação, P2P, reconhecimento facial, enquetes ou aprovações fictícias na base real.

O Preview executa o build de produção com origem/RP ID fixos e coleta bloqueada enquanto faltarem chaves. Ainda não houve publicação pública nem registro de uma identidade real do titular.

## Evidência empírica

| Verificação | Resultado observado |
|---|---|
| TypeScript e ESLint | Passaram no código final. Diagnósticos TypeScript registrados. |
| Suíte isolada `pnpm test` | 104 testes passaram; testes SQL são omitidos nesse runner sem base de teste explicitamente permitida. |
| SQL `pnpm test:database` | 3 passaram: 20 atualizações concorrentes, persistência entre conexões, rollback e não vazamento de referências; payload acima de 2 MiB; cifra real AES-GCM de 2 MiB; restauração SQL e correspondência do conteúdo decifrado. |
| Browser `node scripts/test-browser.mjs` | Passou cadastro real de protocolo WebAuthn em Chromium, dois autenticadores virtuais distintos, reauth, emissão/download de PDF, recuperação após reload, consentimento/envio privado, restrição administrativa, CSRF, logout, login descobrível e viewport de 360 px. |
| Negativos criptográficos do browser | Baseline com assinatura genuína aceita; assinaturas genuínas com UV ausente, origem incorreta ou RP incorreto rejeitadas; repetição de desafio rejeitada. Chave privada somente de autenticador virtual no processo de teste, nunca do titular. |
| Build e lockfile | Instalação congelada e build de frontend/Node passaram; entrypoints `dist/index.js` e `dist/pilot.js` gerados. |
| Auditoria de dependências | Zero alertas conhecidos em `pnpm audit --audit-level=low`. Isso não cobre vulnerabilidades desconhecidas, imagem Linux ou auditoria formal. |
| Revisão crítica independente | Read-only, sem dados/segredos reais. Dois achados de restauração corrigidos por TDD e caminhos afetados rechecados. |

Testes usam ambiente mínimo sem DATABASE_URL gerenciado, chaves reais ou PDFs do titular. Bases temporárias são locais, têm prefixo controlado e credenciais restritas. Foram mantidas apenas com dados não pessoais; nenhum DROP ou teste adversarial em produção/terceiros foi executado.

## TDD e problemas corrigidos

Ciclos RED → GREEN → refatoração foram registrados para identidade, autorização, criptografia, PDF, HTTP, configuração, recuperação, bootstrap, manutenção e políticas de UI. Registros ficam em `docs/tdd-identity.md`, `docs/tdd-auth.md`, `docs/tdd-ui.md` e `docs/tdd-backup-review.md`.

Além dos achados independentes, regressões impediram: trocar o identificador WebAuthn da conta entre chaves; expor credenciais de outro usuário no cadastro; manter sessões de chave removida; deixar dois desafios ativos para a mesma operação; apresentar revisão rejeitada como identidade aprovada; afirmar prova de segunda chave quando a mesma chave foi usada; perder o documento emitido ao navegar/recarregar. Operador recebe conta, registro, desafio, resumo da chave e datas esperados para conferir o conteúdo coberto pela assinatura.

## O que NÃO foi comprovado

Não foi feita cerimônia física com Windows Hello, telefone ou chave do titular no domínio configurado. Não foi recebida/validada assinatura gov.br real; não houve identificação civil, unicidade de CPF ou reconhecimento facial demonstrados. Testes de autenticador virtual comprovam o protocolo, não pessoas, prata/ouro ou biometria. Decisão manual do próprio titular permanece não independente.

Não houve teste de container publicado, carga nacional, pen-test humano, auditoria formal, votação secreta ou representatividade estatística. Não existe promessa de segurança absoluta ou cobertura de todas as entradas/ataques possíveis.

## Operação e bloqueios relevantes

Purge explícito e oportunístico, exportação cifrada e restore isolado estão implementados/testados. Agendamento 24×7, destino de backup externo e custódia independente **não estão ativos**. O hook local pre-push executa gates; GitHub Actions/branch protection/revisões periódicas não foram ativados. Analytics do site e badge foram desabilitados por configuração da plataforma; outros logs/telemetria de infraestrutura podem existir.

O piloto limita-se a duas contas, uma linha JSON MySQL de 8 MiB e um processo: é uma restrição real, não uma solução pronta para coleta comunitária. Antes de ampliar: isolamento operacional de identidade/participação, plano de recuperação, operação de retenção/backup observada, domínio final, responsáveis/base legal/operadores/resposta a incidentes e auditoria adicional.

## Próxima ação do titular

Configurar três chaves independentes na interface protegida, abrir Preview, cadastrar a passkey com o convite privado e comprovar a segunda credencial. Somente depois revisar/assinar o documento no portal oficial e realizar a conferência manual real. Não enviar CPF, documento, senha gov.br ou chaves pelo chat.
