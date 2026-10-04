# Apagar a própria conta

O controlo está em `/perfil` (`Profile.jsx`): «Apagar conta» abre `ConfirmationModal`. Confirmar chama `deleteOwnAccount()` → RPC `delete_own_account()` (sem id) → `clearAppBadge` → `signOut({ scope: 'local' })`. `ProtectedRoute` manda para `/auth`.

A função já existe em produção (`20261004072610`). Este PR não inclui migração.
