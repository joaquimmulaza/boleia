# Landing Page Refresh — Specification

## Problem Statement

A landing pública (`/`) está desactualizada face ao marketplace Oferta/Procura: hero com foto stock externa frágil, copy ainda fala de “rotas” genéricas, menu mobile é só decorativo (ícone Menu sem `onClick`), e vários links nav/footer são `href="#"`. Visitantes em Luanda não conseguem navegar nas secções nem perceber o produto actual (procura/oferta → proposta → acordo 1:N em Kz).

## Goals

- [ ] Landing moderna on-brand (tokens `index.css`, sem stock externo)
- [ ] Menu mobile acessível e funcional (abre/fecha, Escape, overlay, âncoras)
- [ ] Copy alinhada ao marketplace Oferta/Procura (PT-PT, Kz, Luanda)
- [ ] Âncoras e CTAs auth sem links mortos óbvios
- [ ] Componentes modulares em `src/components/landing/` com TDD Vitest

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Páginas Termos / Privacidade completas | Só links honestos (âncora ou mailto) neste ciclo |
| Alterações Auth além de query string existente | `useAuthForm` já lê `mode`/`role` |
| Imagem gerada / foto stock nova | Decisão: hero CSS + mock JSX |
| Commit automático | Só handoff; commit se utilizador pedir |

---

## User Stories

### P1: Menu mobile funcional ⭐ MVP

**User Story**: Como visitante em telemóvel, quero abrir o menu e ir às secções ou ao auth, para navegar sem fricção.

**Why P1**: Menu actual é morto — bloqueia UX mobile.

**Acceptance Criteria**:

1. WHEN o utilizador toca no botão Menu THEN o sistema SHALL abrir um painel com âncoras + Entrar + CTAs Passageiro/Motorista
2. WHEN o painel está aberto THEN o botão SHALL ter `aria-expanded="true"` e `aria-controls` apontando ao painel
3. WHEN o utilizador pressiona Escape, clica no overlay, ou escolhe um link THEN o sistema SHALL fechar o menu
4. WHEN um link âncora é escolhido THEN o browser SHALL fazer scroll para a secção correspondente (`#como-funciona`, `#vantagens`, `#seguranca`)

**Requirement IDs**: LP-01, LP-04

---

### P1: Hero on-brand sem stock ⭐ MVP

**User Story**: Como visitante, quero ver um hero moderno e de confiança (boleias diárias Luanda), sem imagem stock genérica.

**Why P1**: Stock externa é frágil e off-brand.

**Acceptance Criteria**:

1. WHEN a landing carrega THEN o hero SHALL ser full-bleed com atmosfera via CSS/tokens (sem URL `googleusercontent` ou stock externa)
2. WHEN o hero é renderizado THEN a marca (`/boleia-logo.png`) SHALL ser sinal hero-level
3. WHEN o hero é renderizado THEN SHALL existir headline + 1 frase de suporte + CTAs Passageiro/Motorista + mock leve do produto em JSX (Oferta / Procura / Acordo · Kz)
4. WHEN se inspecciona o código da landing THEN NÃO SHALL existir dependência de imagem externa no hero

**Requirement IDs**: LP-02, LP-05

---

### P1: Copy marketplace + secção Segurança ⭐ MVP

**User Story**: Como visitante, quero entender o fluxo procura/oferta → proposta → acordo mensal em Kz, e ver uma secção de Segurança.

**Why P1**: Copy actual descreve domínio legado.

**Acceptance Criteria**:

1. WHEN o utilizador lê o hero e “Como funciona” THEN o copy SHALL descrever marketplace (publicar procura/oferta → combinar proposta/grupo → acordo 1:N com preço em Kz)
2. WHEN o utilizador navega para `#seguranca` THEN SHALL existir secção Segurança (perfis, acordos claros, faltas rastreáveis — tom utilitário)
3. WHEN o CTA final é mostrado THEN NÃO SHALL inventar números (“centenas de pessoas”); soft claim permitido
4. WHEN o footer é mostrado THEN NÃO SHALL existir link Blog; Entrar SHALL ir a `/auth`; Termos/Privacidade SHALL ser honestos (âncora ou mailto)

**Requirement IDs**: LP-03, LP-06

---

### P1: Qualidade (lint + testes) ⭐ MVP

**Acceptance Criteria**:

1. WHEN `npm run test:run` THEN testes da landing (incluindo menu/âncoras/hero) SHALL passar
2. WHEN `npm run lint` THEN SHALL estar limpo nos ficheiros tocados

**Requirement IDs**: LP-07

---

## Requirement Traceability

| ID | Descrição | Stories |
| -- | --------- | ------- |
| LP-01 | Menu mobile abre/fecha e é acessível | P1 Menu |
| LP-02 | Hero sem imagem externa; full-bleed on-brand | P1 Hero |
| LP-03 | Copy marketplace; secção Segurança | P1 Copy |
| LP-04 | Âncoras nav (desktop + mobile) scrollam para secções | P1 Menu |
| LP-05 | CTAs Passageiro/Motorista/Começar/Entrar → `/auth…` | P1 Hero |
| LP-06 | Footer sem links mortos óbvios (sem Blog) | P1 Copy |
| LP-07 | Testes Vitest verdes; lint limpo | P1 Qualidade |

## Decisões fechadas (context)

Ver `HANDOFF.md`. Não reabrir: hero CSS+mock, âncoras fixas, menu a11y, footer sem Blog, fora de âmbito legal pages.

## Success Metrics

- Zero URLs stock no código da landing
- Menu mobile testável (Vitest) + smoke manual
- Copy sem jargon interno (`N_candidato`, `POR_PASSAGEIRO`)
