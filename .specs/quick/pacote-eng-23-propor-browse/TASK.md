# PACOTE #23 — Propor acordo no browse

## Goal
Passageiro autenticado propõe acordo a partir do feed Explorar/Ofertas.

## Plano (diff mínimo)
- Reutilizar `OfertaMatchCard` (variante `browse` + `onPropor`)
- Reutilizar `createProcura` + `createProposta` (valores da oferta)
- Novo util `buildProcuraMinimaFromOferta` (flex sem OD; fixa exige coords)
- Sem migration/schema

## AC
1. CTA «Propor acordo» no browse (auth via ProtectedRoute + callback)
2. Procura mínima criada no momento — sem bloqueio surpresa
3. Flex: `labelRotaOferta` / OD null
4. Valores proposta = oferta (`modo_preco`, `valor_mensal_ask_kz`)
