# Quick: páginas públicas de privacidade e eliminação

**Date:** 2026-10-04
**Status:** Done

## Plano

Duas rotas públicas, fora de `Layout`, no mesmo padrão de `/explorar` e `/auth` (`isPublicRoute`). Shell visual de `LandingPage`. Cabeçalho só nestas páginas: `BrandLockup` com `withName` (ícone + «Boleia Certa») e o cabeçalho inteiro é um `Link` para `/`. Sem botão Voltar. Rodapé existente `LandingFooter` liga a `/privacidade` e `/eliminacao-de-dados`, também nestas páginas. Explorar mantém o ícone sem nome. Sem schema: o texto não cria prazo, email, canal nem fluxo de eliminação.

## Copy (Figma `OUrBNaukPsXB14x2nwGSJy`)

- `141:3` Política de privacidade
- `141:16` Eliminação de dados

## Verification

- [x] Sem sessão, `/privacidade` e `/eliminacao-de-dados` abrem o texto dos frames.
- [x] Cabeçalho aponta para `/`. Sem Voltar. Sem entrada na navegação autenticada.
- [x] Rodapé do site liga às duas páginas.
