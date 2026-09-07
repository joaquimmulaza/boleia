# PACOTE ENG #15 — Saída parcial passageiro (1:N)

## Objetivo
Um passageiro sai sem cancelar o acordo; N_activos desce; N_contrato histórico imutável.

## Decisões
- Reutilizar RPC `leave_passenger` (já existente) — alinhar libertação de vagas a `recount_oferta_vagas` (#8).
- **Não** mutar cabeçalho `acordos` (estado, `n_passageiros_contrato`, preços).
- **Não** recalcular quotas dos restantes.
- Rescisão total continua via `terminate_agreement` (fora deste pacote).

## Aceitação
1. Auth explícita (`auth.uid()` + permissão passageiro/motorista-alvo)
2. `acordos_passageiros.estado` → `saiu`; `n_passageiros_contrato` intacto
3. Sem defaults plataforma em preço/liquidação
4. `recount_oferta_vagas` + promote waitlist best-effort
5. Acordo `activo` se restarem passageiros activos
6. UI: «Sair só eu» só passageiro activo autenticado

## Ficheiros
- `supabase/migrations/20260907050000_pacote_eng15_saida_parcial_passageiro.sql`
- `src/services/PacoteEng15Acceptance.test.js`
