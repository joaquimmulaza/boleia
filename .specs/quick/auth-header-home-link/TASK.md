# Quick Task: Login e criar conta ligam o cabeçalho a `/`

**Date:** 2026-10-04
**Status:** Done

## Como o cabeçalho renderiza hoje

Login e criar conta são o mesmo ecrã `Auth` (`/auth` e o toggle / `?mode=register`). O cabeçalho é um `h1` centrado com só `boleia-logo.png` (`alt` «Boleia Certa», `h-20`). Não há palavra ao lado do ícone e o bloco não é um link. Recuperar palavra-passe, nova palavra-passe e completar perfil partilham esse mesmo `h1`.

A app com sessão usa outro cabeçalho: `Layout` monta `BrandLockup` (ícone; em Faltas também a palavra) dentro de um `h1`, sem `href`. O destino por defeito não é `/`. Explorar público tem o seu próprio botão para `/` e fica fora deste diff.

## Alteração mínima

Em `Auth.jsx`, só quando `isLogin` ou `isRegister`, envolver o ícone existente num `<a href="/">`. Não mudar o default de `BrandLockup`. Não acrescentar botão Voltar, página nova, nem wordmark.

## Verification

- [x] Login: link «Boleia Certa» com `href="/"`.
- [x] Criar conta: o mesmo link.
- [x] Recuperar palavra-passe: ícone sem link.
- [x] `BrandLockup` no shell autenticado continua sem `<a>`.
