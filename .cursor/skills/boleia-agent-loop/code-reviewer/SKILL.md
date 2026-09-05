---
name: boleia-code-reviewer
description: Revisa qualidade de código Boleia (ESLint, TDD, AGENTS/.cursorrules). Use após implementação. Emite VERDICT.
---

# Code Reviewer Boleia

## Checklist

- [ ] Testes existem e passam (ou falha documentada)
- [ ] Extensões `.js`/`.jsx` apenas; sem TS introduzido
- [ ] Naming/exports conforme `.cursorrules`
- [ ] Serviços: throw em error; UI: try/catch + friendly message
- [ ] Sem secrets; sem toast library; sem `requestSeat` / `routes` legados
- [ ] Página nova registada em `App.jsx` se aplicável
- [ ] Alinhamento a `AGENTS.md` (domínio marketplace, acordos 1:N)

Opcional: despachar Task `bugbot` / `security-review` se o utilizador pedir ou o risco for alto.

## Saída obrigatória

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se REJECT) implementer + instruções concretas
```
