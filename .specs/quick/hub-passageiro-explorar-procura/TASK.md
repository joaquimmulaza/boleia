# Hub passageiro — Explorar + procura no mesmo Início

**Data:** 2026-10-05  
**Design:** Figma `OUrBNaukPsXB14x2nwGSJy` página `155:2` (H1–H6). Critiquito APPROVE — Maestro auto_ok. Sem Stitch novo.  
**Fora:** softs, G3/G4, Pack B, migrações, merge, marketing `/explorar`.

## Problema

Com procura activa o hub substitui o feed Explorar por «A minha procura». O cartão do grupo não tem Editar/Apagar e «Sair» está solto no corpo. O cabeçalho de Faltas ainda mostra a palavra «Boleia Certa» ao lado do logotipo.

## Aceitação

1. WHEN há procura activa THEN o Início SHALL mostrar o segmented **Explorar | A minha procura** no mesmo ecrã (`/passageiro`), com tab inicial **Explorar** e cartão sticky da procura por cima das ofertas.
2. WHEN o passageiro escolhe «A minha procura» THEN o feed SHALL trocar in-place (detalhe H3), sem rota nova e sem esconder o chrome do Início.
3. WHEN o grupo existe THEN o kebab SHALL listar só acções reais: **Editar** (dono; capacidade ≥ membros actuais; recolha se existir; não reescreve propostas); **Apagar** só dono sozinho e sem acordo activo (omitir, não desactivar); **Sair** quando há outros membros. Convite e WhatsApp ficam no cartão.
4. WHEN o shell autenticado mostra a marca THEN SHALL ser só o logotipo, com navegação para o início do produto. `/explorar` público e páginas legais ficam como estão.

## Persistência (sem migração)

- `grupos` UPDATE/DELETE e `membros_grupo` UPDATE já cobertos por RLS do dono da procura.
- `n_maximo` CHECK actual é 2–8. A UI oferece 1–8 (floor = membros). Gravar 1 pode falhar no CHECK; a mensagem é explícita. Não há DDL neste PR.
- Apagar conta membros activos na base e acordos não terminais (`cancelado` / `expirado` não bloqueiam) antes do DELETE.
