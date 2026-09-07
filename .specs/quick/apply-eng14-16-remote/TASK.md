# Quick — apply eng14–16 remote + fix PaymentService test

## Goal

Align remote Supabase with `main` after PR #95: apply eng14/15/16; fix `rpc_idempotency.subject_id` in eng14 SQL; fix PaymentService mock for `mes_referencia`.

## DoD

- [x] eng14/15/16 applied on project `boleia`
- [x] `renew_agreement_period`, `notify_domain_event` exist remotely
- [x] PaymentService tests green
- [ ] PR opened (no auto-merge)

## Out of scope

- Setting `is_admin` (NEED_HUMAN + UUID)
- Re-applying eng5/13 (already on remote under different version names)
