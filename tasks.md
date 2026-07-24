# tasks.md — Boleia Certa: Registo de Tarefas

## Onboarding de Permissões (Soft Prompting)

- [x] **TDD — Fase RED:** Suíte de testes de integração criada em `src/components/OnboardingPermissions.integration.test.jsx` cobrindo os 4 cenários (A, B, C, D).
- [x] **Design Stitch:** Screen "Permission Overlay" gerado no projeto Boleia Certa (Stitch #16509963580370012988, Screen #34536da98a764be0a8909bfac3fcc776). Design System "Boleia Certa" criado com primary #16a34a, Inter font, M3.
- [x] **Componente `OnboardingPermissions.jsx`:** Implementado em `src/components/` seguindo fielmente o design do Stitch (M3 Bottom Sheet, FilledButton verde, TextButton cinza). Lógica de visibilidade nativa via `Notification.permission` e `navigator.permissions.query`.
- [x] **Cenário A:** Componente não renderiza se `Notification.permission === 'granted'` ou `profile.onboarding_completed === true`.
- [x] **Cenário B:** UI de soft prompt monta corretamente quando as permissões são `'default'`.
- [x] **Cenário C:** Clicar em "Ativar Recursos" dispara `Notification.requestPermission()` e `navigator.geolocation.getCurrentPosition()`.
- [x] **Cenário D:** Clicar em "Agora Não" fecha o componente imediatamente (otimista) e persiste `onboarding_completed: true` na tabela `perfis` via Supabase.
- [x] **Resiliência Local (Luanda-proof):** Se a chamada à BD falhar por latência, o componente já fechou localmente — o utilizador nunca fica bloqueado.
- [x] **Integração no Layout:** `<OnboardingPermissions />` adicionado ao `Layout.jsx` global, montando em todas as rotas autenticadas.
- [x] **Fase GREEN:** Todos os 5 testes passam a verde (100%).
