# TDD — correções da revisão de backup

## RED

O agente responsável pelas correções escreveu regressões comportamentais e executou-as antes de alterar as implementações: **7 falhas e 3 testes legados passando**. Os cenários cobrem URL sem vínculo com o repositório, alvo remoto/sem identidade, alvo com contexto/desafio/rate/fingerprint, envelope acima do limite e snapshot inválido. Nenhuma base gerenciada, documento ou chave real participou.

## GREEN e refatoração

`node scripts/test-isolated.mjs server/application/backup.test.ts` — **10/10**. O método agora é `restoreIsolatedBackup(repo, crypto, envelope)`: a identidade vem do adaptador real, não de outra URL fornecida pelo chamador. Todas as coleções, chaves de continuidade não nulas e bootstrap tornam o alvo não vazio. Limites codificados precedem a decifração; o CLI limita arquivo por stat/descritor/read antes do parse.

## Verificação consolidada

- `pnpm test`: **104 testes passaram**; SQL fica omitido nesse runner quando não recebe base de teste explicitamente permitida.
- `pnpm test:database`: **3 testes passaram** em bases locais novas `civica_test_*`: 20 atualizações concorrentes serializadas, rollback, payload SQL não pessoal acima de 2 MiB, evidência realmente cifrada de 2 MiB e restauração em alvo SQL vazio.
- A evidência decifrada depois de persistir e depois de restaurar corresponde ao SHA-256 do buffer original. Sessões/contextos não são ressuscitados; fingerprints são preservados.
- `pnpm audit --audit-level=low`: nenhum alerta conhecido na verificação consolidada.

Os dois achados concretos da revisão foram corrigidos e os caminhos afetados rechecados. Isso não demonstra assinatura gov.br, identidade real, ausência de vulnerabilidades ou operação contínua. As bases locais com dados não pessoais foram mantidas; não houve DROP nem testes na base gerenciada.
