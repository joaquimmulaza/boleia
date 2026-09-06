# Quick: Gaps DB/Segurança (audit prompts)

**Quick Task:** Hardening RLS `membros_grupo`, `accept_proposal` com `p_member_ids`, estados adenda + `reject_agreement_adenda`.

**Files:** `supabase/migrations/20260906120000_audit_gaps_rls_accept_member_ids_adenda_reject.sql` (+ apply MCP)

**Approach:** Uma migração incremental SECURITY DEFINER + RLS WITH CHECK; divisor adenda = `N_contrato`.

**Verify:** Políticas RLS / assinaturas RPC via `execute_sql` pós-apply; cenários Vitest ficam para o agente TDD.

**STATUS:** Done (DB, remoto boleia) — serviços JS / UI fora de scope.

**Remoto (MCP):** `audit_gaps_rls_membros_and_adenda_estados`, `audit_gaps_accept_proposal_member_ids`, `audit_gaps_renegotiate_n_contrato`, `audit_gaps_reject_agreement_adenda`, `audit_gaps_apply_due_em_vigor_v2`.
