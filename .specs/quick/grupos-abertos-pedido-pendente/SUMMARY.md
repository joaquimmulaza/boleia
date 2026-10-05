# Summary: Grupos abertos hidratam pedido pendente

O refresh deixava o CTA em «Pedir entrada» porque `enviados` só existia em memória. `listGruposAbertos({ passengerId })` lê `membros_grupo` com `estado = pendente` e marca `pedido_pendente` sem retirar o grupo. O painel semeia «Pedido enviado» nesse carregamento. Grupo sem pedido mantém o envio actual. Sem schema.

## Commit

`fix(grupos): hidratar pedido pendente nos grupos abertos`
