# PACOTE polish UX piloto reservado (Critiquito Partial)

Base: `cursor/seat-before-custody` (PR #100)

## Must
- Chip âmbar «Reservado» quando viewer/passageiro está `reservado`
- Linha «Confirmados X · Reservados Y»
- Glossário curto: Reservado / Confirmado / Em custódia
- Banner reservado com CTA pagamento (`focus=pagamento` / scroll ao painel)

## Out of scope
- RPC/migration seat-before-custody; redesign amplo; Pack B; ProxyPay

## DoD
- Testes Vitest (chip, contagens, glossário, banner→pagamento)
- PR draft com checklist Critiquito
