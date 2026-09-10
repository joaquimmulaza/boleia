# Ops piloto — 1.º acordo (B3)

Passos mínimos para operador com `perfis.is_admin = true`.

## Pré-requisitos deploy (Joaquim)
- `VITE_PLATFORM_IBAN` configurado no Vercel (B2 — fechado)
- Motorista: veículo + oferta publicada; **IBAN + titular** em `/perfil`

## Fluxo pagamento → lugar activo

1. Passageiro aceita proposta → lugar **Reservado** (TTL 72h sem comprovativo).
2. Passageiro envia comprovativo em `/acordos` → estado `comprovativo_enviado`.
3. Admin abre **`/admin/pagamentos` → Validar comprovativos**.
4. Pré-visualizar PDF → **Aprovar** → pagamento `em_custodia` + passageiro **Confirmado** (`activo`).
5. Contactos desbloqueiam após `em_custodia` (gate `get_acordo_contactos`).

## Liquidação motorista (fim de ciclo)

1. Tab **Custódia e liquidação** — confirmar pagamentos `em_custodia`.
2. Motorista deve ter **IBAN + titular** no perfil; caso contrário a liquidação falha com erro explícito.
3. **Liquidar período** (mês corrente Africa/Luanda) ou liquidar linha individual.

## Reserva expirada (TTL)

- Sem comprovativo em 72h: RPC lazy `apply_due_reserva_expiry` liberta a vaga (corre ao abrir `/acordos`).
- Com comprovativo pendente de validação: a reserva **não** expira até admin aprovar/rejeitar.
