# 🚌 Boleia Certa

> Plataforma de *matchmaking* para rotas de transporte diário e acordos de pagamento partilhado.

**Boleia Certa** liga passageiros e motoristas que partilham o mesmo trajeto diário casa-trabalho. Em vez de os tratar como viagens a pedido, formaliza **acordos de boleia recorrentes** com controlo de presenças, gestão de faltas e notificações em tempo real.

---

## ✨ Funcionalidades Principais

| Funcionalidade | Descrição |
|---|---|
| **Dual Dashboard** | Interfaces separadas para Passageiro e Motorista com fluxos otimizados |
| **Publicação de Trajetos** | Motoristas publicam rotas com Geocoding automático via Google Maps API |
| **Acordos de Boleia** | Sistema de matching com estados `pendente → ativo → cancelado` |
| **Registo de Faltas** | Passageiros e motoristas registam ausências por acordo |
| **Notificações Push** | Alertas em tempo real via Web Push (PWA) com deep linking |
| **Modo Escuro / Claro** | Tema persistente controlado por `ThemeContext` |
| **PWA** | Instalável no telemóvel com Service Worker e suporte offline |

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Utilização |
|---|---|---|
| [React](https://react.dev/) | 19 | UI e componentes |
| [Vite](https://vite.dev/) | 8 | Build & Dev Server |
| [React Router](https://reactrouter.com/) | 7 | Navegação SPA |
| [Tailwind CSS](https://tailwindcss.com/) | 4 | Estilos (mobile-first) |
| [Supabase](https://supabase.com/) | — | Auth, Base de Dados e Edge Functions |
| [Lucide React](https://lucide.dev/) | — | Ícones |
| [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) | — | Testes unitários e de integração |
| [Sentry](https://sentry.io/) | — | Monitorização de erros em produção |
| [Workbox](https://developer.chrome.com/docs/workbox) | 7 | Service Worker (PWA) |
| [Vercel](https://vercel.com/) | — | Alojamento (gratuito) |

---

## ⚙️ Instalação e Configuração

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- Uma conta [Supabase](https://supabase.com/) com projeto criado
- Uma chave de API do [Google Maps Platform](https://console.cloud.google.com/) (Geocoding API)
- (Opcional) Uma conta [Sentry](https://sentry.io/) para monitorização

### 1. Clonar o repositório

```bash
git clone https://github.com/joaquimmulaza/boleia.git
cd boleia-certa
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preenche o ficheiro `.env.local` com as tuas credenciais:

```env
# Supabase — Project Settings > API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here



# Sentry — Settings > Projects > Client Keys (DSN)
VITE_SENTRY_DSN=your-sentry-dsn-here

# Web Push — gerado pelo servidor (VAPID)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-here
```

> ⚠️ **Nunca** incluas o ficheiro `.env.local` num commit. Está protegido pelo `.gitignore`.

### 4. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A aplicação fica disponível em `http://localhost:5173` (ou no IP da rede local para testes em dispositivos móveis, graças ao flag `--host`).

---

## 🚀 Comandos Disponíveis

```bash
# Servidor de desenvolvimento (acessível na rede local)
npm run dev

# Correr todos os testes em modo watch
npm test

# Correr os testes uma única vez (para CI/CD)
npm run test:run

# Build de produção
npm run build

# Pré-visualizar o build de produção
npm run preview

# Verificar erros de linting
npm run lint
```

---

## 📁 Estrutura do Projeto

```
boleia-certa/
├── public/                    # Ficheiros estáticos e manifest da PWA
├── src/
│   ├── components/            # Componentes reutilizáveis
│   │   ├── AcordoDetailsModal.jsx   # Modal de detalhes de um acordo
│   │   ├── NotificationBell.jsx     # Central de notificações (slide-in panel)
│   │   ├── ProtectedRoute.jsx       # Guarda de rota com controlo de perfil
│   │   ├── ThemeToggle.jsx          # Seletor de tema claro/escuro
│   │   └── ...
│   ├── contexts/              # Contextos React globais
│   │   ├── AuthContext.jsx    # Sessão global, utilizador e tipoPerfil
│   │   └── ThemeContext.jsx   # Preferências visuais persistentes
│   ├── hooks/                 # Custom hooks reutilizáveis
│   │   ├── useAuthForm.js     # Lógica de formulários de autenticação
│   │   ├── useAutocomplete.js # Geocoding de endereços (Google Maps)
│   │   ├── useNotifications.js      # Notificações in-app
│   │   └── usePushNotifications.js  # Subscrição a notificações Web Push
│   ├── layouts/               # Layouts partilhados
│   │   └── Layout.jsx         # Layout global com BottomBar de navegação
│   ├── pages/                 # Páginas da aplicação (uma por rota)
│   │   ├── LandingPage.jsx          # Página de boas-vindas (pública)
│   │   ├── Auth.jsx                 # Registo e Login
│   │   ├── PassengerDashboard.jsx   # Dashboard do Passageiro
│   │   ├── DriverDashboard.jsx      # Dashboard do Motorista
│   │   ├── PublishRoute.jsx         # Publicar novo trajeto
│   │   ├── VehicleSetup.jsx         # Registar/editar veículo
│   │   ├── MyAgreements.jsx         # Gestão de acordos de boleia
│   │   ├── AbsenceTracker.jsx       # Registo de faltas por acordo
│   │   └── Profile.jsx              # Perfil do utilizador
│   ├── services/              # Camada de acesso a dados (Supabase)
│   │   ├── AgreementsService.js     # CRUD e ciclo de vida dos acordos
│   │   ├── RouteService.js          # Consulta de trajetos publicados
│   │   ├── GoogleMapsService.js     # Geocoding de origem/destino
│   │   ├── AbsenceService.js        # Registo de faltas
│   │   └── ProfileService.js        # Dados do perfil do utilizador
│   ├── utils/                 # Funções utilitárias puras
│   │   ├── notificationRouter.js    # Estratégia de deep linking por notificação
│   │   ├── formatters.js            # Formatação de datas e valores (Kz)
│   │   ├── validation.js            # Regras de validação de formulários
│   │   └── errorHandler.js          # Tratamento centralizado de erros
│   ├── sw.js                  # Service Worker (PWA / Web Push)
│   ├── App.jsx                # Componente raiz e definição de rotas
│   └── main.jsx               # Ponto de entrada da aplicação
├── supabase/
│   ├── functions/             # Edge Functions (Deno)
│   │   └── send-push/         # Envio de notificações Web Push (VAPID)
│   └── migrations/            # Migrações SQL da base de dados
├── .env.example               # Template das variáveis de ambiente
├── vercel.json                # Configuração de deploy (SPA rewrites)
├── vite.config.js             # Configuração do Vite e plugins
└── package.json
```

---

## 🗺️ Rotas da Aplicação

| Rota | Componente | Acesso |
|---|---|---|
| `/` | `LandingPage` | Público (redireciona se autenticado) |
| `/auth` | `Auth` | Público |
| `/passageiro` | `PassengerDashboard` | Perfil: Passageiro |
| `/motorista` | `DriverDashboard` | Perfil: Motorista |
| `/veiculo` | `VehicleSetup` | Perfil: Motorista |
| `/publicar-trajeto` | `PublishRoute` | Perfil: Motorista |
| `/acordos` | `MyAgreements` | Autenticado |
| `/faltas` / `/faltas/:acordoId` | `AbsenceTracker` | Autenticado |
| `/perfil` | `Profile` | Autenticado |

---

## 🗄️ Modelo de Dados (Principais Tabelas)

| Tabela | Descrição |
|---|---|
| `perfis` | Dados do utilizador e tipo de perfil (`Passageiro` / `Motorista`) |
| `routes` | Trajetos publicados por motoristas, com coordenadas de Geocoding |
| `acordos` | Acordos de boleia com estados: `pendente`, `ativo`, `cancelado` |
| `veiculos` | Veículo do motorista — relação 1:1 via `UNIQUE constraint` em `id_motorista` |
| `notificacoes` | Notificações in-app com metadata para deep linking |

> **Nota:** A tabela `routes` é a única fonte de verdade para trajetos. As coluna `origin_lat`, `origin_lng`, `destination_lat` e `destination_lng` são preenchidas automaticamente via Google Maps Geocoding no momento da publicação.

---

## 🔐 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave pública anónima do Supabase |
| `VITE_VAPID_PUBLIC_KEY` | ✅ | Chave pública VAPID para Web Push |
| `VITE_SENTRY_DSN` | ⚠️ Opcional | DSN do Sentry para monitorização de erros |

---

## 🚢 Deploy

O projeto está configurado para deploy automático no **Vercel**. O ficheiro `vercel.json` inclui as regras de reescrita necessárias para o roteamento SPA (todos os pedidos são redirecionados para `index.html`).

Para fazer deploy manualmente:

```bash
npm run build
# Faz upload da pasta dist/ para o Vercel ou plataforma à tua escolha
```

---

## 🧪 Testes

O projeto segue **TDD (Test-Driven Development)** com [Vitest](https://vitest.dev/) e [Testing Library](https://testing-library.com/). Todos os componentes, hooks, services e utilitários têm os respetivos ficheiros de teste co-localizados.

```bash
# Correr os testes em modo watch (desenvolvimento)
npm test

# Uma única execução (relatório + cobertura)
npm run test:run
```