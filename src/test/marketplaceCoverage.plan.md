# Plano de cobertura — marketplace (pós-wave)

Gerado pelo agente TEST & INTEGRATION. Não executar novos testes de auditoria até a wave de produto fechar (baseline mid-wave: 378/397).

## Ordem

1. Suite verde (fechar 19 fails mid-edit nos scopes alheios).
2. `MarketplaceAuditScenarios.test.jsx` novo — blocos A–E de AUDIT_GAPS_WAVE.md.
3. Checklist RLS/RPC via Supabase MCP (bloco G).
4. Actualizar MKT-* Status em spec.md.

## Não fazer agora

- Editar testes/produto dos outros agents.
- «Corrigir» produto para verde durante a wave.
- Commit sem pedido do utilizador.

Ver: `.specs/features/marketplace-oferta-procura/AUDIT_GAPS_WAVE.md`
