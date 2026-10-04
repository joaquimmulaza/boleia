# Confirmação de email e palavra-passe vazada

## Plano (antes do código)

Onde o repo liga ou desliga:

- Confirmação de email: `supabase/config.toml`, bloco `[auth.email]`, chave `enable_confirmations`. Hoje está `false`. No projecto alojado isto corresponde a `mailer_autoconfirm` (true = entra sem confirmar). O bloco `[auth.sms] enable_confirmations` é outro interruptor (SMS) e fica `false`.
- Palavra-passe vazada (HaveIBeenPwned): não existe chave em `config.toml`. O CLI (até v2.119) faz `UnmarshalExact` e rejeita chaves desconhecidas; `password_hibp_enabled` só existe na Management API e no Dashboard (Authentication → Providers → Email → Prevent use of leaked passwords). O comentário junto às passwords regista a intenção de produção. Este run não altera o projecto alojado.

O que o ecrã de registo faz hoje se a confirmação for obrigatória:

- `useAuthForm.handleSubmit`, no `signUp` sem `error`, mostra «Registo efetuado! Verifique o seu email para confirmar a conta.» e chama sempre `navigateToHub` (1 s depois, `/passageiro` ou `/motorista`).
- Não lê `data.session`. Com confirmação ligada, o GoTrue devolve utilizador e `session: null`. O ecrã sai na mesma para o hub, como se a sessão já existisse.
- No login, o erro `Email not confirmed` cai na mensagem genérica de `getFriendlyErrorMessage`.

## Diff mínimo

- `[auth.email] enable_confirmations = true` (intenção de produção no repo).
- Comentário com `password_hibp_enabled = true` — sem chave real, para o CLI não falhar.
- Registo: navegar só quando `data.session` existe. Sem sessão, ficar no ecrã e dizer que a confirmação é necessária antes de haver sessão.
- Login: mensagem PT-PT quando o email ainda não está confirmado. Palavra-passe conhecida como fraca (HIBP) também deixa de cair no erro genérico.
- A UI reage à resposta da API. Não afirma que o projecto alojado já exige confirmação.

## Fora

`perfis`, apagar conta, grants `anon`, páginas públicas de privacidade/apagamento, Faltas, cabeçalho Explorar, G3, G4, Pack B, `.agent/`. Sem PATCH ao Supabase alojado.
