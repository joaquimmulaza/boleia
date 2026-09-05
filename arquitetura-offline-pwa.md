# Boleia Certa — Especificação de Arquitetura Offline-First & Sincronização em Background

Este documento estabelece as diretrizes de engenharia e os padrões arquiteturais para a implementação da engine de caching offline e sincronização em background da aplicação **Boleia Certa** no cenário real de conectividade intermitente em Luanda.

---

## 1. O Desafio de Luanda (Conectividade Volátil)

No ecossistema de transporte de Luanda (trajetos diários de pontos de recolha como o Kilamba, Viana ou Cacuaco para centros de trabalho como Talatona ou a Baixa), as redes móveis enfrentam oscilações críticas de sinal, congestionamento de largura de banda e partições temporárias de rede.

Do ponto de vista arquitetural, assumir que a aplicação opera num estado binário ("com rede" ou "sem rede") é uma falha de design. Devemos assumir um modelo de **Partição Tolerante (P)** sob o prisma do **Teorema de CAP**. Numa rede distribuída com falhas constantes, o Boleia Certa escolhe a **Disponibilidade (A)** sobre a **Consistência Imediata (C)**, recorrendo ao padrão de **Consistência Eventual (Eventual Consistency)** suportado por sincronização assíncrona em background.

Esta arquitetura garante duas metas fundamentais de Interaction Design (UX):
1. **Operação offline transparente**: O utilizador pode navegar nos seus trajetos, consultar preços (teto mensal) e propor alterações contratuais mesmo sem sinal.
2. **Responsividade instantânea**: A aplicação não exibe spinners de carregamento de rede bloqueantes para carregar a interface (App Shell).

---

## 2. Divisão de Responsabilidades na Arquitetura PWA

Seguindo as melhores práticas do MDN para Progressive Web Apps, a nossa aplicação possui uma arquitetura desacoplada em duas linhas de execução:

1. **Main App Thread (React Frontend)**: Responsável exclusivamente por gerir o ciclo de vida da interface com o utilizador (UI), capturar eventos de interação e atualizar o estado local de forma reativa.
2. **Service Worker (sw.js - Separate Background Thread)**: Funciona como uma proxy de rede transparente baseada em eventos. Ele interceita as chamadas de rede do cliente, manipula o **Cache Storage** (utilizando a Cache API) e coordena as filas de reconciliação em segundo plano (Background Sync API).

---

## 3. Estratégias de Caching Diferenciadas

Não existe uma estratégia de cache universal para todos os recursos. O Boleia Certa adota três estratégias distintas com base na volatilidade do recurso:

### A. Cache-First (Precaching) para o App Shell
*   **Recursos**: Ficheiros estáticos essenciais (`index.html`, `app.js`, `style.css`, assets gráficos, ícones SVG e fontes).
*   **Comportamento**: No evento `install` do Service Worker, descarregamos estes recursos de forma preventiva e guardamos em cache. Ao abrir a aplicação, os ficheiros são sempre servidos a partir do armazenamento local (Cache API).
*   **Garantia de Freshness**: O Service Worker apenas atualizará os ficheiros estáticos no dispositivo quando uma nova versão do script `sw.js` for detetada (versão controlada pela constante estática `const VERSION = "vX"`). No evento `activate`, caches antigas são removidas de forma limpa para evitar fugas de espaço no armazenamento.

### B. Stale-While-Revalidate (Cache First com Refresh) para Leitura de Dados (Read-Path)
*   **Recursos**: Dashboards de acordos, listagens de grupos disponíveis, histórico de trajetos.
*   **Comportamento**: O cliente tenta ler os dados locais imediatamente do cache. Em paralelo (sem bloquear a renderização da UI), uma chamada assíncrona é disparada para o servidor (Supabase) via Fetch API para obter os dados mais frescos.
*   **Impacto de UX**: O utilizador vê instantaneamente o estado da sua boleia na tela ao abrir a aplicação, e a UI é atualizada de forma fluida e sem interrupções assim que a rede móvel responder com a versão fresca do backend.

### C. Network-Only para Escrita Crítica (Write-Path)
*   **Recursos**: Propostas de preço, cancelamento em cascata e transações de segurança RLS (ex: RPC `accept_proposal` ou RPC `leave_passenger`).
*   **Comportamento**: A aplicação nunca guarda em cache transações de modificação direta de estado contratual. Elas devem ir diretamente para a rede. Se a rede estiver indisponível, a transação é retida numa fila de execução assíncrona baseada em transações locais (IndexedDB) associada à **Background Synchronization API**.

---

## 4. O Motor de Sincronização em Background (Escritas Offline)

Para operações em que o passageiro ou o motorista tomam decisões contratuais críticas (ex: o motorista aceita uma proposta de contraparte ou o passageiro decide sair de um grupo) e a rede cai de imediato, implementamos a **Fila de Sincronização offline**.

### O Fluxo Atómico de Execução:

1.  **Interceção do Erro**: O utilizador clica em "Sair do Grupo" na UI. A chamada de rede falha silenciosamente no backend do browser devido a uma oscilação móvel de sinal em Luanda.
2.  **Armazenamento na Fila Local (IndexedDB)**: Em vez de exibir um ecrã de falha técnica genérica, o frontend interceita o erro de conexão e armazena o payload da transação (nome da RPC, argumentos seguros, timestamp) no **IndexedDB** da aplicação.
3.  **Registo do Sync Tag**: O frontend comunica com o Service Worker registando um evento de sincronização em segundo plano via `swRegistration.sync.register('sync-offline-actions')`.
4.  **Feedback Visual Positivo (Optimistic UI)**: A UI muda o estado do utilizador para "Saída Pendente" com um ícone visual sutil de "sincronização pendente". Isto evita a frustração de o utilizador não saber o que aconteceu.
5.  **Reestabelecimento de Rede**: Quando o sistema deteta que a conexão móvel do telemóvel estabilizou (ou o utilizador se move para uma área com melhor sinal), a infraestrutura do browser acorda o Service Worker em segundo plano.
6.  **Disparo do Evento `sync`**: O Service Worker escuta o evento `sync` e filtra pela tag `sync-offline-actions`.
7.  **Processamento da RPC Segura**: O Service Worker lê o payload do IndexedDB e executa de forma atómica a chamada Supabase à RPC `leave_passenger` ou outra correspondente.
8.  **Reconciliação e Resolução de Conflitos**:
    *   **Caso de Sucesso**: O Supabase processa a RPC. O estado local é limpo. O utilizador recebe uma notificação reativa através de `postMessage()` ou `BroadcastChannel` para remover o indicador "Pendente" da UI.
    *   **Caso de Conflito (Regra de Negócio Violada)**: Se durante o período offline o motorista já tivesse cancelado o acordo ou a proposta tivesse expirado, a RPC falha no servidor com um código de erro de integridade de domínio (ACID).
    *   **Push de Alerta de Conflito**: O Service Worker captura a falha de domínio, limpa a transação do IndexedDB e utiliza a **Push API** acoplada ao OneSignal/Supabase para disparar uma notificação local persistente no telemóvel do utilizador: *"O seu pedido de saída do grupo de boleias Kilamba-Talatona foi processado com conflito. Toque para ajustar"* [52, 53].

---

## 5. Matriz de Coesão Técnica (PWA e Supabase)

| Camada | Tecnologia Alvo | Estratégia de Sincronização | Finalidade no Produto |
| :--- | :--- | :--- | :--- |
| **Apresentação (UI)** | React Components + Service Worker Registration | **Optimistic UI Update** | Renderização imediata sem travar a interface ao clicar em CTAs [50, 77]. |
| **Armazenamento de Estado Local** | **IndexedDB API** | Transacional Não-Relacional | Guardar a fila de transações pendentes e cópias dos dashboards em formato JSON estruturado [46]. |
| **Interceptador de Tráfego** | **Service Worker Event (fetch)** | **Stale-While-Revalidate** | Intercetar queries estáticas e dados JSON de dashboards para resposta instantânea [11, 18, 46]. |
| **Fila de Background** | **Background Sync API** (Event `sync`) | **Eventual Consistency Pattern** | Sincronizar operações transacionais bloqueadas por falta de sinal móvel assim que a rede restabelecer [46]. |
| **Mensagens do Servidor** | **Push API + Notifications API** | **Push Events (Database Webhooks)** | Enviar atualizações imediatas de aceitação de acordos, alterações de preços (adendas) e alertas de conflitos de rede [19, 52]. |

---
