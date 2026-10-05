# Confirmação de email no registo

## O que o ecrã fazia

`useAuthForm` depois de `signUp` mostrava «Verifique o seu email para confirmar a conta» e, passado 1 s, chamava `navigate` para `/passageiro` ou `/motorista` com base no utilizador, mesmo quando `data.session` vinha vazio. O login com `email_not_confirmed` caía na mensagem genérica de `getFriendlyErrorMessage`.

## Diff

1. Sem sessão após `signUp`: manter a mensagem e ficar em `/auth`. Com sessão: navegar para o hub como antes.
2. `email_not_confirmed` (código ou «Email not confirmed») → «Confirme o email antes de entrar. Abra a mensagem que enviámos para activar a conta.»
3. `supabase/config.toml`: `[auth.email] enable_confirmations = true` e `[auth] password_hibp_enabled = true`.

## Fora

Dashboard do projecto alojado (não alterar nesta corrida), políticas de `perfis`, `REVOKE` de `anon`, páginas legais, Faltas, `/explorar`, G3, G4, Pack B, `.agent/`.

## Ops

Confirmação de email já está ligada no projecto alojado. Falta ligar no Dashboard «Prevent use of leaked passwords» (`password_hibp_enabled`). Este PR não aplica essa mudança no alojado.
