# Tasks: Integration Tests & Veiculos RLS Fix

1. **[x] Task 1 (Setup de Integração):** Configuração do `.env.test.local`, vite config e criação dos helpers atómicos do Supabase local (ex: `createTestUser`).
  
2. **[x] Task 2 (Migração DB):** Criar e executar a migração via Supabase MCP para aplicar a restrição: `ALTER TABLE veiculos ADD CONSTRAINT veiculos_id_motorista_key UNIQUE (id_motorista);`.

3. **[x] Task 3 (TDD Red):** Escrita do teste de integração em `VehicleSetup.integration.test.jsx`. O teste deve forçar o erro 403 e/ou violação do RLS que sofremos atualmente, fazendo um submit direto. Nenhum código funcional em `src/` deve ser alterado nesta task.

4. **[x] Task 4 (TDD Green & Refactor):** Alterar o `VehicleSetup.jsx` para utilizar de forma elegante o método `.upsert(payload, { onConflict: 'id_motorista' })` passando explicitamente `id_motorista: auth.uid()`, resolvendo o bug e fazendo o teste passar a 100% Verde.
