# Revisão independente da implementação

Agente separado, read-only, sem navegador, banco, ambiente, segredos ou PDFs reais. A revisão foi realizada sobre o código, não sobre uma identidade civil. Consenso não é prova de segurança.

## Achados materiais

1. **Médio:** a restauração validava uma URL livre sem vinculá-la à conexão real; a verificação de alvo vazio não incluía contextos, desafios, rates ou fingerprints. Não havia exploração HTTP atual; havia risco de uso operacional incorreto por novo chamador. Correção em TDD: identidade de alvo obtida do adaptador real, verificação completa de vazio e validação estrutural do snapshot antes de alterar estado.
2. **Baixo/médio:** leitura de arquivo e decifração de backup aconteciam antes de verificar seu limite. Correção em TDD: limite de arquivo e envelope codificado antes da leitura/decifração.

As duas correções foram concluídas por TDD e os caminhos afetados rechecados. Evidência em `tdd-backup-review.md` e `validation-report.md`: suíte de backup/schema, 3 testes SQL com restauração e comparação de conteúdo cifrado/decifrado, gates e browser passaram. Não confundir essa evidência de código com identidade civil ou segurança absoluta.

## Verificações sem achado material

Desafios consumidos antes da verificação; tokens de sessão resumidos; origem exata/CSRF; RP ID e origem configurados; Bearer/Manus não autenticam; ownership revalidado na transação; upload limitado antes do parser; AES-GCM com AAD conta/registro/desafio; HMAC com chave própria e continuidade; revisão própria marcada não independente.

## Limites

A cerimônia física de passkey, a segunda credencial real, a assinatura gov.br e a conferência no VALIDAR dependem do titular/operador. A revisão não comprova esses eventos. Não existe isolamento operacional de identidade versus participação futura; o piloto tem dois usuários no máximo, armazenamento JSON transacional limitado e nenhuma enquete coletiva ativa. Abertura comunitária exige revisão de arquitetura, isolamento, políticas, tratamento de incidentes e operação contínua antes de coleta pública.
