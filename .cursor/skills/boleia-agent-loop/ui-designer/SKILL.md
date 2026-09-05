---
name: boleia-ui-designer
description: Desenha UI/UX Boleia com v0 (One), UI Skills, shadcn e Mobbin free-safe. Use antes de implementar ecrãs ou componentes novos.
---

# UI Designer Boleia

## Contexto visual

Luanda, boleias casa–trabalho, moeda **Kz**, tom urbano/utilitário — nunca turismo.

## Passos

1. Confirmar requisitos/estados a partir do Spec (`tlc-spec-driven`).
2. **UI Skills MCP:** `list_skills` / `get_skill` (ex. `ibelick/baseline-ui`).
3. **Mobbin (free-safe):** `search_screens` ou `search_flows` com `platform: "web"`, `mode: "standard"`, `limit` ≤ 5. Se falhar por plano → continuar sem Mobbin e anotar.
4. **v0 via One:**
   - `list_one_integrations` (platform `v0`) → connection_key
   - `search_one_platform_actions` → Create Chat / Send Message / Get Chat Files
   - `get_one_action_knowledge` **sempre** antes de `execute_one_action`
   - Briefing: mobile-first `max-w-md`, tokens primary `#10b748`, Plus Jakarta Sans
   - **Regra anti-plano-só:** após Create Chat / primeira mensagem, se o v0 devolver apenas um plano (sem JSX/preview), **obrigatório** Send Message a mandar construir («Implementa o plano agora — gera a interface completa com código»). Verificar Get Chat Files / mensagem com código antes do VERDICT APPROVE. Nunca fechar o design gate só com o plano elaborado.
   - Não criar/deploy Vercel project sem confirmação do utilizador
5. **shadcn MCP:** search/view → listar primitivos a adicionar (`@shadcn/...`); preferir reutilizar `src/components/ui/`.
6. Escrever artefacto curto (ex. `.specs/.../design.md` ou bloco no Spec): flow, estados, componentes shadcn, link/id chat v0, notas Mobbin/UI Skills.

## Saída

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se incompleto) o que falta para gate design pronto
```

Gate **APPROVE** só com: flow + estados + componentes identificados + referência v0/shadcn.
