
**Invariantes de Arquitetura:** 

- TDD estrito. Mocks de rede Vitest devem simular falhas de rede físicas.

- GRAPHLORE-FIRST: Os agentes devem utilizar o MCP Graphlore para mapear dependências antes de qualquer alteração de ficheiros.



---



## 🔍 FASE 0: PROTOCOLO GRAPHLORE (Para Todos os Agentes)

Antes de escrever qualquer linha de código, executem as ferramentas do MCP `graphlore` (`graphlore_locate`, `graphlore_fetch`) para:

1. Localizar onde o cliente Supabase está instanciado.

2. Mapear o blast radius de `MyAgreements.jsx` e do service worker atual.

3. Identificar onde são feitas as chamadas à API que alteram o estado do marketplace (RPCs).



---



## 🛠️ DISTRIBUIÇÃO PARALELA DE TAREFAS



### 👤 SUBAGENTE DELTA: [PWA & Service Worker Specialist (sw.js)]

*   **Ficheiros Alvo:** `public/sw.js`, `src/registerServiceWorker.js`, `src/App.jsx`.

*   **Objetivo:** Implementar o App Shell precaching, stale-while-revalidate e reatividade de rede.

*   **Instruções de Implementação:**

    1.  **Precaching do App Shell:** Configurar o evento `install` no `sw.js` para fazer cache-first de todos os estáticos essenciais do build do React (`index.html`, `app.js`, `style.css`, ícones e manifest JSON) [16, 17].

    2.  **Stale-While-Revalidate Handler:** No intercetador `fetch`, implementar stale-while-revalidate para queries JSON de dashboards (especialmente para as listagens de acordos ativos e grupos abertos) [18, 19].

    3.  **Reatividade de Rede (UI Status Hook):** Criar e exportar um hook `useNetworkStatus()` no React que escuta os eventos `online`/`offline` e expõe um estado `isOffline` global para exibir um banner visual de aviso em Luanda.

    4.  **Gestão de Memória:** Configurar o evento `activate` para eliminar caches obsoletas comparando com `const VERSION = "v1"` [17, 20].



---



### 👤 SUBAGENTE EPSILON: [Database Sync, IndexedDB & Idempotency Architect]

*   **Ficheiros Alvo:** `src/services/offlineQueue.js`, `src/services/db.js`, `src/services/AgreementService.js`.

*   **Objetivo:** Criar a fila de persistência offline resiliente a falhas e duplicações.

*   **Instruções de Implementação:**

    1.  **IndexedDB Engine:** Criar uma store transacional chamada `offline_write_queue` para guardar os payloads de chamadas RPC de modificação de dados (cancelamentos de propostas, saídas de grupo) [11].

    2.  **Chave de Idempotência Obrigatória:** Cada payload guardado na fila offline deve conter um cabeçalho `idempotency_key` (UUID v4 gerado no cliente). A fila deve usar esta chave para garantir que, caso uma transação seja reenviada pelo Service Worker devido a um timeout falso de rede, a base de dados ignore a duplicação.

    3.  **Integração com Background Sync:** Ao detetar falha de fetch no frontend, gravar o payload com a sua chave de idempotência no IndexedDB e registar um sync event no Service Worker registration com a tag `sync-offline-actions` [3, 12].

    4.  **Sync Event Handler (no sw.js):** Adicionar o event listener para `sync` que lê o IndexedDB, executa sequencialmente as chamadas à API do Supabase e limpa a fila local apenas após a resposta `200 OK` do servidor [21, 22].



---



### 👤 SUBAGENTE ALPHA: [TDD Guard / QA Lead]

*   **Ficheiros Alvo:** `src/__tests__/OfflineSyncEngine.test.jsx`.

*   **Objetivo:** Blindar os cenários de conectividade volátil por testes automatizados.

*   **Instruções de Implementação:**

    1.  **Testes de Quebra de Conexão:** Escrever asserts Vitest que simulem a falha física da rede (`navigator.onLine = false` ou fetch reject) ao tentar executar ações contratuais na UI do Boleia Certa.

    2.  **Asserts de Persistência:** Validar que o payload da transação (incluindo a `idempotency_key`) é devidamente armazenado na fila do IndexedDB quando a rede falha [11].

    3.  **Asserts de Idempotência:** Simular duas tentativas de sincronização do mesmo evento com o mesmo UUID. Validar se a segunda tentativa é tratada com sucesso sem criar registos duplicados na DB.

    4.  **Asserts de Reconciliação:** Validar que o Service Worker drena a fila de transações e restabelece a consistência com o banco do Supabase assim que a conexão volta ao estado ativo [12, 22].

Vou mapear a arquitectura actual com Graphlore e o documento offline antes de definir o plano Wave 3.

O brief aponta para ficheiros que não batem com o stack actual — vou confirmar a config PWA e se as RPCs já aceitam idempotência.

Há dois bloqueios que mudam o plano: o documento de arquitectura não está no repo, e a árvore git não está limpa. Preciso destas respostas antes de fechar o plano.

Mapeamento Graphlore + código feito. Ainda não fecho o plano — há decisões que mudam o desenho.

O que o grafo / repo mostram
Alvo do brief	Realidade no repo
public/sw.js + registerServiceWorker.js
SW em src/sw.js via VitePWA injectManifest + registo por virtual:pwa-register/react em UpdatePrompt.jsx / App.jsx
arquitetura-offline-pwa.md
Não existe no repositório
Árvore limpa
Não: marketplace T29–T35 / testes / specs uncommitted
Cliente Supabase
src/lib/supabase.js — god node (grau 39)
Blast MyAgreements.jsx
→ AgreementService (leavePassenger, adendas, listagens)
RPCs de escrita
accept_proposal, leave_passenger, cancel_proposal, reject_proposal, leave_grupo_membro, promote_waitlist, adendas — sem idempotency_key
Testes em src/__tests__/
Proibido no repo — testes ao lado do código
Precaching do app shell já existe (precacheAndRoute + globPatterns). Falta SWR para JSON, fila offline, sync e banner de rede.

Perguntas (responde com as letras)
1. Documento + árvore

A) Brief Wave 3 v3.1 = SoT; implementar sobre o working tree actual
B) Brief = SoT; só depois de deixares a árvore limpa
C) Vais colar arquitetura-offline-pwa.md antes do plano
2. Idempotência (nada na BD hoje)

A) Full: migração Supabase MCP + RPCs deduplicam por UUID
B) Só cliente (fila IndexedDB); servidor na wave seguinte
C) MVP: só leave_passenger + cancel_proposal com migração RPC
Default se não responderes: 1A + 2C, adaptar ao stack VitePWA (src/sw.js, sem public/sw.js), testes colocados (ex. offlineQueue.test.js / OfflineSyncEngine.test.js), e sync no SW com JWT capturado no enqueue (+ fallback online no cliente, porque Background Sync não é universal).