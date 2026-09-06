# Quick — Pickup opcional no convite por telefone

**Data:** 2026-09-06  
**Modo:** Quick  
**Causa:** `AddressInput` hardcodava `required`; label em `GrupoProcuraPanel` dizia «(opcional)».

## Objectivo

Alinhar UI / HTML / service / DB: o ponto de recolha **por membro** é opcional no convite por telefone (fallback). Telefone só é obrigatório **dentro** desse formulário auxiliar. O fluxo principal (descoberta → pedir entrada) continua sem telefone nem pickup.

## Regras

| Campo | Fluxo principal | Fallback telefone |
|-------|-----------------|-------------------|
| Telefone | Não aparece | Obrigatório |
| Pickup membro | N/A | Opcional (`null` OK) |
| WhatsApp | Auxiliar | Link auxiliar |

## Ficheiros

- `src/components/AddressInput.jsx` — prop `required` (default `true`)
- `src/components/GrupoProcuraPanel.jsx` — `required={false}` + coerce null
- Testes: `AddressInput.test.jsx`, `GrupoProcuraPanel.test.jsx`

## Verify

```bash
npm run test:run -- src/components/AddressInput.test.jsx src/components/GrupoProcuraPanel.test.jsx src/components/GrupoDescobertaPanel.test.jsx src/services/GrupoService.test.js
```

Browser: grupo 1/4 → fallback → telefone → pickup vazio → submit sem «Preencha este campo.»
