# perfis 42501 — motorista em /acordos

## Bug
Sessão motorista em `/acordos` (detalhe activo + painel pagamentos): 2× HTTP 401 em `/rest/v1/perfis`, consola `42501 permission denied for table perfis`. UI degrada (nomes «Passageiro») mas não rebenta.

## Causa
1. `AuthContext`/`fetchProfile`: GET exacto prod QA  
   `select=id,nome_completo,tipo_perfil,created_at,onboarding_completed,iban_titular,perfil_completo` → 401/42501 (suspeita `iban_titular` fora do SELECT grant em alguns ambientes).
2. `getAgreementsForDriver` embutia `perfis(nome_completo)` → fan-out `/rest/v1/perfis` por passageiro.

## Fix (só cliente)
- Remover embed `perfis` da query motorista; nomes via `get_acordo_contactos` + `list_pagamentos_pendentes_motorista_acordo`.
- Constantes `perfisGrants.js` alinhadas à migração SELECT.

## Fora de âmbito
Grants, RLS, migrações.
