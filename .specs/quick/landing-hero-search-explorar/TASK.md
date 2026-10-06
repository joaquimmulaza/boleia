# Landing hero search → Explorar filtered

## Objetivo
Hero com pesquisa OD; «Ver boleias» navega para `/explorar` filtrado por raio 2500 m (matchingConfig). Ofertas flexíveis sem OD excluídas do filtro.

## Copy (LANDING_COPY_v1 §4)
- Campos: «De onde sais?» / «Para onde vais?»
- CTA card: «Ver boleias»; hero secundário: «Criar conta»
- Erros: «Indica de onde sais.» / «Indica para onde vais.»
- Sugestões: «Locais sugeridos»; vazio: «Nenhum local encontrado.»
- Explorar filtrado: «Boleias de {origem} para {destino}»; chip; Editar/Limpar
- Vazio: «Nenhuma boleia neste caminho» + corpo + «Criar procura» + «Ver todas as boleias»

## URL
`/explorar?origem=&destino=&origem_lat=&origem_lng=&destino_lat=&destino_lng=`

## Fora
Softs, Termos, novo card component.
