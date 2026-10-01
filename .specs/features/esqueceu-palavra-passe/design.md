# Design — Esqueceu a palavra-passe

## Gate design

**VERDICT: APPROVE** (com degradação MCP documentada)

## MCP status

| MCP | Estado | Acção |
|-----|--------|-------|
| Stitch (`stitch`) | **error** — discovery falhou; `mcp_auth` timeout | Fallback: reutilizar shell visual de `Auth.jsx` (mesmo card, tokens, tipografia) |
| UI Skills | **ausente** do catálogo MCP desta sessão | Constraints: labels visíveis, erros abaixo do campo, CTA full-width, contraste primary, a11y `aria-label` show/hide |
| Mobbin | free plan → 403 | Degradado (anotado) |
| shadcn | loading/instável | Reutilizar inputs nativos do Auth (padrão actual; `Button` shadcn opcional) |

Não usar v0/One: shell Auth já é o SoT visual do fluxo; novos modos = variantes do mesmo ecrã.

## Flow

1. Login → CTA «Esqueceu a palavra-passe?» → `?mode=forgot`
2. Email → «Enviar instruções» → feedback sucesso genérico
3. Email link → `?mode=update-password` (+ sessão recovery)
4. Nova + confirmar → «Guardar nova palavra-passe» → hub

## Ecrãs (mesmo shell)

### Forgot (`mode=forgot`)

- Logo + subtítulo existente
- Título curto: «Recuperar palavra-passe»
- Campo Email (h-14, rounded-2xl)
- CTA primary: «Enviar instruções»
- Link secundário: «Voltar ao início de sessão»
- Feedback alert (sucesso/erro) como no Auth actual

### Update password (`mode=update-password`)

- Título: «Nova palavra-passe»
- Campos: Palavra-passe + Confirmar (com toggle Eye)
- CTA: «Guardar nova palavra-passe»
- Erros inline PT-PT

## Componentes

- Reutilizar markup/classes de `Auth.jsx` (sem cards novos)
- Sem primitivos shadcn novos obrigatórios
- Feedback: bloco `role="alert"` existente (ou `FeedbackAlert` se encaixar sem refactor largo)

## Tokens

- `primary`, `background-light`/`dark`, `rounded-2xl`, `h-14` inputs — iguais ao Auth
