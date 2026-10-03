# Login social (OAuth) — Specification

## Problem Statement

A Boleia Certa só autentica com email e palavra-passe via Supabase Auth. Quem já tem Google, Facebook ou LinkedIn tem de criar outra palavra-passe. Um segundo sistema de sessão partiria as contas, os guards e o perfil `perfis`. Apple Sign-In saiu da UI (sem conta Apple Developer); a configuração de servidor ficou intacta.

## Goals

- [ ] Continuar com Google, Facebook e LinkedIn no mesmo shell `/auth`
- [ ] Reutilizar `supabase.auth` (PKCE), `auth.users` e `auth.identities`
- [ ] Não duplicar utilizador quando o email do provider vem verificado e já existe
- [ ] Conta nova sem telefone ou papel passa por `/auth?mode=completar-perfil` antes do hub
- [ ] Login, registo e recuperação por palavra-passe mantêm-se
- [ ] Segredos só no Dashboard / env do CLI, nunca no bundle Vite

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Activar providers em produção | Não há client secrets neste ambiente |
| Teste E2E contra os IdPs | Bloqueado por credenciais |
| Deep link nativo | A app é PWA web; redirect HTTPS chega |
| Tabela própria de identidades OAuth | `auth.identities` já é única por provider + id |

---

## User Stories

### P1: Iniciar sessão ou criar conta com um provider ⭐ MVP

**User Story**: Como pessoa em Luanda, quero continuar com Google, Facebook ou LinkedIn para entrar sem criar outra palavra-passe.

**Acceptance Criteria**:

1. WHEN o modo é Entrar ou Criar Conta THEN o sistema SHALL mostrar «Continuar com Google», «Continuar com Facebook» e «Continuar com LinkedIn», e SHALL NOT mostrar «Continuar com Apple»
2. WHEN o utilizador clica num botão THEN o sistema SHALL chamar `signInWithOAuth` com esse provider, `redirectTo` = origem + `/auth`, e PKCE
3. WHEN o modo é Criar Conta THEN `options.data.tipo_perfil` SHALL ser o papel escolhido no toggle
4. WHEN o modo é Entrar THEN o sistema SHALL NOT enviar `tipo_perfil` (conta nova escolhe o papel depois)
5. WHILE um provider está a abrir THEN os botões sociais SHALL ficar desactivados e o clicado SHALL dizer «A ligar ao {Provider}...»
6. WHEN o provider devolve erro imediato THEN os botões SHALL voltar ao estado normal e a mensagem SHALL ser PT-PT, sem secrets

**Requirement IDs**: SL-01, SL-02, SL-18

---

### P1: Conta nova completa o perfil antes do hub ⭐ MVP

**User Story**: Como pessoa nova via OAuth, quero indicar nome, telefone e se sou passageiro ou motorista antes de ver o hub.

**Acceptance Criteria**:

1. WHEN `perfis.perfil_completo` é false THEN `RootRoute`, `ProtectedRoute` e `AdminRoute` SHALL enviar para `/auth?mode=completar-perfil`
2. WHEN o perfil está completo THEN o retorno OAuth SHALL ir para `/motorista` ou `/passageiro`
3. WHEN falta email do provider THEN o ecrã SHALL explicar que se pode continuar sem email e SHALL NOT inventar um
4. WHEN o nome veio do provider THEN o campo SHALL vir preenchido

**Requirement IDs**: SL-13, SL-19

---

### P1: Não duplicar contas ⭐ MVP

**User Story**: Como quem já tem conta com o mesmo email verificado, quero que o provider se associe à conta existente.

**Acceptance Criteria**:

1. WHEN o email do provider não está verificado THEN a decisão de linking SHALL ser não associar por email
2. WHEN o email está verificado e já existe utilizador THEN a decisão SHALL ser associar (GoTrue)
3. WHEN a identidade provider+id já existe noutro utilizador THEN a UI SHALL dizer que o método já está noutra conta
4. WHEN o utilizador está autenticado THEN o perfil SHALL permitir associar ou desassociar, recusando desassociar a última identidade

**Requirement IDs**: SL-09, SL-14, SL-15

---

### P1: Erros e cancelamento ⭐ MVP

**Acceptance Criteria**:

1. WHEN `error=access_denied` THEN a mensagem SHALL indicar cancelamento
2. WHEN o state/callback é inválido THEN a mensagem SHALL pedir para tentar de novo, sem stack
3. WHEN o redirect falha THEN a mensagem SHALL ser genérica em PT-PT

**Requirement IDs**: SL-10, SL-11, SL-12

---

### P1: Palavra-passe continua a funcionar ⭐ MVP

**Acceptance Criteria**:

1. WHEN o utilizador submete email e palavra-passe THEN o sistema SHALL continuar a chamar `signInWithPassword` ou `signUp`
2. WHEN termina sessão THEN o sistema SHALL continuar a chamar `supabase.auth.signOut`

**Requirement IDs**: SL-16, SL-17

---

## Requirement Traceability

| ID | Descrição | Priority |
| ---- | --------- | -------- |
| SL-01 | Botões Continuar com Google, Facebook e LinkedIn | P1 |
| SL-02 | signInWithOAuth + redirect `/auth` + PKCE | P1 |
| SL-09 | Linking só com email verificado | P1 |
| SL-10 | Cancelamento OAuth | P1 |
| SL-11 | State/callback inválido | P1 |
| SL-12 | Erro de provider sem detalhes internos | P1 |
| SL-13 | Onboarding de perfil incompleto | P1 |
| SL-14 | Identidade duplicada | P1 |
| SL-15 | Associar/desassociar no perfil | P1 |
| SL-16 | Sessão Supabase e logout | P1 |
| SL-17 | Login/registo por palavra-passe | P1 |
| SL-18 | Loading e anti duplo clique | P1 |
| SL-19 | Hub só com perfil completo | P1 |

## Decisões

- Provider LinkedIn: `linkedin_oidc`.
- Segredos: Dashboard Supabase e `SUPABASE_AUTH_EXTERNAL_*` sem prefixo `VITE_`.
- Callback dos IdPs: `{VITE_SUPABASE_URL}/auth/v1/callback` (o host é o do projecto, não se cola aqui).
- Redirect da app: `http://localhost:5173/auth` e `https://boleia-cyan.vercel.app/auth`.
- `perfil_completo` default `true` para contas já existentes.
- Apple private key nunca no frontend.
