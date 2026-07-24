# Plano de Implementação: Onboarding de Permissões (Soft Prompting)

## 1. Contexto e Requisitos

A meta é introduzir um fluxo de **Soft Prompting** para permissões de Notificações Push e Geolocalização durante o Onboarding (pós-login) ou via Dashboard, para contas existentes que ainda não ativaram estes recursos.

### Regras de Negócio:
* **Estado do Utilizador**: Verificar o estado real das permissões através das APIs nativas (`Notification.permission` e `navigator.permissions.query({ name: 'geolocation' })`).
* **Persistência de Decisão**: A tabela `perfis` deve ter ou gerir uma flag `onboarding_completed: boolean` (default false) para garantir que o utilizador que clicou em 'Agora Não' não volte a ser interrompido na mesma sessão/dispositivo.
* **Notificações**: Associar a ativação ao ecossistema de Web Push da aplicação.
* **Localização**: Guardar as coordenadas no MapLibre / state da aplicação.
* **UI**: Invocar o MCP do Stitch para gerar um componente de Onboarding Overlay (translúcido ou Bottom Sheet elegante) seguindo o Material Design 3 (M3). Textos persuasivos e dois botões: 'Ativar Recursos' (alta ênfase) e 'Agora Não' (baixa ênfase).

## 2. Abordagem Spec-Driven / TDD (Método Akita)

A suite de testes já foi escrita e encontra-se em `src/components/OnboardingPermissions.integration.test.jsx`.

### Cenários Cobertos:
* **Cenário A**: Se as permissões nativas já forem 'granted' ou se `onboarding_completed` for true, o Onboarding NÃO deve ser renderizado no dashboard.
* **Cenário B**: Se forem default, a UI de Soft Prompting deve ser montada no dashboard após o login.
* **Cenário C**: Clicar em 'Ativar' deve disparar os métodos nativos e registar o utilizador nas notificações e localização.
* **Cenário D**: Clicar em 'Agora Não' deve fechar o componente e persistir o estado de recusa na BD para não voltar a incomodar o cliente.

### Estado Atual (RED Phase)

Foi criado um dummy component para permitir a execução dos testes. A execução atual falha como esperado (RED), provando a blindagem da funcionalidade.

```text
 FAIL  src/components/OnboardingPermissions.integration.test.jsx > OnboardingPermissions Integration > Cenário B: Deve montar a UI de Soft Prompting no dashboard se as permissões forem default
TestingLibraryElementError: Unable to find an element with the text: /Ativar Recursos/i.

 FAIL  src/components/OnboardingPermissions.integration.test.jsx > OnboardingPermissions Integration > Cenário C: Clicar em "Ativar Recursos" deve disparar métodos nativos
TestingLibraryElementError: Unable to find an element with the text: /Ativar Recursos/i.

 FAIL  src/components/OnboardingPermissions.integration.test.jsx > OnboardingPermissions Integration > Cenário D: Clicar em "Agora Não" deve fechar componente e persistir decisão
TestingLibraryElementError: Unable to find an element with the text: /Agora Não/i.
```

## 3. Próximos Passos (Para o Agente Orquestrador)

O Agente Orquestrador deve prosseguir com as seguintes etapas:

1. **Geração de UI (Stitch-First)**:
   - Invocar o MCP do Stitch (`generate_screen_from_text` ou `edit_screens`) passando as diretrizes de Material Design 3 e o contexto visual da Boleia Certa (transporte partilhado, Luanda, utilitário, mobile-first).
   - Gerar um overlay translúcido ou Bottom Sheet com os textos e botões solicitados.
2. **Implementação do Componente React**:
   - Analisar o design gerado no Stitch.
   - Implementar o componente `OnboardingPermissions.jsx` usando Tailwind CSS e lendo o estado via hook `useAuth()`.
   - Adicionar as lógicas de pedido de permissões nativas ao clique de "Ativar Recursos".
   - Adicionar a lógica de persistir a recusa na DB (`supabase.from('perfis').update({ onboarding_completed: true })`) ao clique de "Agora Não".
3. **Validação (GREEN Phase)**:
   - Correr novamente `npm run test:run -- src/components/OnboardingPermissions.integration.test.jsx`.
   - Garantir que todos os testes passam (Verde).
4. **Integração de Rotas / Dashboard**:
   - Integrar o `<OnboardingPermissions />` no Layout global ou no Dashboard de forma a que monte assim que o utilizador entrar autenticado.
5. **Commit Automático**:
   - Após passar os testes e linting, executar o fluxo de Git (add, commit, push) com mensagem descritiva (ex: `feat: add onboarding permissions soft prompt`).
