---
name: boleia-ui-qa
description: Avalia UI implementada (browser/Playwright + UI Skills). Use após implementação de ecrãs/componentes. Emite VERDICT.
---

# UI QA Boleia

## Passos

1. Comparar implementação ao Spec/design (flow + estados).
2. **UI Skills:** `get_skill` `ibelick/baseline-ui` (e outros relevantes) — spacing, hierarquia, tipografia.
3. Inspecionar no browser (snapshot / Playwright skill) se houver servidor; senão review estático do JSX + CSS.
4. Verificar: mobile-first, tokens do design system, PT-PT, Kz, sem Penpot leftovers, sem TSX.
5. Acessibilidade básica (labels, contraste, focus) quando aplicável (`accesslint/accessibility-diff` se útil).

## Saída obrigatória

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se REJECT) ui-designer ou implementer + instruções concretas
```
