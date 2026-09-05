# Handoff — Landing Page Refresh

**Data:** 2026-09-05  
**Feature:** Landing page refactor (hero + menu mobile + copy marketplace)  
**Fase TLC:** Specify → Design → Tasks → Execute (**ainda não iniciado**)  
**Branch:** `main` (ou branch que criares)  
**Plano Cursor:** `.cursor/plans/landing_page_refactor_2ee5ea78.plan.md`

---

## Prompt para colar no novo chat (orquestrador)

Copia o bloco abaixo na íntegra:

```text
És o orquestrador Boleia Certa. Implementa a refatoração completa da landing page.

Lê e segue NA ORDEM:
1. `.specs/features/landing-refresh/HANDOFF.md` (este contexto — fonte de verdade do pedido)
2. `.cursor/skills/tlc-spec-driven/SKILL.md` → criar `.specs/features/landing-refresh/spec.md` (+ design.md / tasks.md)
3. `.cursor/skills/boleia-agent-loop/orchestrator/SKILL.md`
4. `.cursor/skills/subagent-creator/SKILL.md` → criar subagentes e lançar Task em PARALELO com scopes disjuntos

Pedido do utilizador:
- Refatoração completa da landing (`src/pages/LandingPage.jsx`)
- Trocar/apagar a imagem do hero por opção moderna recomendada (DECISÃO JÁ TOMADA no HANDOFF: sem foto stock; hero full-bleed CSS + mock produto JSX)
- Actualizar informações/copy para marketplace Oferta/Procura (Luanda, Kz, PT-PT)
- Corrigir botões/links mortos — em especial o menu mobile (ícone Menu sem onClick)
- Passe livre para polish de UX alinhado a AGENTS.md + .cursorrules + tokens index.css
- Usar subagentes em paralelo para acelerar

Fluxo obrigatório:
Spec → UI Designer (gate design) → 3 implementers em paralelo (nav / hero / sections) → compose → UI QA + Code Reviewer → lint + test:run
Sem commit automático. Actualizar AGENTS.md no fim.
Não uses Penpot/Superdesign/Stitch como SoT. Stack UI: v0 (One) + UI Skills + shadcn + Mobbin free-safe.
TDD Vitest obrigatório. Só .js/.jsx. UI em português PT-PT.
```

---

## Objectivo

Landing pública moderna, on-brand, com navegação mobile funcional e copy alinhada ao domínio **marketplace Oferta/Procura** (não ao legado “rotas / requestSeat”).

## Diagnóstico (código actual)

Ficheiro monolito: [`src/pages/LandingPage.jsx`](../../../src/pages/LandingPage.jsx)  
Testes: [`src/pages/LandingPage.test.jsx`](../../../src/pages/LandingPage.test.jsx)

| Problema | Detalhe |
|----------|---------|
| Menu mobile morto | `Menu` de Lucide dentro de `<div>` sem `button`, sem `useState`, sem painel |
| Nav desktop morta | `href="#"` em “Como funciona”, “Vantagens”, “Segurança” |
| Footer morto | Termos, Privacidade, Contacto, Blog → `href="#"` |
| Hero frágil | `backgroundImage` com URL `lh3.googleusercontent.com/...` (stock externa) |
| Copy desactualizada | “rotas” genéricas; falta secção Segurança; claim “centenas de pessoas” sem base |
| CTAs auth OK | `navigate('/auth?mode=register&role=passenger\|driver')` — [`useAuthForm`](../../../src/hooks/useAuthForm.js) já lê `mode` e `role` |

Referências úteis:

- Drawer mobile existente: [`src/components/NotificationBell.jsx`](../../../src/components/NotificationBell.jsx)
- shadcn disponível: só [`src/components/ui/button.jsx`](../../../src/components/ui/button.jsx)
- Logo: `/boleia-logo.png` (mantém path; testes esperam este `src`)
- Tokens: [`src/index.css`](../../../src/index.css) — primary `#10b748`, backgrounds light/dark
- Rota: `/` via `RootRoute` em [`src/App.jsx`](../../../src/App.jsx) → `LandingPage` se não autenticado

## Decisões já fechadas (não reabrir)

1. **Hero:** Remover foto stock. Full-bleed com gradiente/atmosfera urbana (tokens CSS) + marca hero-level + headline + 1 frase + CTAs + mock leve do produto em JSX/CSS (Oferta / Procura / Acordo · Kz). **Sem** URL externa. **Sem** imagem gerada obrigatória.
2. **Âncoras:** `id="como-funciona"`, `id="vantagens"`, `id="seguranca"` + scroll via `href="#…"`.
3. **Menu mobile:** `button` + `aria-expanded` / `aria-controls`; fechar em Escape, overlay, e ao clicar link; painel com âncoras + Entrar + CTAs.
4. **Footer:** Remover Blog; Entrar → `/auth`; Termos/Privacidade honestos (âncora ou mailto — **não** criar páginas legais neste ciclo).
5. **Copy:** Marketplace (procura/oferta → proposta/grupo → acordo 1:N em Kz); soft claim no CTA final.
6. **Fora de âmbito:** Páginas Termos/Privacidade; mudanças Auth além do query string existente; commit sem pedido explícito.

## Arquitectura alvo (scopes paralelos)

```
src/pages/LandingPage.jsx              → composição
src/components/landing/
  LandingHeader.jsx                    → Agent NAV
  LandingHero.jsx                      → Agent HERO
  LandingHowItWorks.jsx                → Agent SECTIONS
  LandingBenefits.jsx                  → Agent SECTIONS
  LandingSecurity.jsx                  → Agent SECTIONS
  LandingCta.jsx                       → Agent SECTIONS
  LandingFooter.jsx                    → Agent SECTIONS
src/pages/LandingPage.test.jsx         → actualizar (+ testes menu)
.specs/features/landing-refresh/
  spec.md, design.md, tasks.md         → criar nesta execução
.agent/subagents/
  boleia-landing-nav.md
  boleia-landing-hero.md
  boleia-landing-sections.md
```

### Subagentes a criar (subagent-creator)

| Subagente | Responsabilidade | Ficheiros (só estes) |
|-----------|------------------|----------------------|
| `boleia-landing-nav` | Header, menu mobile, a11y, ThemeToggle | `LandingHeader.jsx` (+ teste colocalizado se útil) |
| `boleia-landing-hero` | Hero full-bleed sem stock | `LandingHero.jsx` (+ teste) |
| `boleia-landing-sections` | Como funciona, Vantagens, Segurança, CTA, Footer | `LandingHowItWorks/Benefits/Security/Cta/Footer.jsx` |

Depois o orquestrador **compõe** `LandingPage.jsx` e actualiza `LandingPage.test.jsx`.

## Fluxo orquestrador (obrigatório)

```
tlc-spec-driven (spec.md)
    → ui-designer (design.md, VERDICT APPROVE)
    → criar 3 subagentes .agent/subagents/boleia-landing-*
    → Task ×3 em paralelo (TDD: teste → vermelho → código → verde)
    → compose LandingPage + testes integração página
    → ui-qa ∥ code-reviewer (VERDICT)
    → npm run lint && npm run test:run
    → actualizar AGENTS.md (estado arquitectura)
    → handoff commit (NÃO commit automático)
```

Skills:

- `.cursor/skills/tlc-spec-driven/SKILL.md`
- `.cursor/skills/boleia-agent-loop/orchestrator/SKILL.md`
- `.cursor/skills/boleia-agent-loop/ui-designer/SKILL.md`
- `.cursor/skills/boleia-agent-loop/implementer/SKILL.md`
- `.cursor/skills/boleia-agent-loop/ui-qa/SKILL.md`
- `.cursor/skills/boleia-agent-loop/code-reviewer/SKILL.md`
- `.cursor/skills/subagent-creator/SKILL.md`
- `.cursor/rules/ui-stack.mdc` / `multi-agent-loop.mdc`

UI MCPs (design gate): UI Skills, shadcn, Mobbin free-safe (`mode: standard`, `limit` ≤ 5), v0 via One. Se Mobbin falhar por plano free → degradar e anotar.

## Requisitos rastreáveis (sugeridos para spec.md)

- **LP-01** Menu mobile abre/fecha e é acessível
- **LP-02** Hero sem imagem externa; full-bleed on-brand
- **LP-03** Copy marketplace (oferta/procura/acordo/Kz); secção Segurança presente
- **LP-04** Âncoras nav (desktop + mobile) fazem scroll para secções
- **LP-05** CTAs Passageiro/Motorista/Começar/Entrar navegam para `/auth…`
- **LP-06** Footer sem links mortos óbvios (sem Blog)
- **LP-07** Testes Vitest verdes; lint limpo

## Copy / secções (direcção)

| Secção | Mensagem |
|--------|----------|
| Hero | Matchmaking casa–trabalho: procura/oferta → proposta → acordo mensal |
| Como funciona | 1) Publica procura ou oferta 2) Combina proposta/grupo 3) Acordo 1:N com preço em Kz |
| Vantagens | Economia, pontualidade, grupo de colegas |
| Segurança (nova) | Perfis, acordos claros, faltas rastreáveis — tom utilitário |
| CTA final | Soft claim (“Junta-te ao Boleia Certa”) sem números inventados |
| Footer | Entrar → `/auth`; remover Blog; Termos/Privacidade honestos |

## Verificação de done

- [ ] Menu mobile funciona (teste + smoke)
- [ ] Zero `googleusercontent` / URLs de stock no código da landing
- [ ] Âncoras e CTAs funcionam
- [ ] `npm run lint` e `npm run test:run` verdes
- [ ] `AGENTS.md` actualizado
- [ ] VERDICT APPROVE de code-reviewer (+ ui-qa)
- [ ] Mensagem de commit sugerida preparada (só commit se o utilizador pedir)

## Mensagem de commit sugerida (quando pedirem)

```
ui: refrescar landing — hero sem stock, menu mobile e copy marketplace

```

## Notas de sessão anterior

- Utilizador deu passe livre na landing e pediu paralelismo explícito via `subagent-creator`.
- Plan mode: só planeamento feito; **nenhuma implementação** arrancou.
- Handoff marketplace antigo em `.specs/HANDOFF.md` é outra feature (T25+) — **não** misturar.
- **Regra v0 (SoT):** após o v0 elaborar um plano, o orquestrador **deve** Send Message a mandar construir a interface e só fechar o design gate quando houver código/preview gerado — nunca só o plano.
