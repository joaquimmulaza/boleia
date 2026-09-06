# Quick Task: Ponto de Recolha / Pickup Opcional em Grupos

## Contexto & Problema
No fluxo de fallback de convite por telefone (`GrupoProcuraPanel.jsx`), o utilizador pode adicionar um membro ao grupo.
A interface rotula o campo de recolha como «Ponto de recolha (opcional)». No entanto, anteriormente o componente `AddressInput.jsx` continha o atributo HTML `required` hardcoded no `<input>`, impedindo a submissão do formulário no browser quando o campo de recolha estava vazio (emitindo o erro nativo do browser de validação de formulário «Preencha este campo»).
Além disso, se strings vazias (`""`) ou espaços fossem passados, poderiam ser persistidos como `""` em vez de `null` no Supabase.

## Matriz de Requisitos

| Fluxo | Campo Telefone | Ponto de Recolha (pickup) |
|---|---|---|
| Descoberta principal (`GrupoDescobertaPanel`) | Não apresentado | N/A (não requerido, persiste `null`) |
| Fallback por telefone (`GrupoProcuraPanel`) | Obrigatório | Opcional (submissão vazia persiste `null`) |

## Auditoria Full-Stack por Camadas

1. **UI (`AddressInput.jsx`, `GrupoProcuraPanel.jsx`):**
   - `AddressInput.jsx` recebe prop `required = true` por defeito (mantendo comportamento obrigatório em `PassengerDashboard` e `PublishRoute`).
   - `AddressInput.jsx` usa `id={id || name}` e `<input required={required} ... />`.
   - `GrupoProcuraPanel.jsx` passa explicitamente `required={false}` ao `AddressInput` do ponto de recolha.
   - `GrupoProcuraPanel.jsx` limpa coordenadas se o utilizador apagar o texto de recolha.

2. **Validação de Cliente (`GrupoProcuraPanel.jsx`):**
   - Submissão com `pickup_name` vazio ou apenas espaços coerce `pickup_name`, `pickup_lat` e `pickup_lng` para `null`.

3. **Camada de Serviço (`GrupoService.js`):**
   - `addMembroGrupo` e `pedirEntradaGrupo` sanitizam strings vazias/em branco para `null`, e forçam `pickup_lat`/`pickup_lng` para `null` caso `pickup_name` não esteja preenchido ou coordenadas sejam inválidas.

4. **Backend / RPCs / Políticas RLS / Base de Dados:**
   - As colunas `pickup_name`, `pickup_lat`, `pickup_lng` em `membros_grupo` e `acordos_passageiros` são `is_nullable = YES` e com valor padrão `NULL`.
   - RPCs `accept_proposal` e `leave_grupo_membro` já aceitam e propagam valores `NULL` sem restrições nem falhas.
   - Nenhuma política RLS ou trigger restringe a nulidade dos campos de pickup.

5. **Testes (TDD):**
   - `AddressInput.test.jsx`: renderização com `required` por omissão e `required={false}` explícito.
   - `GrupoProcuraPanel.test.jsx`: submissão bem-sucedida com pickup vazio/em branco persistindo `null`.
   - `GrupoService.test.js`: coerção de strings vazias para `null` no `insert`/`update`.
