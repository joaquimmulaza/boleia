# Perfis — o cliente deixa de pedir colunas sensíveis

A versão `20261004073111` já está em produção. Este trabalho não adiciona migração nem altera grants.

## Leituras que pediam `telefone`, `iban` ou `is_admin`

- `findPassageiroByTelefone` fazia `select` em `perfis`. Passa a `lookup_perfil_por_telefone` e fica com `id` e `nome_completo`.
- `getProfile` e `AuthContext` fazem `select('*')` (o PostgREST só devolve colunas concedidas) e juntam telefone e IBAN com `get_own_perfil_contacto`. `is_admin` não entra no perfil.
- `AdminRoute` chama `is_platform_admin()`.
- `GrupoService` pede `perfis(nome_completo)`.
- `PaymentService` deixa de embutir `telefone` e `iban`. O aviso de IBAN usa `admin_motoristas_tem_iban`.
- `get_acordo_contactos` mantém-se para os contactos do acordo.

## Verificação

Testes Vitest dos serviços, `AdminRoute` e `AuthContext`.
