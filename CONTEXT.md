# Contexto e Regras de Desenvolvimento (Boleia Certa)

## 1. O Projeto (MVP)
Plataforma de *matchmaking* para rotas de transporte diário e acordos de pagamento partilhado.
Stack: React + Vite, Tailwind CSS, Lucide React (Frontend); Supabase (Backend/Auth/DB). Tudo alojado de forma 100% gratuita.

## 2. Princípios de "Vibe Coding" com Disciplina (O Método Akita)
* **TDD Obrigatório (Test-Driven Development):** NUNCA escrevas código de produção (features, componentes, rotas) sem antes escrevermos os testes correspondentes. O fluxo é: 1. Escrever Testes (e mockar o necessário) -> 2. Executar (vão falhar) -> 3. Escrever Código -> 4. Passar nos Testes.
* **Modularidade:** Mantém os ficheiros pequenos e o código altamente modular. Se um ficheiro crescer demasiado, para e sugere uma refatoração.
* **Um Passo de Cada Vez:** Resolve apenas o problema que foi pedido no prompt. Não tentes prever e construir funcionalidades futuras não solicitadas.
* **Segurança Primeiro:** Nunca coloques passwords, chaves de API (como a do Supabase) ou tokens hardcoded no código. Usa sempre variáveis de ambiente (`.env`).
* **Sem Confirmações Cegas:** Se te deparares com uma ambiguidade arquitetónica, para e pergunta. Não tomes o caminho de menor resistência se isso comprometer a qualidade.
* **Refatoração Contínua:** Constantemente procura código morto, duplicações ou lógicas pesadas e sugere melhorias.
* **Integração de Rotas Contínua:** Sempre que criares uma nova página (`.jsx`), tens OBRIGATORIAMENTE de ir ao ficheiro `src/App.jsx` e registar a nova rota correspondente dentro do `react-router-dom`. Além disso, deves verificar se os links de navegação (como os do `MainLayout.jsx`) precisam de ser atualizados para apontar para a nova página.
* **REGRA DE OURO UI:** Todas as interfaces devem ser implementadas usando a skill `react-components` lendo diretamente os designs do Google Stitch via MCP. É estritamente proibido inventar ou adivinhar estilos Tailwind. O design do Stitch é a única fonte de verdade.

## 3. Como a IA deve atuar
Lê este documento antes de iniciares qualquer nova funcionalidade. Se eu te pedir para criar um componente X, a tua primeira resposta DEVE ser o código do teste para esse componente X.
## 4. Integração com Google Stitch (Workflow de Alta Precisão)
* Temos o MCP do Google Stitch (https://github.com/google-labs-code/stitch-skills) e as `stitch-skills` instaladas.
* **Contexto Visual Imutável:** A aplicação é estritamente sobre mobilidade urbana, transporte partilhado e boleias diárias (casa-trabalho) em Luanda, Angola. A moeda a utilizar é SEMPRE o Kwanza (Kz). O tom visual deve ser urbano, utilitário, de confiança e focado na rotina, NUNCA focado em turismo ou viagens de férias.
* **Fluxo de Trabalho Obrigatório com Stitch (Secção a Secção):**
  1. **TDD:** Escreves e corres os testes unitários da funcionalidade.
  2. **Enhance Prompt:** Invocas a skill `enhance_prompt` passando os requisitos básicos e exigindo que a skill injete o "Contexto Visual Imutável" descrito acima para gerar um prompt de design perfeito.
  3. **Geração:** Envias o prompt melhorado gerado no passo 2 para o Stitch via MCP.
  4. **Integração:** Invocas a skill `react_components` para analisar o design gerado no Stitch e traduzi-lo fielmente para o código React do nosso projeto.
  5. **Validação:** Ajustas o código importado para garantir que os testes do Passo 1 passam a verde.

## 5. Master Version Control (Commit Automático)
* Seguimos a regra de "Commit Often, With Clear Messages" do roadmap de Vibe Coding.
* O **Agente Integrador** (ou o último agente a trabalhar numa *feature*) tem a OBRIGAÇÃO de fazer o commit do código SE, E SÓ SE, todos os testes (QA, AST Validator) passarem a 100% (Verde).
* **Fluxo de Git Obrigatório após o Sucesso:**
  1. Executar `git add .`
  2. Executar `git commit -m "[Tipo]: Breve descrição do que foi feito e porquê"`. (Tipos válidos: `feat`, `fix`, `ui`, `refactor`, `test`, `chore`). A mensagem de commit deve ser clara e explicar *o que* mudou e *porquê*.
  3. Executar `git push`.
* Se os testes estiverem a falhar, o agente é ESTRITAMENTE PROIBIDO de fazer commit do código quebrado.

## 6. Débito Técnico / Próximos Passos
* A tabela `routes` é agora a única fonte de verdade para os trajetos dos motoristas. A antiga tabela `rotas_diarias` foi descontinuada e removida.
* O sistema de Geocoding já foi implementado com sucesso. As coordenadas de latitude e longitude (`origin_lat`, `origin_lng`, `destination_lat`, `destination_lng`) são geradas via Google Maps API no momento da publicação do trajeto e salvas na tabela `routes`.

## 7. Acordos (Agreements)
Um Acordo na tabela `acordos` tem os seguintes estados (`estado`): 'pendente', 'ativo', e 'cancelado'.
A página de gestão de acordos é **exclusivamente** `MyAgreements.jsx` (rota `/acordos`). A antiga `AgreementsPage` foi descontinuada e removida.

## 8. Rotas e Navegação (Estrutura de Componentes)
A aplicação usa um componente `<Layout>` global que envolve todas as páginas autenticadas e inclui a `BottomBar` de navegação inferior. A árvore de navegação é:

```
<App>
  <BrowserRouter>
    ├── /                 → <LandingPage />   (redireciona por perfil se autenticado)
    ├── /auth             → <Auth />          (pública)
    └── <Layout>          (global, contém <BottomBar>)
        ├── /passageiro   → <PassengerDashboard />
        ├── /motorista    → <DriverDashboard />
        ├── /veiculo      → <VehicleSetup />
        ├── /publicar-trajeto → <PublishRoute />
        ├── /acordos      → <MyAgreements />  ← PADRÃO (único componente de acordos)
        ├── /faltas       → <AbsenceTracker /> (inclui /faltas/:acordoId)
        └── /perfil       → <Profile />
```

**BottomBar** liga as 4 secções principais: **Início**, **Acordos/Rotas**, **Faltas** e **Perfil**.

## Diretrizes de Desenvolvimento e UI/UX

REGRA ABSOLUTA DE DESIGN E INTERFACE (STITCH-FIRST):
O Google Stitch é o nosso Design System e a Única Fonte de Verdade. Tudo o que estiver relacionado com a interface de utilizador (UI) tem de passar obrigatoriamente primeiro pelo Stitch via MCP antes de ir para o código.
Fluxo de Trabalho Obrigatório: A interface é primeiro desenhada no Stitch, e só depois é implementada no código. É estritamente proibido inventar designs, estilos Tailwind ou fluxos de UX diretamente no código.
