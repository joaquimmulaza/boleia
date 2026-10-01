# Esqueceu a palavra-passe — Specification

## Problem Statement

No ecrã `/auth` (modo Entrar) existe o CTA «Esqueceu a palavra-passe?» sem `onClick`. Utilizadores que esquecem a palavra-passe não conseguem recuperar o acesso. O fluxo Supabase Auth (`resetPasswordForEmail` → email → `PASSWORD_RECOVERY` → `updateUser`) não está ligado; além disso, uma sessão de recovery activaria `session` e o `RootRoute` / `ProtectedRoute` redireccionariam para o hub **antes** de definir a nova palavra-passe.

## Goals

- [ ] CTA login abre modo `forgot` no mesmo shell `/auth`
- [ ] Pedido de email chama `resetPasswordForEmail` com `redirectTo` para `/auth?mode=update-password`
- [ ] Feedback de sucesso genérico (anti-enumeração)
- [ ] Sessão `PASSWORD_RECOVERY` não entra no hub até a palavra-passe ser actualizada
- [ ] Form nova + confirmação (mín. 8) → `updateUser` → hub por `tipoPerfil`
- [ ] Copy PT-PT; erros via `getFriendlyErrorMessage` + validações locais

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Alterar palavra-passe no Perfil (logado) | Pedido é só «esqueceu» |
| Custom SMTP | Ops manual; template Recovery PT-PT está no repo |
| Magic Link / OTP | Flow password-based canónico |
| Páginas `/auth/*` novas | Query modes no shell existente |

---

## User Stories

### P1: Pedir recuperação por email ⭐ MVP

**User Story**: Como utilizador no login, quero pedir a recuperação da palavra-passe por email, para voltar a aceder à conta.

**Why P1**: CTA morto; bloqueia acesso.

**Acceptance Criteria**:

1. WHEN o utilizador clica «Esqueceu a palavra-passe?» no modo login THEN o sistema SHALL mostrar o formulário de recuperação (`/auth?mode=forgot`) com campo email
2. WHEN o utilizador submete um email válido THEN o sistema SHALL chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth?mode=update-password' })`
3. WHEN o pedido completa (com ou sem conta existente) THEN o sistema SHALL mostrar sucesso genérico: «Se existir conta com este email, enviámos instruções.»
4. WHEN o utilizador escolhe «Voltar ao início de sessão» THEN o sistema SHALL regressar ao modo login e limpar feedback/erros

**Requirement IDs**: FP-01, FP-02, FP-06

---

### P1: Definir nova palavra-passe após link ⭐ MVP

**User Story**: Como utilizador que abriu o link do email, quero definir uma nova palavra-passe, sem ser mandado para o hub a meio do fluxo.

**Why P1**: Sem isto o recovery deixa sessão aberta no hub sem password nova.

**Acceptance Criteria**:

1. WHEN o link de recovery abre a app THEN a URL SHALL incluir `/auth?mode=update-password` (via `redirectTo`)
2. WHEN o Auth dispara `PASSWORD_RECOVERY` THEN o sistema SHALL marcar `passwordRecoveryPending` (estado + `sessionStorage` `bc_password_recovery`)
3. WHEN há sessão e `passwordRecoveryPending` THEN `RootRoute` e `ProtectedRoute` SHALL redireccionar para `/auth?mode=update-password` (não hub)
4. WHEN o utilizador submete nova palavra-passe (≥ 8) e confirmação igual THEN o sistema SHALL chamar `updateUser({ password })`, limpar pending, e navegar para `/motorista` ou `/passageiro` conforme `tipoPerfil`
5. WHEN a confirmação não coincide ou a password tem < 8 caracteres THEN o sistema SHALL mostrar erro inline em PT-PT sem chamar `updateUser`

**Requirement IDs**: FP-03, FP-04, FP-05

---

### P1: Erros amigáveis ⭐ MVP

**User Story**: Como utilizador, quero mensagens claras em português quando o pedido ou a actualização falham.

**Acceptance Criteria**:

1. WHEN a API devolve erro genérico THEN `getFriendlyErrorMessage` SHALL ser usado
2. WHEN a API indica password igual à anterior / rate limit THEN a mensagem SHALL ser PT-PT específica

**Requirement IDs**: FP-05

---

## Requirement Traceability

| ID | Descrição | Priority |
| ---- | --------- | -------- |
| FP-01 | CTA login → `mode=forgot` | P1 |
| FP-02 | `resetPasswordForEmail` + sucesso genérico anti-enumeração | P1 |
| FP-03 | Recovery → `/auth?mode=update-password`; guard hub | P1 |
| FP-04 | Form nova + confirmar → `updateUser` → hub | P1 |
| FP-05 | Validação local + `getFriendlyErrorMessage` PT | P1 |
| FP-06 | Voltar ao login limpa estados | P1 |

---

## UI States

### mode=forgot

| Estado | UI |
| ------ | --- |
| Idle | Email + CTA «Enviar instruções» + Voltar |
| Loading | CTA disabled «A processar...» |
| Success | Feedback verde genérico |
| Error | Feedback vermelho (rede / rate limit) |

### mode=update-password

| Estado | UI |
| ------ | --- |
| Idle | Nova palavra-passe + Confirmar + CTA «Guardar nova palavra-passe» |
| Validation | Erros inline (curta / não coincidem) |
| Loading | CTA disabled |
| Success | Feedback + navigate hub |
| Error | Feedback API |

---

## Ops — Redirect URLs (Supabase Dashboard)

Auth → URL Configuration → Redirect URLs (adicionar):

- `http://localhost:5173/auth?mode=update-password`
- `https://<domínio-prod>/auth?mode=update-password`
- Previews Vercel: `https://*-<team>.vercel.app/auth?mode=update-password` (ou URLs exactas)

Template Recovery em PT-PT: `supabase/templates/recovery.html` (assunto «Redefinir a sua palavra-passe»).
Alojado: Authentication → Email Templates → Reset password, ou
`SUPABASE_ACCESS_TOKEN=… node scripts/apply-auth-email-templates.mjs`.

## Technical Notes

- Shell: reutilizar `Auth.jsx` + `useAuthForm` (query `mode`)
- `AuthContext`: `passwordRecoveryPending` + `clearPasswordRecovery`
- Sem DDL; sem TypeScript; TDD Vitest
- Design SoT: Stitch + UI Skills; Mobbin free degradado
