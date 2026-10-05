# Registo: email já confirmado não pede «verifique o email»

## O que acontece

Com confirmação de email ligada, `signUp` de um email já confirmado (conta Google, por exemplo) responde 200 sem erro. O GoTrue regista `user_repeated_signup` e devolve um utilizador ofuscado (`sanitizeUser`): `identities` vazio, `session` nula, `confirmation_sent_at` carimbado mesmo sem correio. `useAuthForm` trata qualquer 200 sem sessão como «Verifique o seu email…».

## Diff

- `identities` é um array vazio → «Já existe uma conta com este email — tenta entrar.» O CTA continua «Entrar na minha conta». Sem navegação.
- Identidade de email presente e sem sessão → o ecrã de confirmação mantém-se (o correio foi pedido).
- Login `email_not_confirmed` não muda.

## Fora

SMTP, unicidade de telefone, reenviar email, `emailRedirectTo`, duplo Registar, HIBP, migrações.
