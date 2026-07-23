# Integration Tests & Veiculos RLS Fix Specification

## Problem Statement

Atualmente, não possuímos uma infraestrutura para correr testes de integração reais contra a base de dados do Supabase. Como resultado, problemas de integração entre o Frontend e o Supabase, como políticas RLS (Row Level Security) e constraints de base de dados, passam despercebidos. Concretamente, um erro "403 Forbidden" está a bloquear a atualização (via a componente `VehicleSetup.jsx`) de registos de veículos pelos utilizadores, porque a componente tenta executar operações de `.insert()` agnósticas (que quebram as constraints de unicidade e a RLS), em vez de operações `.upsert()` passando corretamente o ID do autorizador (`id_motorista`).

## Goals

- [ ] Configurar um ambiente de testes de integração real no Vitest apontando para o Supabase local (porta `54321`) com base em utilitários atómicos isolados (teardown limpo por teste sem recurso a um ficheiro `seed.sql` global).
- [ ] Reproduzir, sob forma de um teste reprovado no Vitest, a falha 403 / erro de inserção cega existente no `VehicleSetup.jsx`.
- [ ] Refatorar a operação DB em `VehicleSetup.jsx` para suportar o estado de atualização do utilzador com a chave `id_motorista` explícita, resolvendo o bug e passando o teste (Verde).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature     | Reason         |
| ----------- | -------------- |
| Automação em CI/CD | GitHub Actions e pipelines remotas de teste não serão suportadas nesta task. O foco é execução manual local. |
| Cobertura Completa de Tabelas | Apenas testaremos fluxos relacionados com a tabela `veiculos`. Testar de forma extensiva outras entidades como `routes` e `acordos` fica para outra task. |

---

## User Stories

### P1: Configuração do Motor de Testes Integrais ⭐ MVP

**User Story**: Como QA Engineer, quero correr testes Vitest contra uma instância vazia da base de dados local do Supabase para que todas as manipulações (DML) e validações sejam realistas.

**Why P1**: Este é o pré-requisito técnico para escrever ativamente o teste falhado e corrigir o Bug RLS subsequentemente.

**Acceptance Criteria**:

1. WHEN correr scripts de test como `npm run test:integration` THEN o sistema SHALL ler configurações de DB de um ficheiro `.env.test.local`.
2. WHEN iniciar o ciclo de um teste de integração THEN o sistema SHALL disponibilizar helpers como `createTestUser()` capazes de inserir e autenticar falsos utilizadores limpos via GoTrue local.
3. WHEN concluir a suite de testes THEN o sistema SHALL destruir/limpar os dados transacionados no próprio teardown function para manter um estado DB puro.

**Independent Test**: Correr um `dummy.integration.test.js` onde se cria e destrói 1 TestUser sem erro.

---

### P2: O Teste de Fluxo RLS de `veiculos`

**User Story**: Como Desenvolvedor em *Vibe Coding*, quero garantir a falha prévia do comportamento do `VehicleSetup.jsx` de tentar forçar submits sem o `id_motorista` correto.

**Why P2**: É a implementação direta da regra basilar do projeto de obrigatoriedade de **Test-Driven Development (TDD)**.

**Acceptance Criteria**:

1. WHEN o teste interage com os métodos de payload DB para salvar/editar um veículo THEN o sistema SHALL retornar erro de Unauthorized ou violação de restrição se a chave não estiver formatada.

**Independent Test**: Teste unitário em `VehicleSetup.integration.test.jsx`.

---

### P3: Implementação de .upsert() em `VehicleSetup.jsx` e Sucesso

**User Story**: Como Motorista, quero poder adicionar e posteriormente editar as informações da minha viatura sem ser bloqueado por restrições de sistema não tratadas por erro de código do cliente.

**Why P3**: Valor de negócio e fecho de bug originário de TDD.

**Acceptance Criteria**:

1. WHEN a view do `VehicleSetup.jsx` submeter o formulário de gravação com alterações THEN o componente SHALL agrupar o `id_motorista` em conformidade no objeto com o valor explícito da `auth.uid()`.
2. WHEN ocorrer o envio do payload ao Supabase THEN o componente SHALL usar uma abordagem idênpotente de gravação (e.g. `upsert` baseada na PK).

---

## Requirement Traceability

| Requirement ID | Story       | Phase  | Status  |
| -------------- | ----------- | ------ | ------- |
| INTG-01      | P1: Setup Vitest com Supabase Local | Spec | Pending |
| INTG-02      | P2: Teste TDD (Falhado) do Veículo | Spec | Pending |
| INTG-03      | P3: Refatoração `VehicleSetup.jsx` | Spec  | Pending |

**Coverage:** 3 total, 0 mapped to tasks, 3 unmapped ⚠️

---

## Success Criteria

- [ ] Correr `vitest run src/components/VehicleSetup.integration.test.jsx` e obter passabilidade de 100% debaixo das flags ativas de um `.env.test.local`.
- [ ] Os logs do console e DB devem demonstrar que nenhum registo persistiu após a limpeza do hook `afterAll()`.
