# TDD da interface do piloto

## Escopo

Esta entrega cobre somente o cliente REST do piloto em `client/src`, o HTML base, rotas públicas, favicon e o contrato em `tests/frontend-contract.test.ts`. O cliente não cria contas, perfis, CPFs, assinaturas, revisões, enquetes ou resultados de demonstração.

## RED registrado

Em 26/10/2026, antes da implementação, foi executado:

```text
node scripts/test-isolated.mjs tests/frontend-contract.test.ts
```

Primeiro o runner encontrou o estado original sem o arquivo de teste: `No test files found, exiting with code 1`. Depois que o contrato RED foi criado, a execução falhou na coleta com `Cannot find module '@/lib/api'`, porque o wrapper e as páginas ainda não existiam. Esse é o RED estrutural que precedeu a implementação; não foi apresentado como sucesso.

## GREEN esperado e verificação disponível

A suíte verifica, em isolamento:

- `GET /api/session` com `credentials: include` e CSRF somente em memória;
- CSRF em mutações, sem token no corpo;
- atualização de CSRF após nova sessão;
- mapeamento seguro de `{ error: { code } }` e `{ error: code }` para português;
- formatadores de ID opaco, data e readiness;
- renderização estática da home vazia, privacidade e acesso bloqueado sem conta fictícia;
- ausência de `localStorage`, `sessionStorage`, `Authorization`, tRPC e fluxo OAuth no wrapper.

Executar para verificar o estado atual:

```text
node scripts/test-isolated.mjs tests/frontend-contract.test.ts
pnpm exec tsc --noEmit
pnpm exec vite build
```

## O que estes testes não comprovam

A suíte não simula uma passkey, não fabrica uma resposta WebAuthn, não acessa gov.br/ITI, não baixa um PDF real e não afirma que a configuração de proteção está pronta. A cerimônia de `startRegistration({ optionsJSON })`/`startAuthentication({ optionsJSON })`, o cookie de sessão e as decisões administrativas dependem do servidor e do dispositivo do usuário. A validação positiva com a conta real, assinatura real e conferência real continuam pendentes.

O contrato UI mantém downloads como links same-origin autenticados e não renderiza o documento assinado em iframe. CPF, quando o operador escolhe informá-lo na revisão, fica apenas no estado transitório da tela e é omitido do payload quando vazio; não é guardado em storage do navegador.
