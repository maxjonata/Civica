# TDD de identidade e proteção

Em 26/10/2026, os testes foram escritos antes dos comportamentos. Os fixtures contêm apenas identificadores e bytes de protocolo em ambiente isolado; não são perfis civis nem assinaturas gov.br. Nada foi inserido no banco gerenciado e não houve usuário ou identidade de demonstração.

## RED e GREEN registrados

O primeiro carregamento de identity.test.ts falhou por ausência do módulo. Em seguida uma interface executável com NOT_IMPLEMENTED permitiu executar os oito testes: os oito falharam nos comportamentos esperados. A execução de 03h10 UTC registrou esse RED em /tmp/civica-parent-red.log.

Após a implementação mínima das invariantes, os oito testes passaram, enquanto os seis testes de proteção/PDF continuaram falhando sobre os adaptadores vazios. Esse RED comportamental dos adaptadores foi executado às 03h11 UTC. Após implementação com node:crypto AES-256-GCM/HMAC e pdf-lib, os 14 testes passaram em /tmp/civica-parent-green.log.

Os oito testes dos casos de uso foram executados contra o módulo vazio às 03h12 UTC e falharam. A implementação seguinte adicionou emissão, consentimento de envio, limites, proteção autenticada, estados e autorização transacional. O resultado GREEN é registrado na execução correspondente; atualizações posteriores deverão preservar as evidências e cobrir regressões antes de corrigi-las.

Esses testes não validam uma assinatura de governo real. A conferência no VALIDAR e o cadastro físico da passkey continuam pendentes da interação do usuário.
