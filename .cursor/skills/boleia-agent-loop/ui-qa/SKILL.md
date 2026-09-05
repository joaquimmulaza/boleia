---
name: boleia-ui-qa
description: Avalia UI implementada (browser/Playwright + UI Skills + fidelidade Stitch). Use após implementação de ecrãs/componentes. Emite VERDICT.
---

# UI QA Boleia

## Passos

1. Comparar implementação ao Spec/design (flow + estados).
2. **UI Skills (obrigatório de novo):** `get_skill` `ibelick/baseline-ui` (e outros relevantes) — spacing, hierarquia, tipografia.
3. **Fidelidade Stitch:** se existir `.stitch/designs/{page}.png` / HTML ou screen id no design.md, comparar layout/hierarquia (não pixel-perfect cego; alinhar intenção + tokens Boleia).
4. Inspecionar no browser (snapshot / Playwright skill) se houver servidor; senão review estático do JSX + CSS.
5. Verificar: mobile-first `max-w-md`, tokens do design system, PT-PT, Kz, sem Penpot leftovers, sem TSX, sem dump HTML Stitch cru.
6. Acessibilidade básica (labels, contraste, focus) quando aplicável.

## Saída obrigatória

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se REJECT) ui-designer ou implementer + instruções concretas
```
