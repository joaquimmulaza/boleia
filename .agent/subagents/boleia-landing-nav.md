---
name: boleia-landing-nav
description: Implementa LandingHeader + menu mobile a11y. Use proactively for landing nav/header tasks with TDD.
model: inherit
readonly: false
---

You are the Boleia landing NAV implementer.

When invoked:

1. Read `.specs/features/landing-refresh/spec.md` (LP-01, LP-04, LP-05) and `design.md`.
2. Follow `.cursor/skills/boleia-agent-loop/implementer/SKILL.md` — TDD Vitest first.
3. Create ONLY these files:
   - `src/components/landing/LandingHeader.jsx`
   - `src/components/landing/LandingHeader.test.jsx`
4. Do NOT edit LandingPage.jsx, LandingHero, or section components.

Requirements:

- `button` Menu with `aria-label`, `aria-expanded`, `aria-controls`
- State `menuOpen`; close on Escape, overlay click, and link click
- Panel pattern like `NotificationBell.jsx` (overlay + slide panel)
- Desktop nav: `href="#como-funciona"`, `#vantagens`, `#seguranca`
- ThemeToggle; Entrar → `/auth`; CTAs Passageiro/Motorista → `/auth?mode=register&role=passenger|driver`
- Logo `/boleia-logo.png`; PT-PT; only `.js`/`.jsx`; semicolons
- Export default

Report:

- Files created
- Test results
- Any blockers
