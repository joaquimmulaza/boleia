# Landing Page Refresh — Tasks

## Overview

Refatorar landing em componentes com scopes disjuntos; TDD; compose no orquestrador.

**Dependencies:** Design gate APPROVE (`design.md`) antes de Execute paralelo.

---

## Parallel Track A — Nav (após design)

### T1: LandingHeader + menu mobile

- **IDs:** LP-01, LP-04, LP-05
- **Scope:** `src/components/landing/LandingHeader.jsx`, `LandingHeader.test.jsx`
- **Agent:** `boleia-landing-nav`
- **DoD:** Menu abre/fecha; a11y; âncoras; ThemeToggle; Entrar → `/auth`; testes verdes
- **Commit:** (orquestrador — só se pedido) `ui: landing header com menu mobile`

---

## Parallel Track B — Hero (após design)

### T2: LandingHero full-bleed

- **IDs:** LP-02, LP-05
- **Scope:** `src/components/landing/LandingHero.jsx`, `LandingHero.test.jsx`
- **Agent:** `boleia-landing-hero`
- **DoD:** Sem stock externo; mock JSX; CTAs auth; testes verdes
- **Commit:** `ui: landing hero sem stock`

---

## Parallel Track C — Sections (após design)

### T3: Secções + footer

- **IDs:** LP-03, LP-04, LP-06
- **Scope:**
  - `LandingHowItWorks.jsx` (+ teste)
  - `LandingBenefits.jsx` (+ teste)
  - `LandingSecurity.jsx` (+ teste)
  - `LandingCta.jsx` (+ teste)
  - `LandingFooter.jsx` (+ teste)
- **Agent:** `boleia-landing-sections`
- **DoD:** ids `como-funciona` / `vantagens` / `seguranca`; copy marketplace; footer sem Blog; testes verdes
- **Commit:** `ui: landing sections e footer marketplace`

---

## Sequential — Compose & gates

### T4: Compor LandingPage + testes página

- **IDs:** LP-01…LP-07
- **Scope:** `src/pages/LandingPage.jsx`, `src/pages/LandingPage.test.jsx`
- **Owner:** Orquestrador
- **DoD:** Monta header/hero/sections; testes integração actualizados; zero `googleusercontent`

### T5: UI QA + Code Reviewer

- **Owner:** `boleia-ui-qa` ∥ `boleia-code-reviewer`
- **DoD:** `VERDICT: APPROVE` (máx. 2 ciclos)

### T6: Lint + test:run + AGENTS.md

- **Owner:** Orquestrador
- **DoD:** `npm run lint` + `npm run test:run` verdes; `AGENTS.md` actualizado; handoff commit (sem commit auto)

---

## Parallelism map

```
Design APPROVE
    ├── T1 Nav
    ├── T2 Hero
    └── T3 Sections
            ↓
         T4 Compose
            ↓
    T5 QA ∥ Reviewer → T6
```
