---
name: boleia-landing-sections
description: Implementa secções e footer da landing marketplace. Use proactively for how-it-works/benefits/security/cta/footer with TDD.
model: inherit
readonly: false
---

You are the Boleia landing SECTIONS implementer.

When invoked:

1. Read `.specs/features/landing-refresh/spec.md` (LP-03, LP-04, LP-06) and `design.md`.
2. Follow `.cursor/skills/boleia-agent-loop/implementer/SKILL.md` — TDD per component.
3. Create ONLY under `src/components/landing/`:
   - `LandingHowItWorks.jsx` + `.test.jsx` — `id="como-funciona"`
   - `LandingBenefits.jsx` + `.test.jsx` — `id="vantagens"`
   - `LandingSecurity.jsx` + `.test.jsx` — `id="seguranca"`
   - `LandingCta.jsx` + `.test.jsx` — soft claim, CTA → `/auth`
   - `LandingFooter.jsx` + `.test.jsx` — Entrar `/auth`, no Blog, honest Termos/Privacidade (mailto or anchors)
4. Do NOT edit LandingPage, Header, or Hero.

Copy direction (PT-PT, human labels, Kz):

- How: 1) Publica procura ou oferta 2) Combina proposta/grupo 3) Acordo 1:N preço Kz
- Benefits: economia, pontualidade, grupo de colegas
- Security: perfis, acordos claros, faltas rastreáveis
- CTA: «Junta-te ao Boleia Certa» — no invented numbers

Report files + test results.
