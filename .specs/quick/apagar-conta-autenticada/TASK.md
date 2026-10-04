# Apagar a própria conta (app autenticado)

## O que a app já faz quando a pessoa quer sair

O cabeçalho autenticado (`Layout`) tem «Terminar sessão». Chama `supabase.auth.signOut()` e vai para `/auth`. A sessão acaba; a conta fica.

## Caminho que já apaga

A RPC `delete_own_account()` já está em produção (versão `20261004072610`). Não recebe id: apaga só `auth.uid()`. Este PR não cria migração nem altera a função.

## Diff

1. `AccountService.deleteOwnAccount()` → `supabase.rpc('delete_own_account')` sem argumentos.
2. `/perfil` (`Profile.jsx`): «Apagar conta» + `ConfirmationModal`. Confirmar chama a RPC, `clearAppBadge` e `signOut({ scope: 'local' })`. `ProtectedRoute` já manda para `/auth`. «Terminar sessão» no cabeçalho não muda.

Sem prazo, sem email, sem página pública.

## Fora

Ficheiro SQL (outro PR), políticas de `perfis`, páginas legais, Faltas, `/explorar`, grants `anon`, confirmação de email, leaked-password, G3, G4, Pack B, `.agent/`.
